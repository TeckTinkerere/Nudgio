package com.aslam.mediareminder.data.db

import java.io.File
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The migration SQL cannot run on the JVM (no SQLite), so these tests pin the
 * properties that matter and that a careless edit could break. The behaviour
 * itself — rows kept, children kept with foreign keys on and off — was run
 * against real SQLite while writing DL-118 and is re-checked on a device in the
 * release checklist.
 */
class Migration8To9Test {

    private val statements = Migration8To9.STATEMENTS

    private fun indexOf(prefix: String): Int {
        val i = statements.indexOfFirst { it.trimStart().startsWith(prefix) }
        assertTrue("missing statement: $prefix", i >= 0)
        return i
    }

    /** Room's own export of the v9 schema is the reference for the new table. */
    private fun roomRemindersTable(): JSONObject {
        val file = File("schemas/com.aslam.mediareminder.data.db.MediaReminderDatabase/9.json")
        assertTrue("run from the :app module; missing ${file.absolutePath}", file.exists())
        val entities = JSONObject(file.readText()).getJSONObject("database").getJSONArray("entities")
        for (i in 0 until entities.length()) {
            val entity = entities.getJSONObject(i)
            if (entity.getString("tableName") == "reminders") return entity
        }
        error("reminders not in 9.json")
    }

    @Test
    fun schemaVersionIsNine() {
        assertEquals(9, MediaReminderDatabase.SCHEMA_VERSION)
        assertEquals(8, MIGRATION_8_9.startVersion)
        assertEquals(9, MIGRATION_8_9.endVersion)
    }

    @Test
    fun childrenAreCopiedAsideBeforeTheDropAndRestoredAfterTheRename() {
        val drop = indexOf("DROP TABLE `reminders`")
        val rename = indexOf("ALTER TABLE `reminders_new` RENAME TO `reminders`")
        for (child in listOf("schedule_rules", "occurrences", "active_alarm_session")) {
            val stash = indexOf("CREATE TABLE `_mig9_$child`")
            val restore = indexOf("INSERT OR IGNORE INTO `$child`")
            assertTrue("$child must be stashed before the drop", stash < drop)
            assertTrue("$child must be restored after the rename", restore > rename)
            assertTrue("stash table for $child must be removed", statements.any { it.contains("DROP TABLE `_mig9_$child`") })
        }
    }

    @Test
    fun parentsAreRestoredBeforeTheirChildren() {
        // active_alarm_session references occurrences, so occurrences go first.
        assertTrue(indexOf("INSERT OR IGNORE INTO `occurrences`") < indexOf("INSERT OR IGNORE INTO `active_alarm_session`"))
    }

    @Test
    fun rowsAreCopiedBeforeTheOldTableIsDropped() {
        assertTrue(indexOf("INSERT INTO `reminders_new`") < indexOf("DROP TABLE `reminders`"))
    }

    @Test
    fun newTableMakesMediaIdNullableAndKeepsEveryOtherColumn() {
        val create = statements[indexOf("CREATE TABLE `reminders_new`")]
        assertTrue("media_id must be nullable", Regex("`media_id` TEXT,").containsMatchIn(create))
        assertTrue(!create.contains("`media_id` TEXT NOT NULL"))

        val roomColumns = roomRemindersTable().getJSONArray("fields").let { fields ->
            (0 until fields.length()).map { fields.getJSONObject(it).getString("columnName") }.toSet()
        }
        val migrationColumns = Regex("`(\\w+)` (?:TEXT|INTEGER)").findAll(create).map { it.groupValues[1] }.toSet()
        assertEquals("migration and Room's v9 table must have the same columns", roomColumns, migrationColumns)
    }

    @Test
    fun everyIndexRoomExpectsIsRecreated() {
        val indices = roomRemindersTable().getJSONArray("indices")
        for (i in 0 until indices.length()) {
            val expected = indices.getJSONObject(i).getString("createSql")
                .replace("\${TABLE_NAME}", "reminders")
                .replace(Regex("\\s+"), " ")
            assertTrue(
                "index not recreated by the migration: $expected",
                statements.any { it.replace(Regex("\\s+"), " ") == expected },
            )
        }
    }
}
