package com.aslam.mediareminder.reminders

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * DL-080 action validation. The allowed/blocked cases mirror
 * `src/features/reminders/__tests__/reminderActions.test.ts` so the editor's
 * instant feedback and the save path never disagree.
 */
class ReminderActionRulesTest {

    @Test
    fun `no type means no action, whatever else is sent`() {
        assertEquals(ReminderActionRules.Result.Ok(null), ReminderActionRules.validate(null, "https://x.com", "Go"))
        assertEquals(ReminderActionRules.Result.Ok(null), ReminderActionRules.validate(" ", null, null))
    }

    @Test
    fun `unknown type is rejected`() {
        assertEquals(ReminderActionRules.Result.Invalid("action.type"), ReminderActionRules.validate("run_shell", "https://x.com", null))
    }

    @Test
    fun `valid link is trimmed and a blank label becomes null`() {
        val result = ReminderActionRules.validate("open_link", "  https://www.youtube.com/watch?v=abc  ", "   ")
        assertEquals(
            ReminderActionRules.Result.Ok(ReminderAction("open_link", "https://www.youtube.com/watch?v=abc", null)),
            result,
        )
    }

    @Test
    fun `label is kept and length-capped`() {
        val ok = ReminderActionRules.validate("open_link", "https://x.com", " Start lesson ")
        assertEquals("Start lesson", (ok as ReminderActionRules.Result.Ok).action?.label)
        val tooLong = ReminderActionRules.validate("open_link", "https://x.com", "x".repeat(41))
        assertEquals(ReminderActionRules.Result.Invalid("action.label"), tooLong)
    }

    @Test
    fun `allowed links`() {
        listOf(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "http://example.com",
            "https://open.spotify.com/track/abc",
            "spotify:track:6rqhFgbbKwnb9MLmUQDhG6",
            "tel:+6591234567",
            "mailto:me@example.com",
            "geo:1.29,103.85?q=gym",
            "sms:+6591234567",
            "https://maps.app.goo.gl/abc",
            "https://ja.wikipedia.org/wiki/日本語",
            "duolingo://lesson",
        ).forEach { assertTrue(it, ReminderActionRules.isAllowedUri(it)) }
    }

    @Test
    fun `blocked or malformed links`() {
        listOf(
            "",
            "javascript:alert(1)",
            "JavaScript:alert(1)",
            "file:///sdcard/secret.jpg",
            "content://com.aslam.mediareminder.fileprovider/x",
            "intent://scan/#Intent;scheme=zxing;package=com.x;end",
            "data:text/html,hi",
            "https://",
            "https:///path",
            "https://exa mple.com",
            "no scheme here",
            "youtube.com/watch?v=x",
            "tel:12",
            "mailto:nobody",
            "1http://x.com",
            "https://example.com/" + "a".repeat(2048),
        ).forEach { assertFalse(it, ReminderActionRules.isAllowedUri(it)) }
    }

    @Test
    fun `invalid uri reports the uri field`() {
        val result = ReminderActionRules.validate("open_link", "file:///etc/hosts", null)
        assertEquals(ReminderActionRules.Result.Invalid("action.uri"), result)
        assertNull((ReminderActionRules.validate(null, null, null) as ReminderActionRules.Result.Ok).action)
    }
}
