package com.aslam.mediareminder.media

import android.content.Intent
import android.net.Uri
import android.os.Build

/**
 * "Share to Nudgio" (DL-110): the files another app handed `MainActivity`
 * through `ACTION_SEND` / `ACTION_SEND_MULTIPLE`, waiting for JS to import.
 *
 * The same take-once, process-scoped slot as
 * [com.aslam.mediareminder.alarm.PendingMediaOpen], for the same reason: a
 * share can cold-start the app before any JS exists to receive an event.
 * Not persisted — the read grant that came with the share dies with the
 * process, so a share remembered across a restart could not be read anyway.
 *
 * A share is untrusted input from any installed app. Only `content://` URIs
 * are accepted, and never this app's own FileProvider: a `file://` or
 * self-authority URI is how a hostile sender would get Nudgio to "import" —
 * and then export or back up — its own private database or files.
 */
object IncomingShare {

    private val ACCEPTED_TYPE_PREFIXES = listOf("image/", "video/", "audio/")

    @Volatile
    private var pending: List<Uri> = emptyList()

    /** Called by `MainActivity` for every intent it receives; ignores anything that is not a media share. */
    fun capture(intent: Intent?, ownAuthority: String) {
        val uris = extract(intent ?: return)
            .filter { isAcceptable(it.scheme, it.authority, ownAuthority) }
            .distinct()
            .take(MediaPicker.MAX_BATCH_ITEMS)
        if (uris.isNotEmpty()) pending = uris
    }

    /** The waiting files, cleared as they are read, so each share imports at most once. */
    @Synchronized
    fun take(): List<Uri> {
        val current = pending
        pending = emptyList()
        return current
    }

    /** Pure, so the trust rule is unit-testable without an `Intent`. */
    fun isAcceptable(scheme: String?, authority: String?, ownAuthority: String): Boolean =
        scheme == "content" && !authority.isNullOrEmpty() && authority != ownAuthority

    fun isMediaType(type: String?): Boolean =
        type != null && (type == "*/*" || ACCEPTED_TYPE_PREFIXES.any { type.startsWith(it) })

    private fun extract(intent: Intent): List<Uri> {
        if (!isMediaType(intent.type)) return emptyList()
        return when (intent.action) {
            Intent.ACTION_SEND -> listOfNotNull(streamExtra(intent))
            Intent.ACTION_SEND_MULTIPLE -> streamListExtra(intent)
            else -> emptyList()
        }
    }

    @Suppress("DEPRECATION")
    private fun streamExtra(intent: Intent): Uri? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }

    @Suppress("DEPRECATION")
    private fun streamListExtra(intent: Intent): List<Uri> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
        }.orEmpty()
}
