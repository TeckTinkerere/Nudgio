package com.aslam.mediareminder.alarm

import android.animation.ValueAnimator
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.text.format.DateFormat
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.aslam.mediareminder.R
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity
import com.google.android.material.button.MaterialButton
import java.util.Calendar
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * MR-06 "Full-screen alarm activity": native, exported `false`, `noHistory`,
 * `excludeFromRecents`, backed by the active session ID (see manifest).
 * Reached two ways: the system's own full-screen-intent delivery (locked/
 * non-interactive — [DevicePresentationState] rule 1), or
 * [AlarmRingingService] directly re-invoking it in place when a *queued*
 * session is promoted while this activity is already the foreground
 * activity ([isForeground]) — never as a cold trigger, which would violate
 * rule 3's "never launch AlarmActivity directly" for the unlocked case.
 *
 * Play/Snooze/Dismiss are dispatched as an explicit broadcast to
 * [AlarmActionReceiver] — the same nonce-checked, idempotent resolution path
 * the notification buttons use. `exported="false"` on that receiver only
 * blocks other apps; an explicit same-app `Intent` still reaches it.
 *
 * No media autoplays here (MR-06: "No media autoplays in the alarm
 * activity"); this activity never calls `KeyguardManager.requestDismissKeyguard()`
 * or the deprecated `FLAG_DISMISS_KEYGUARD`.
 */
class AlarmActivity : AppCompatActivity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val database by lazy { MediaReminderDatabase.getInstance(applicationContext) }

    private var sessionId: String? = null
    private var nonce: String? = null

    /** True when this Activity is showing Settings' "Preview alarm styles" (see `AlarmIds.EXTRA_PREVIEW_*`), not a real session. */
    private var isPreview = false

    /** The media this session's reminder points at, resolved in [loadSession] — Play opens it. */
    private var acceptMediaId: String? = null

    private lateinit var contentView: View
    private lateinit var backgroundImage: ImageView
    private lateinit var backgroundScrim: View
    private lateinit var heroImage: ImageView
    private lateinit var heroIcon: ImageView
    private lateinit var timeView: TextView
    private lateinit var timePeriodView: TextView
    private lateinit var dateView: TextView
    private lateinit var labelView: TextView
    private lateinit var mediaTitleView: TextView
    private lateinit var repeatSummaryView: TextView
    private lateinit var acceptButton: MaterialButton
    private lateinit var snoozeButton: MaterialButton
    private lateinit var silenceButton: MaterialButton

    /** Minute ticks keep the clock honest while the alarm sits on screen; registered only while visible. */
    private val clockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) = renderClock()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyWindowFlags()
        setContentView(R.layout.activity_alarm)
        bindViews()
        renderClock()
        loadSession(intent)
        onBackPressedDispatcher.addCallback(this, backPressedCallback)
        playEntrance()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadSession(intent)
    }

    override fun onStart() {
        super.onStart()
        renderClock()
        ContextCompat.registerReceiver(
            this,
            clockReceiver,
            IntentFilter().apply {
                addAction(Intent.ACTION_TIME_TICK)
                addAction(Intent.ACTION_TIME_CHANGED)
                addAction(Intent.ACTION_TIMEZONE_CHANGED)
            },
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    override fun onStop() {
        runCatching { unregisterReceiver(clockReceiver) }
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        isForeground = true
    }

    override fun onPause() {
        super.onPause()
        isForeground = false
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    /**
     * MR-06 Back-button mapping: "collapse to the notification while ringing
     * continues". Finishes without touching the session, ringing service or
     * notification, all of which are independent of this UI.
     */
    private val backPressedCallback = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
            finish()
        }
    }

    private fun applyWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun bindViews() {
        contentView = findViewById(R.id.alarm_content)
        backgroundImage = findViewById(R.id.alarm_background_image)
        backgroundScrim = findViewById(R.id.alarm_background_scrim)
        heroImage = findViewById(R.id.alarm_hero_image)
        heroIcon = findViewById(R.id.alarm_hero_icon)
        timeView = findViewById(R.id.alarm_time)
        timePeriodView = findViewById(R.id.alarm_time_period)
        dateView = findViewById(R.id.alarm_date)
        labelView = findViewById(R.id.alarm_label)
        mediaTitleView = findViewById(R.id.alarm_media_title)
        repeatSummaryView = findViewById(R.id.alarm_repeat_summary)
        acceptButton = findViewById(R.id.alarm_accept_button)
        snoozeButton = findViewById(R.id.alarm_snooze_button)
        silenceButton = findViewById(R.id.alarm_silence_button)

        acceptButton.setOnClickListener { dispatchAction(AlarmIds.ACTION_PLAY) }
        snoozeButton.setOnClickListener { dispatchAction(AlarmIds.ACTION_SNOOZE) }
        findViewById<MaterialButton>(R.id.alarm_dismiss_button).setOnClickListener {
            dispatchAction(AlarmIds.ACTION_DISMISS)
        }
        // Silencing used to hide behind an overflow menu, the last place a
        // just-woken person looks. It stops sound/vibration only; the alarm
        // stays on screen until Play/Snooze/Dismiss.
        silenceButton.setOnClickListener {
            val id = sessionId ?: return@setOnClickListener
            AlarmRingingService.silence(this, id)
            silenceButton.isEnabled = false
            silenceButton.text = getString(R.string.alarm_sound_silenced)
        }
    }

    /** Follows the system 12/24-hour setting, like the rest of the app (MR-13). */
    private fun renderClock() {
        val now = Calendar.getInstance()
        val locale = Locale.getDefault()
        if (DateFormat.is24HourFormat(this)) {
            timeView.text = DateFormat.format("H:mm", now)
            timePeriodView.visibility = View.GONE
        } else {
            timeView.text = DateFormat.format("h:mm", now)
            timePeriodView.text = DateFormat.format("a", now).toString().uppercase(locale)
            timePeriodView.visibility = View.VISIBLE
        }
        dateView.text = DateFormat.format(DateFormat.getBestDateTimePattern(locale, "EEEEdMMMM"), now)
    }

    /**
     * A short settle-in so the takeover does not hard-cut onto the screen.
     * Skipped when the user has turned animations off system-wide (the
     * native counterpart of the RN side's `reduceMotion`).
     */
    private fun playEntrance() {
        if (!ValueAnimator.areAnimatorsEnabled()) return
        contentView.alpha = 0f
        contentView.translationY = resources.displayMetrics.density * 24
        contentView.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(ENTRANCE_DURATION_MS)
            .setInterpolator(DecelerateInterpolator(2f))
            .start()
    }

    /**
     * Settings "Preview alarm styles": shows the already-localized title/body
     * JS built for the tapped profile, with no Room session behind it —
     * Play/Snooze/Silence only make sense against a real session, so they
     * are hidden. Dismiss stays visible and just closes this screen.
     */
    private fun showPreview(title: String, body: String) {
        isPreview = true
        sessionId = null
        nonce = null
        labelView.text = title
        setOptionalText(mediaTitleView, body)
        setOptionalText(repeatSummaryView, null)
        acceptButton.visibility = View.GONE
        snoozeButton.visibility = View.GONE
        silenceButton.visibility = View.GONE
    }

    private fun loadSession(intent: Intent) {
        val previewTitle = intent.getStringExtra(AlarmIds.EXTRA_PREVIEW_TITLE)
        if (previewTitle != null) {
            showPreview(previewTitle, intent.getStringExtra(AlarmIds.EXTRA_PREVIEW_BODY).orEmpty())
            return
        }

        isPreview = false
        val newSessionId = intent.getStringExtra(AlarmIds.EXTRA_SESSION_ID) ?: return
        sessionId = newSessionId
        labelView.text = getString(R.string.alarm_default_label)
        setOptionalText(mediaTitleView, null)
        setOptionalText(repeatSummaryView, null)
        silenceButton.isEnabled = true
        silenceButton.text = getString(R.string.alarm_silence_sound)

        scope.launch {
            val session = database.activeAlarmSessionDao().getById(newSessionId)
            if (sessionId != newSessionId) return@launch // superseded by a newer onNewIntent while this was loading
            if (session == null || session.state != ActiveAlarmSessionEntity.STATE_ALERTING) {
                // Resolved by another path (shade action, in-app tap, or
                // timeout) while this activity was coming up.
                finish()
                return@launch
            }
            nonce = session.actionNonce

            val reminder = database.reminderDao().getById(session.reminderId)
            val ruleEntity = reminder?.let { database.scheduleRuleDao().getByReminderId(it.id) }
            val media = reminder?.let { database.mediaDao().getById(it.mediaId) }

            labelView.text = reminder?.label ?: getString(R.string.alarm_default_label)
            setOptionalText(mediaTitleView, media?.title?.takeIf { it != reminder?.label })
            setOptionalText(
                repeatSummaryView,
                ruleEntity?.let { RepeatSummaryFormatter.summarize(ScheduleRuleMapper.toDomain(it)) },
            )
            reminder?.snoozeDefaultMinutes?.let { minutes ->
                snoozeButton.text = getString(R.string.alarm_snooze_minutes, minutes)
            }

            acceptMediaId = media?.id
            showArtwork(media?.thumbnailPath)
        }
    }

    private fun setOptionalText(view: TextView, text: String?) {
        view.text = text.orEmpty()
        view.visibility = if (text.isNullOrBlank()) View.GONE else View.VISIBLE
    }

    /**
     * Shows the reminder's own thumbnail twice: sharp in the hero tile and
     * dimmed full-bleed behind everything. Decoded off the main thread — this
     * runs while an alarm is ringing, where a janky first frame is most
     * obvious. A missing/unreadable file keeps the branded fallback tile.
     */
    private suspend fun showArtwork(thumbnailPath: String?) {
        if (thumbnailPath.isNullOrBlank()) return
        val bitmap = withContext(Dispatchers.IO) {
            runCatching {
                val file = java.io.File(thumbnailPath)
                if (file.exists()) android.graphics.BitmapFactory.decodeFile(file.absolutePath) else null
            }.getOrNull()
        } ?: return
        heroImage.setImageBitmap(bitmap)
        heroImage.visibility = View.VISIBLE
        heroIcon.visibility = View.GONE
        backgroundImage.setImageBitmap(bitmap)
        backgroundImage.visibility = View.VISIBLE
        backgroundScrim.visibility = View.VISIBLE
    }

    /**
     * Same explicit-broadcast path the notification's own action buttons
     * use — the UI finishes immediately for a responsive tap; [AlarmActionReceiver]
     * resolves the session, cancels the notification and stops
     * [AlarmRingingService] shortly after.
     */
    private fun dispatchAction(action: String) {
        if (isPreview) {
            finish()
            return
        }
        val id = sessionId ?: return
        val currentNonce = nonce ?: return
        sendBroadcast(
            Intent(this, AlarmActionReceiver::class.java).apply {
                this.action = action
                putExtra(AlarmIds.EXTRA_SESSION_ID, id)
                putExtra(AlarmIds.EXTRA_NONCE, currentNonce)
            },
        )

        // Play means "show me the thing you were reminding me about". The
        // media id is handed over out-of-band (see `PendingMediaOpen`) rather
        // than as an Intent extra JS would have to race RN startup to read.
        if (action == AlarmIds.ACTION_PLAY) {
            PendingMediaOpen.set(acceptMediaId)
            runCatching {
                startActivity(
                    Intent(this, com.aslam.mediareminder.MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    },
                )
            }
        }
        finish()
    }

    companion object {
        private const val ENTRANCE_DURATION_MS = 320L

        /** [AlarmRingingService] reads this before proactively re-invoking this activity for a promoted queued session — never true unless this activity is genuinely already the foreground UI. */
        @Volatile
        var isForeground: Boolean = false
            private set
    }
}
