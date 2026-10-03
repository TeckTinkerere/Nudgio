package com.aslam.mediareminder.reminders

import java.net.URI
import java.net.URISyntaxException
import java.util.Locale

/** The optional "what next" a reminder offers once it is opened (DL-080). */
data class ReminderAction(
    val type: String,
    val uri: String,
    /** User-chosen button text, e.g. "Start lesson". Null means "derive one from the link". */
    val label: String?,
)

/**
 * The single validation point for [ReminderAction] — used by the save path
 * and by backup import, so a malformed or unsafe action can never reach Room
 * by either route. Pure Kotlin (no `android.net.Uri`), JVM-testable.
 *
 * One action type exists today, `open_link`: an `ACTION_VIEW` of a URI. That
 * single type covers web pages, YouTube/Spotify/Maps app links, `tel:`,
 * `mailto:`, `geo:`, `sms:` and other apps' own deep-link schemes, because
 * Android routes each to whichever installed app claims it. A future type
 * (say, "start a timer") is a new [TYPE_*] constant plus a launcher — never a
 * schema change.
 *
 * Schemes that would let a reminder reach *into* this or another app's
 * private data, run script, or smuggle an explicit component are refused:
 * see [BLOCKED_SCHEMES].
 */
object ReminderActionRules {
    const val TYPE_OPEN_LINK = "open_link"

    const val MAX_URI_LENGTH = 2048
    const val MAX_LABEL_LENGTH = 40

    private val SCHEME = Regex("^[a-zA-Z][a-zA-Z0-9+.-]*$")

    private val BLOCKED_SCHEMES = setOf(
        "javascript", "file", "content", "intent", "data", "about", "blob",
        "android.resource", "jar", "vbscript",
    )

    sealed class Result {
        /** `action == null` means "no action" — a valid, common choice. */
        data class Ok(val action: ReminderAction?) : Result()
        data class Invalid(val field: String) : Result()
    }

    /**
     * @param type `null`/blank means "no action"; the other two are then ignored.
     */
    fun validate(type: String?, uri: String?, label: String?): Result {
        if (type.isNullOrBlank()) return Result.Ok(null)
        if (type != TYPE_OPEN_LINK) return Result.Invalid("action.type")

        val trimmedUri = uri?.trim().orEmpty()
        if (!isAllowedUri(trimmedUri)) return Result.Invalid("action.uri")

        val trimmedLabel = label?.trim()?.takeIf { it.isNotEmpty() }
        if (trimmedLabel != null && trimmedLabel.length > MAX_LABEL_LENGTH) return Result.Invalid("action.label")

        return Result.Ok(ReminderAction(TYPE_OPEN_LINK, trimmedUri, trimmedLabel))
    }

    fun isAllowedUri(uri: String): Boolean {
        if (uri.isEmpty() || uri.length > MAX_URI_LENGTH) return false
        if (uri.any { it.isWhitespace() || it.isISOControl() }) return false

        val colon = uri.indexOf(':')
        if (colon <= 0) return false
        val scheme = uri.substring(0, colon)
        if (!SCHEME.matches(scheme)) return false
        val normalizedScheme = scheme.lowercase(Locale.ROOT)
        if (normalizedScheme in BLOCKED_SCHEMES) return false

        val rest = uri.substring(colon + 1)
        if (rest.isEmpty()) return false

        val parsed = try {
            URI(uri)
        } catch (error: URISyntaxException) {
            return false
        }

        return when (normalizedScheme) {
            "http", "https" -> !parsed.host.isNullOrBlank()
            "tel" -> rest.count { it.isDigit() } >= 3
            "mailto" -> rest.contains('@')
            else -> true
        }
    }
}
