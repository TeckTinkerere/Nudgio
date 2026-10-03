package com.aslam.mediareminder.alarm

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.aslam.mediareminder.MainActivity
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The notification's Play button (DL-080). Invisible: it resolves the
 * session, hands the reminder to JS and opens the app, then finishes.
 *
 * Why an activity at all: Play used to be a broadcast `PendingIntent` to
 * [AlarmActionReceiver], which then called `startActivity`. Since Android 12
 * that is a blocked "notification trampoline" — the session resolved, the
 * sound stopped, and nothing opened. An activity `PendingIntent` is the
 * platform-sanctioned way for a notification action to bring up UI.
 *
 * Resolution itself still goes through the one shared path (an explicit
 * broadcast to [AlarmActionReceiver] → [AlarmActionProcessor]), exactly as
 * [AlarmActivity]'s own buttons do, so Play keeps working with React Native
 * absent and keeps its nonce/idempotency guarantees.
 */
class AlarmOpenActivity : Activity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val sessionId = intent.getStringExtra(AlarmIds.EXTRA_SESSION_ID)
        val nonce = intent.getStringExtra(AlarmIds.EXTRA_NONCE)
        if (sessionId == null || nonce == null) {
            finish()
            return
        }

        sendBroadcast(
            Intent(this, AlarmActionReceiver::class.java).apply {
                action = AlarmIds.ACTION_PLAY
                putExtra(AlarmIds.EXTRA_SESSION_ID, sessionId)
                putExtra(AlarmIds.EXTRA_NONCE, nonce)
            },
        )

        scope.launch {
            // The session row survives resolution (its state changes, it is
            // not deleted), so this read is safe whichever finishes first.
            val database = MediaReminderDatabase.getInstance(applicationContext)
            val reminderId = withContext(Dispatchers.IO) {
                runCatching { database.activeAlarmSessionDao().getById(sessionId)?.reminderId }.getOrNull()
            }
            val mediaId = reminderId?.let { id ->
                withContext(Dispatchers.IO) { runCatching { AcceptMediaResolver.resolve(database, id) }.getOrNull() }
            }
            PendingMediaOpen.set(reminderId, mediaId)
            runCatching {
                startActivity(
                    Intent(this@AlarmOpenActivity, MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    },
                )
            }
            finish()
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
