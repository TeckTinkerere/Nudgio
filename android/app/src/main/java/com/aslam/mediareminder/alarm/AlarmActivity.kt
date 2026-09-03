package com.aslam.mediareminder.alarm

import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.view.animation.PathInterpolator
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.PopupMenu
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.aslam.mediareminder.R
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
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
    private lateinit var bodyView: TextView
    private lateinit var mediaTitleView: TextView
    private lateinit var repeatSummaryView: TextView
    private lateinit var acceptButton: MaterialButton
    private lateinit var snoozeButton: MaterialButton
    private lateinit var overflowButton: ImageButton

    // The media preview card — a poster, never a player (MR-06: "No media
    // autoplays in the alarm activity"). See `bindPreview`.
    private lateinit var previewCard: MaterialCardView
    private lateinit var previewImage: ImageView
    private lateinit var previewKindIcon: ImageView
    private lateinit var previewKindLabel: TextView
    private lateinit var previewKindGlyph: ImageView
    private lateinit var previewPlayBadge: ImageView
    private lateinit var previewHint: TextView

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
        bodyView = findViewById(R.id.alarm_body)
        mediaTitleView = findViewById(R.id.alarm_media_title)
        repeatSummaryView = findViewById(R.id.alarm_repeat_summary)
        previewCard = findViewById(R.id.alarm_preview_card)
        previewImage = findViewById(R.id.alarm_preview_image)
        previewKindIcon = findViewById(R.id.alarm_preview_kind_icon)
        previewKindLabel = findViewById(R.id.alarm_preview_kind_label)
        previewKindGlyph = findViewById(R.id.alarm_preview_kind_glyph)
        previewPlayBadge = findViewById(R.id.alarm_preview_play_badge)
        previewHint = findViewById(R.id.alarm_preview_hint)
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
        bodyView.text = body
        bodyView.visibility = if (body.isBlank()) View.GONE else View.VISIBLE
        repeatSummaryView.visibility = View.GONE
        // No session means no media: the preview card would have nothing to
        // put in it, and an empty poster frame reads as a failure rather than
        // as "this style has no media".
        previewCard.visibility = View.GONE
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
        // Reset every piece of per-session chrome: this activity is
        // `singleTop`, so the instance being filled in here may be the one
        // that just finished showing a *different* session — or a preview,
        // which hides three controls this one needs back.
        labelView.text = getString(R.string.alarm_default_label)
        bodyView.visibility = View.GONE
        repeatSummaryView.text = ""
        repeatSummaryView.visibility = View.GONE
        previewCard.visibility = View.GONE
        acceptButton.visibility = View.VISIBLE
        snoozeButton.visibility = View.VISIBLE
        overflowButton.visibility = View.VISIBLE

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
            val summary = ruleEntity?.let {
                RepeatSummaryFormatter.summarize(ScheduleRuleMapper.toDomain(it))
            }.orEmpty()
            repeatSummaryView.text = summary
            repeatSummaryView.visibility = if (summary.isBlank()) View.GONE else View.VISIBLE

            // Remember what this session points at, so Accept can open it.
            val media = reminder?.let { database.mediaDao().getById(it.mediaId) }
            acceptMediaId = media?.id
            bindPreview(media, newSessionId)
        }
    }

    /**
     * Fills the media preview card: what this reminder is *about*, shown as a
     * poster rather than described in a sentence.
     *
     * Deliberately never a player. MR-06 is absolute that no media autoplays
     * here, so the card carries a still frame, the media's kind, its title,
     * and — for the two time-based kinds — a play badge and the words "Plays
     * when you accept". A photo or a note gets no play badge, because
     * promising playback the app will not deliver is worse than promising
     * nothing.
     *
     * Falls back in two stages, so there is no state where the card is a hole:
     * a decoded thumbnail becomes both the poster and the screen's backdrop;
     * no thumbnail (audio without cover art, a note, a frame that would not
     * decode) leaves the gradient placeholder with the kind glyph on it; no
     * media row at all hides the card outright.
     */
    private suspend fun bindPreview(media: MediaAssetEntity?, forSessionId: String) {
        if (media == null) {
            previewCard.visibility = View.GONE
            return
        }
        val playable = isTimeBased(media.kind)
        mediaTitleView.text = media.title
        previewKindLabel.setText(kindLabelRes(media.kind))
        previewKindIcon.setImageResource(kindIconRes(media.kind))
        previewKindGlyph.setImageResource(kindIconRes(media.kind))
        previewHint.setText(
            if (playable) R.string.alarm_preview_hint_playable else R.string.alarm_preview_hint_static,
        )
        previewCard.visibility = View.VISIBLE
        revealPreviewCard()

        val artwork = AlarmArtwork.load(this, media)
        // Re-checked after the decode's suspend point, like the session read
        // above: a newer session may have taken this activity over while the
        // bitmap was being read off disk.
        if (sessionId != forSessionId) return
        if (artwork == null) {
            previewImage.setImageDrawable(null)
            previewKindGlyph.visibility = View.VISIBLE
            previewPlayBadge.visibility = View.GONE
            return
        }
        previewImage.setImageBitmap(artwork)
        previewKindGlyph.visibility = View.GONE
        previewPlayBadge.visibility = if (playable) View.VISIBLE else View.GONE
        showBackdrop(artwork)
    }

    /** Video and audio play; a photo and a note are opened and looked at. */
    private fun isTimeBased(kind: String): Boolean =
        kind == MediaAssetEntity.KIND_VIDEO || kind == MediaAssetEntity.KIND_AUDIO

    private fun kindLabelRes(kind: String): Int = when (kind) {
        MediaAssetEntity.KIND_VIDEO -> R.string.alarm_kind_video
        MediaAssetEntity.KIND_AUDIO -> R.string.alarm_kind_audio
        MediaAssetEntity.KIND_IMAGE -> R.string.alarm_kind_image
        else -> R.string.alarm_kind_text
    }

    private fun kindIconRes(kind: String): Int = when (kind) {
        MediaAssetEntity.KIND_VIDEO -> R.drawable.ic_media_video
        MediaAssetEntity.KIND_AUDIO -> R.drawable.ic_media_audio
        MediaAssetEntity.KIND_IMAGE -> R.drawable.ic_media_image
        else -> R.drawable.ic_media_text
    }

    /**
     * One-shot rise-and-fade as the card fills in, so it reads as arriving
     * rather than as having been missing for a frame. Plays once and never
     * repeats — MR-04 forbids looping decorative animation outright, and an
     * alarm screen is the last place to pulse something at someone — and is
     * skipped entirely when the platform's own animator scale is off
     * (MR-13 ACC-006's reduced-motion signal at the native layer).
     */
    private fun revealPreviewCard() {
        val animatorScale = Settings.Global.getFloat(
            contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        )
        if (animatorScale == 0f) return
        previewCard.alpha = 0f
        previewCard.translationY = 24f * resources.displayMetrics.density
        previewCard.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(220L)
            // MR-04 `emphasizedDecelerate`, the same curve the JS strip uses.
            .setInterpolator(PathInterpolator(0.05f, 0.7f, 0.1f, 1f))
            .start()
    }

    /**
     * Paints the reminder's own thumbnail behind the alarm, under the
     * top-and-bottom gradient scrim, so the screen looks like the thing it is
     * reminding you of. The bitmap is the one [bindPreview] already decoded
     * off the main thread — this runs while an alarm is ringing, and a jank-y
     * first frame here is exactly the moment it would be most obvious.
     */
    private fun showBackdrop(artwork: Bitmap) {
        backgroundImage.setImageBitmap(artwork)
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
