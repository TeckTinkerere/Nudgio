package com.aslam.mediareminder.alarm

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.PopupMenu
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.aslam.mediareminder.R
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

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
 * Play/Snooze/Dismiss ("Accept" here — same underlying `ACTION_PLAY` as the
 * notification's "Play" button, just labeled for a full-screen "acknowledge
 * this reminder" context rather than a media-playback one) are dispatched as
 * an explicit broadcast to [AlarmActionReceiver] — the exact same
 * nonce-checked, idempotent resolution path the notification buttons use,
 * reused rather than duplicated. `exported="false"` on that receiver only
 * blocks other apps; an explicit same-app `Intent` still reaches it.
 *
 * No media autoplays here (MR-06: "No media autoplays in the alarm
 * activity"); this activity draws no lock-screen-bypassing UI beyond
 * [android.app.Activity.setShowWhenLocked] — it never calls
 * `KeyguardManager.requestDismissKeyguard()` or the deprecated
 * `FLAG_DISMISS_KEYGUARD`, matching "does not dismiss keyguard without
 * explicit platform-authorized user flow."
 */
class AlarmActivity : AppCompatActivity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val database by lazy { MediaReminderDatabase.getInstance(applicationContext) }

    private var sessionId: String? = null
    private var nonce: String? = null

    /** True when this Activity is showing Settings' "Preview alarm styles" (see `AlarmIds.EXTRA_PREVIEW_*`), not a real session. */
    private var isPreview = false

    /** The media this session's reminder points at, resolved in [loadSession] — Accept opens it. */
    private var acceptMediaId: String? = null

    private lateinit var backgroundImage: ImageView
    private lateinit var backgroundScrim: View
    private lateinit var labelView: TextView
    private lateinit var mediaTitleView: TextView
    private lateinit var repeatSummaryView: TextView
    private lateinit var acceptButton: MaterialButton
    private lateinit var snoozeButton: MaterialButton
    private lateinit var overflowButton: ImageButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyWindowFlags()
        setContentView(R.layout.activity_alarm)
        bindViews()
        loadSession(intent)
        onBackPressedDispatcher.addCallback(this, backPressedCallback)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadSession(intent)
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
     * continues... default." This activity is only ever shown for
     * Standard/Persistent sessions ([DevicePresentationState] gates full-
     * screen intent on `profilePermitsLockedAlarm`, which Gentle never
     * satisfies), so the Gentle "stop" branch that same spec line describes
     * has no reachable case here — Back always collapses: it finishes this
     * activity without touching the session, ringing service or
     * notification, all of which are independent of this UI. Uses
     * [OnBackPressedDispatcher] rather than the deprecated `onBackPressed()`
     * override so this keeps working unchanged if predictive back
     * (`android:enableOnBackInvokedCallback`) is ever enabled.
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
        backgroundImage = findViewById(R.id.alarm_background_image)
        backgroundScrim = findViewById(R.id.alarm_background_scrim)
        labelView = findViewById(R.id.alarm_label)
        mediaTitleView = findViewById(R.id.alarm_media_title)
        repeatSummaryView = findViewById(R.id.alarm_repeat_summary)
        acceptButton = findViewById(R.id.alarm_accept_button)
        snoozeButton = findViewById(R.id.alarm_snooze_button)
        overflowButton = findViewById(R.id.alarm_overflow_button)

        acceptButton.setOnClickListener {
            dispatchAction(AlarmIds.ACTION_PLAY)
        }
        snoozeButton.setOnClickListener {
            dispatchAction(AlarmIds.ACTION_SNOOZE)
        }
        findViewById<MaterialButton>(R.id.alarm_dismiss_button).setOnClickListener {
            dispatchAction(AlarmIds.ACTION_DISMISS)
        }
        overflowButton.setOnClickListener { anchor ->
            PopupMenu(this, anchor).apply {
                menu.add(getString(R.string.alarm_silence_sound))
                setOnMenuItemClickListener {
                    sessionId?.let { id -> AlarmRingingService.silence(this@AlarmActivity, id) }
                    true
                }
            }.show()
        }
    }

    /**
     * Settings "Preview alarm styles": shows the already-localized title/body
     * JS built for the tapped profile directly, with no Room session behind
     * it — Accept/Snooze/the "Silence sound" overflow only make sense against
     * a real session, so they are hidden rather than left visible and inert.
     * Dismiss stays visible and, via [dispatchAction]'s `isPreview` check,
     * just closes this screen.
     */
    private fun showPreview(title: String, body: String) {
        isPreview = true
        sessionId = null
        nonce = null
        labelView.text = title
        mediaTitleView.text = body
        repeatSummaryView.text = ""
        acceptButton.visibility = View.GONE
        snoozeButton.visibility = View.GONE
        overflowButton.visibility = View.GONE
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
        mediaTitleView.text = ""
        repeatSummaryView.text = ""

        scope.launch {
            val session = database.activeAlarmSessionDao().getById(newSessionId)
            if (sessionId != newSessionId) return@launch // superseded by a newer onNewIntent while this was loading
            if (session == null || session.state != ActiveAlarmSessionEntity.STATE_ALERTING) {
                // Resolved by another path (shade action, in-app tap, or
                // timeout) while this activity was coming up — nothing to
                // show.
                finish()
                return@launch
            }
            nonce = session.actionNonce

            val reminder = database.reminderDao().getById(session.reminderId)
            val ruleEntity = reminder?.let { database.scheduleRuleDao().getByReminderId(it.id) }

            labelView.text = reminder?.label ?: getString(R.string.alarm_default_label)
            mediaTitleView.text = reminder?.label ?: ""
            repeatSummaryView.text = ruleEntity?.let {
                RepeatSummaryFormatter.summarize(ScheduleRuleMapper.toDomain(it))
            } ?: ""

            // Remember what this session points at, so Accept can open it.
            val media = reminder?.let { database.mediaDao().getById(it.mediaId) }
            acceptMediaId = media?.id
            showBackdrop(media?.thumbnailPath)
        }
    }

    /**
     * Paints the reminder's own thumbnail behind the alarm, under a scrim.
     * Decoding happens off the main thread — this runs while an alarm is
     * ringing, and a jank-y first frame here is exactly the moment it would
     * be most obvious. A missing/unreadable file is not an error worth
     * surfacing: the flat background the layout already has is a perfectly
     * good alarm screen, so both views simply stay hidden.
     */
    private suspend fun showBackdrop(thumbnailPath: String?) {
        if (thumbnailPath.isNullOrBlank()) return
        val bitmap = withContext(Dispatchers.IO) {
            runCatching {
                val file = java.io.File(thumbnailPath)
                if (file.exists()) android.graphics.BitmapFactory.decodeFile(file.absolutePath) else null
            }.getOrNull()
        } ?: return
        backgroundImage.setImageBitmap(bitmap)
        backgroundImage.visibility = View.VISIBLE
        backgroundScrim.visibility = View.VISIBLE
    }

    /**
     * Same explicit-broadcast path the notification's own action buttons
     * use (see class doc) — the UI finishes immediately for a responsive
     * tap; [AlarmActionReceiver] resolves the session, cancels the
     * notification and stops [AlarmRingingService] shortly after,
     * independent of this activity's lifecycle.
     */
    private fun dispatchAction(action: String) {
        if (isPreview) {
            // No session exists to resolve — Dismiss (the only button left
            // visible, see `showPreview`) just closes the preview.
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

        // Accept means "yes, show me the thing you were reminding me about"
        // — resolving the session and then dropping the user on a blank lock
        // screen is the whole point of the reminder going unmet. Snooze and
        // Dismiss deliberately do not do this. The media id is handed over
        // out-of-band (see `PendingMediaOpen`) rather than as an Intent extra
        // JS would have to race the RN bridge's own startup to read.
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
        /** [AlarmRingingService] reads this before proactively re-invoking this activity for a promoted queued session — never true unless this activity is genuinely already the foreground UI. */
        @Volatile
        var isForeground: Boolean = false
            private set
    }
}
