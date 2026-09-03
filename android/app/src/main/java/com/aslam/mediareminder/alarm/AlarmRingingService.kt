package com.aslam.mediareminder.alarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import com.aslam.mediareminder.diagnostics.NativeLogger
import com.aslam.mediareminder.notifications.NotificationCoordinator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

/**
 * MR-06 "Ringing service". A native foreground service, `mediaPlayback` type,
 * started only for a claimed session whose reminder profile wants continuous
 * sound/vibration (Standard/Persistent — [ReminderProfileEntity.fullScreenWhenLocked];
 * Gentle never starts this service, matching "CATEGORY_ALARM for Standard/
 * Persistent... CATEGORY_REMINDER for Gentle").
 *
 * "Multiple simultaneous reminders" (docs/decision-log.md): this service is
 * a singleton per process but rings **one session at a time**. A second due
 * session while one is already ringing is queued ([queue]) rather than
 * played concurrently — two overlapping alarm tones and two stacked
 * full-screen activities would be exactly the "aggressive interruption" the
 * presentation request explicitly asked to avoid. The queued session still
 * gets its own real notification (posted by [AlarmDispatchReceiver] before
 * this service is ever started for it), so it is visible and actionable
 * (Play/Snooze/Dismiss straight from the shade) even while not yet ringing;
 * it is promoted — sound, vibration, and [AlarmActivity] advance to it in
 * place — the moment the current session resolves or times out.
 */
class AlarmRingingService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val database by lazy { MediaReminderDatabase.getInstance(applicationContext) }
    private val notificationCoordinator by lazy { NotificationCoordinator(applicationContext) }
    private val audioManager by lazy { getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    private val powerManager by lazy { getSystemService(Context.POWER_SERVICE) as PowerManager }

    private var currentSessionId: String? = null
    private val queue = ArrayDeque<String>()

    private var mediaPlayer: MediaPlayer? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var timeoutJob: Job? = null

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        // MR-06 "obtain audio focus... and respond to focus loss." Only a
        // true, permanent LOSS stops the tone — transient losses (a passing
        // system sound) are deliberately ignored: `USAGE_ALARM` exists
        // specifically to interrupt, not duck.
        if (change == AudioManager.AUDIOFOCUS_LOSS) {
            stopTone()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            AlarmIds.ACTION_RING -> {
                val sessionId = intent.getStringExtra(AlarmIds.EXTRA_SESSION_ID)
                if (sessionId != null) enqueueOrPromote(sessionId) else stopIfNothingRinging()
            }
            AlarmIds.ACTION_SILENCE -> silenceCurrent()
            AlarmIds.ACTION_STOP_SESSION -> {
                val sessionId = intent.getStringExtra(AlarmIds.EXTRA_SESSION_ID)
                if (sessionId != null) stopSession(sessionId)
            }
            // Null action/intent: the system recreated this service after
            // killing it (START_STICKY). MR-06: "recover its session after
            // service recreation from Room, or stop if no valid session
            // exists."
            else -> serviceScope.launch { recoverAfterRecreation() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        timeoutJob?.cancel()
        stopTone()
        stopVibration()
        releaseWakeLock()
        serviceScope.cancel()
        super.onDestroy()
    }

    // --- Queue management ------------------------------------------------------

    private fun enqueueOrPromote(sessionId: String) {
        when {
            currentSessionId == sessionId -> Unit // already ringing this one
            currentSessionId == null -> promote(sessionId)
            !queue.contains(sessionId) -> queue.addLast(sessionId)
        }
    }

    private fun promote(sessionId: String) {
        currentSessionId = sessionId
        serviceScope.launch {
            val session = database.activeAlarmSessionDao().getById(sessionId)
            if (session == null || session.state != ActiveAlarmSessionEntity.STATE_ALERTING) {
                // Resolved already (e.g. an in-app tap raced this promotion)
                // — nothing to ring for, move straight to the next one.
                NativeLogger.debug("alarmRinging.promoteAlreadyResolved", mapOf("sessionId" to sessionId))
                stopCurrentAndAdvance()
                return@launch
            }
            val reminder = database.reminderDao().getById(session.reminderId)
            val profile = reminder?.let { database.reminderProfileDao().getById(it.profileId) }

            // Re-check after the suspend points above: `stopSession`/
            // `stopIfNothingRinging` run synchronously on the same
            // Dispatchers.Main scope and may have already resolved this
            // session (and possibly called `stopSelf()`) while this
            // coroutine was suspended on the Room reads. Calling
            // `startForeground()` after that would resurrect a service
            // already mid-teardown — `stopCurrentAndAdvance()` already ran
            // whatever cleanup applies, so this is a plain bail-out, not
            // another advance.
            if (currentSessionId != sessionId) {
                NativeLogger.debug("alarmRinging.promoteRacedStop", mapOf("sessionId" to sessionId))
                return@launch
            }

            // Same content as the shade notification this replaces, artwork
            // included: `startForeground` shows whatever it is handed, so a
            // plainer build here would visibly downgrade the notification the
            // moment ringing started. `AlarmArtwork` decodes on IO, which
            // matters more here than anywhere else — this coroutine runs on
            // the main dispatcher.
            val notificationContent = reminder?.let { AlarmNotificationText.resolve(database, it) }
            val notification = notificationCoordinator.buildDueNotification(
                sessionId = sessionId,
                reminderLabel = reminder?.label ?: "Reminder",
                mediaTitle = notificationContent?.body ?: "",
                nonce = session.actionNonce,
                useAlarmChannel = true,
                ongoing = true,
                useFullScreenIntent = false,
                artwork = AlarmArtwork.load(this@AlarmRingingService, notificationContent?.media),
                subText = notificationContent?.subText,
            )
            ServiceCompat.startForeground(
                this@AlarmRingingService,
                notificationCoordinator.notificationIdFor(sessionId),
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
            )

            val timeoutSeconds = (profile?.timeoutSeconds ?: DEFAULT_TIMEOUT_SECONDS).coerceIn(1, MAX_LIFETIME_SECONDS)
            acquireWakeLock(timeoutSeconds)
            startRinging()
            scheduleTimeout(session, reminder, profile, timeoutSeconds)
            advanceForegroundActivityIfShowing(sessionId)
            NativeLogger.debug("alarmRinging.promoted", mapOf("sessionId" to sessionId, "timeoutSeconds" to timeoutSeconds))
        }
    }

    /**
     * MR-06 rule 3: "Never launch AlarmActivity directly" when unlocked/
     * interactive. This only re-invokes it for a *promoted queued* session
     * when [AlarmActivity.isForeground] is already true — i.e. the activity
     * is already the foreground UI for the previous session, so updating it
     * in place is not a new, uninvited takeover; it is the same screen
     * advancing. If it is not currently foreground, this is a no-op and the
     * promoted session's own notification (with its own full-screen intent,
     * if [DevicePresentationState] granted one for *that* dispatch) is the
     * only way it can surface — exactly the system-mediated path rule 1
     * describes, never a direct call from here.
     */
    private fun advanceForegroundActivityIfShowing(sessionId: String) {
        if (!AlarmActivity.isForeground) return
        val intent = Intent(this, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(AlarmIds.EXTRA_SESSION_ID, sessionId)
        }
        startActivity(intent)
    }

    private fun stopCurrentAndAdvance() {
        timeoutJob?.cancel()
        stopTone()
        stopVibration()
        releaseWakeLock()
        currentSessionId = null
        val next = queue.removeFirstOrNull()
        if (next != null) {
            promote(next)
        } else {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun stopIfNothingRinging() {
        if (currentSessionId == null && queue.isEmpty()) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    /** MR-06: "stop within one second of Play, Snooze, Dismiss, timeout or invalidated session" — called by [AlarmActionReceiver]/`MediaReminderModule` once [AlarmActionProcessor] resolves an action. */
    private fun stopSession(sessionId: String) {
        if (sessionId == currentSessionId) {
            stopCurrentAndAdvance()
        } else {
            // Resolved (e.g. from the shade or in-app) before ever being
            // promoted — just drop it from the queue.
            queue.remove(sessionId)
        }
    }

    private fun silenceCurrent() {
        // MR-06: "the alarm UI also has a visible Silence sound action" —
        // mutes audio/vibration only. The session stays `alerting`; the
        // user still must explicitly Accept/Snooze/Dismiss.
        stopTone()
        stopVibration()
    }

    private suspend fun recoverAfterRecreation() {
        val alerting = database.activeAlarmSessionDao().getAllAlerting()
        if (alerting.isEmpty()) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }
        queue.clear()
        alerting.drop(1).forEach { queue.addLast(it.id) }
        promote(alerting.first().id)
        NativeLogger.debug("alarmRinging.recovered", mapOf("alertingCount" to alerting.size))
    }

    // --- Timeout / retry ---------------------------------------------------------

    private fun scheduleTimeout(
        session: ActiveAlarmSessionEntity,
        reminder: ReminderEntity?,
        profile: ReminderProfileEntity?,
        timeoutSeconds: Int,
    ) {
        timeoutJob?.cancel()
        timeoutJob = serviceScope.launch {
            delay(timeoutSeconds * 1000L)
            handleTimeout(session, reminder, profile)
        }
    }

    /**
     * MR-06: "Maximum active lifetime is profile timeout, hard-capped at 10
     * minutes... Persistent retry is implemented as future one-shot alarms,
     * not an endlessly running service." A timed-out session that still has
     * retries left (profile `retryCount`, 0-3) gets a new `KIND_RETRY`
     * occurrence at now + `graceSeconds`; one that has exhausted its retries
     * is marked `missed` instead of `timed_out` — a final, non-retried
     * outcome.
     */
    private suspend fun handleTimeout(session: ActiveAlarmSessionEntity, reminder: ReminderEntity?, profile: ReminderProfileEntity?) {
        if (currentSessionId != session.id) return // already resolved/advanced past

        val occurrenceDao = database.occurrenceDao()
        val occurrence = occurrenceDao.getById(session.occurrenceId)
        val now = Instant.now().toEpochMilli()
        val retryCount = profile?.retryCount ?: 0
        val willRetry = occurrence != null && reminder != null && profile != null && occurrence.retryNumber < retryCount

        occurrenceDao.resolve(
            session.occurrenceId,
            if (willRetry) OccurrenceEntity.STATE_TIMED_OUT else OccurrenceEntity.STATE_MISSED,
            action = null,
            resolvedAt = now,
        )
        database.activeAlarmSessionDao().resolve(session.id, now)
        notificationCoordinator.cancel(session.id)

        if (willRetry && occurrence != null && reminder != null && profile != null) {
            val scheduledAt = now + profile.graceSeconds * 1000L
            occurrenceDao.insert(
                OccurrenceEntity(
                    id = UUID.randomUUID().toString(),
                    reminderId = reminder.id,
                    kind = OccurrenceEntity.KIND_RETRY,
                    parentOccurrenceId = occurrence.id,
                    scheduledAt = scheduledAt,
                    occurrenceKey = OccurrenceEntity.occurrenceKeyFor(OccurrenceEntity.KIND_RETRY, scheduledAt),
                    state = OccurrenceEntity.STATE_PENDING,
                    createdAt = now,
                    retryNumber = occurrence.retryNumber + 1,
                ),
            )
        }

        SchedulerCoordinator(applicationContext, database).reconcile("occurrence_timed_out")
        NativeLogger.debug("alarmRinging.timedOut", mapOf("sessionId" to session.id, "retried" to willRetry))
        stopCurrentAndAdvance()
    }

    // --- Audio / vibration ---------------------------------------------------------

    /**
     * MR-06 "Audio behavior": "During a detected communication audio mode,
     * default behavior is to reduce to notification sound/vibration rather
     * than overpower a call. No phone-state permission is requested" —
     * `AudioManager.getMode()` needs none.
     */
    private fun startRinging() {
        val inCall = audioManager.mode == AudioManager.MODE_IN_CALL || audioManager.mode == AudioManager.MODE_IN_COMMUNICATION
        vibrate(short = inCall)
        if (!inCall) {
            playTone()
        }
    }

    private fun playTone() {
        stopTone()
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(focusListener)
            .build()
        audioFocusRequest = focusRequest
        audioManager.requestAudioFocus(focusRequest)

        // MR-06: "Alarm audio never uses the attached media file before
        // Play" — always the system default alarm tone.
        // "Bluetooth/headphone routing follows system alarm routing. The
        // app does not secretly force speaker output" — no
        // `setAudioStreamType`/output-device override here; `MediaPlayer`
        // follows whatever route `AudioAttributes.USAGE_ALARM` resolves to.
        val toneUri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getValidRingtoneUri(this)
        if (toneUri == null) {
            NativeLogger.warn("alarmRinging.noToneAvailable")
            return
        }
        mediaPlayer = MediaPlayer().apply {
            setAudioAttributes(attributes)
            isLooping = true
            // `prepare()` is a blocking call — decoding the tone header on
            // this service's Dispatchers.Main scope would stall the main
            // thread (frame drops if the app is foregrounded, ANR risk in
            // the worst case). `prepareAsync()` + listeners keeps the actual
            // decode off the main thread while `start()` still only ever
            // runs once preparation genuinely finished.
            setOnPreparedListener { player ->
                // Guards against `stopTone()` (or a later `playTone()` call)
                // having already released/replaced this player between
                // `prepareAsync()` being issued and this callback firing —
                // calling `start()` on an already-released MediaPlayer
                // throws IllegalStateException.
                if (mediaPlayer === player) player.start()
            }
            setOnErrorListener { player, what, extra ->
                NativeLogger.error(
                    "alarmRinging.toneFailed",
                    mapOf("what" to what, "extra" to extra),
                )
                player.release()
                if (mediaPlayer === player) mediaPlayer = null
                true
            }
            try {
                setDataSource(this@AlarmRingingService, toneUri)
                prepareAsync()
            } catch (error: Exception) {
                NativeLogger.error("alarmRinging.toneFailed", cause = error)
                release()
                mediaPlayer = null
            }
        }
    }

    private fun stopTone() {
        mediaPlayer?.let { player ->
            runCatching { if (player.isPlaying) player.stop() }
            player.release()
        }
        mediaPlayer = null
        audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        audioFocusRequest = null
    }

    /** MR-09 "Vibration total duration is capped" — satisfied by this waveform's own bound plus the absolute service/wake-lock timeout; never an indefinite repeat outside a bounded session. */
    private fun vibrate(short: Boolean) {
        val vibrator = vibratorOrNull() ?: return
        if (!vibrator.hasVibrator()) return
        val pattern = if (short) longArrayOf(0, 400) else longArrayOf(0, 800, 400, 800, 400)
        val repeatFromIndex = if (short) -1 else 0
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, repeatFromIndex))
    }

    private fun stopVibration() {
        vibratorOrNull()?.cancel()
    }

    private fun vibratorOrNull(): Vibrator? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

    // --- Wake lock -----------------------------------------------------------------

    /** MR-06: "maintain a session-scoped partial wake lock only while actively ringing, with an absolute timeout." */
    private fun acquireWakeLock(timeoutSeconds: Int) {
        releaseWakeLock()
        val lock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MediaReminder:AlarmRinging")
        lock.acquire(timeoutSeconds * 1000L)
        wakeLock = lock
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    companion object {
        /** Falls back only if a reminder/profile row is somehow missing — should not happen in practice. */
        private const val DEFAULT_TIMEOUT_SECONDS = 60

        /** MR-06: "hard-capped at 10 minutes in v1." */
        private const val MAX_LIFETIME_SECONDS = 600

        /**
         * [AlarmDispatchReceiver]'s single entry point for "this session needs
         * continuous ringing."
         *
         * The platform can refuse a foreground-service start that originates
         * from a background broadcast (`ForegroundServiceStartNotAllowedException`,
         * API 31+). An alarm delivered via `setAlarmClock` is normally exempt,
         * but the *inexact* fallback path — the one taken when exact-alarm
         * access has not been granted — is not reliably covered by that
         * exemption. Letting that throw would take the whole dispatch down
         * through `dispatchWithWakeLock`'s failure branch and, worse, would do
         * it silently from the user's point of view: no sound and no
         * explanation.
         *
         * Caught and logged instead, because the notification is still posted
         * and its channel now carries an alarm-stream sound of its own (see
         * `NotificationCoordinator.ensureChannels`), so a refused service
         * degrades to "rings once via the notification" rather than "silent".
         */
        fun ring(context: Context, sessionId: String) {
            val intent = Intent(context, AlarmRingingService::class.java).apply {
                action = AlarmIds.ACTION_RING
                putExtra(AlarmIds.EXTRA_SESSION_ID, sessionId)
            }
            runCatching { ContextCompat.startForegroundService(context, intent) }
                .onFailure { error ->
                    NativeLogger.error(
                        "alarmRinging.startRefused",
                        mapOf("sessionId" to sessionId),
                        cause = error,
                    )
                }
        }

        /** [AlarmActionReceiver]/`MediaReminderModule`'s entry point once [AlarmActionProcessor] resolves a session — MR-06: "stop within one second." */
        fun stopSession(context: Context, sessionId: String) {
            val intent = Intent(context, AlarmRingingService::class.java).apply {
                action = AlarmIds.ACTION_STOP_SESSION
                putExtra(AlarmIds.EXTRA_SESSION_ID, sessionId)
            }
            context.startService(intent)
        }

        /** The full-screen [AlarmActivity]'s "Silence sound" accessibility-overflow action. */
        fun silence(context: Context, sessionId: String) {
            val intent = Intent(context, AlarmRingingService::class.java).apply {
                action = AlarmIds.ACTION_SILENCE
                putExtra(AlarmIds.EXTRA_SESSION_ID, sessionId)
            }
            context.startService(intent)
        }
    }
}
