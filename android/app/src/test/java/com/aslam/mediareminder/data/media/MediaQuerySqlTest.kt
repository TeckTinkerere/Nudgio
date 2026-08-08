package com.aslam.mediareminder.data.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for MR-08 `MediaQuery` -> SQL translation.
 *
 * These run as plain JVM tests precisely because [MediaQuerySql] has no Android
 * dependency. The cases below target the failure modes that would silently
 * return wrong rows rather than crash: a filter that widens instead of narrows,
 * a `Page.total` that disagrees with the page it describes, and unescaped
 * `LIKE` wildcards coming from the search box.
 */
class MediaQuerySqlTest {

    @Test
    fun `no criteria emits no WHERE clause`() {
        val sql = MediaQuerySql.page(MediaQuerySql.Criteria())

        assertFalse("unfiltered query must not emit WHERE", sql.sql.contains("WHERE"))
        // Only LIMIT and OFFSET are bound.
        assertEquals(listOf<Any?>(MediaQuerySql.DEFAULT_LIMIT, 0), sql.args)
    }

    @Test
    fun `filters combine with AND, never OR`() {
        val sql = MediaQuerySql.where(
            MediaQuerySql.Criteria(
                search = "dua",
                kinds = listOf(MediaAssetEntity.KIND_VIDEO),
                categoryId = "cat-1",
                onlyMissing = true,
            ),
        )

        // Three ANDs joining four predicates. An accidental OR here would make
        // every filter widen the result set instead of narrowing it.
        assertEquals(3, Regex(" AND ").findAll(sql.sql).count())
        assertTrue(sql.sql.startsWith("WHERE "))
    }

    @Test
    fun `search escapes LIKE wildcards so percent is literal`() {
        val sql = MediaQuerySql.where(MediaQuerySql.Criteria(search = "100%"))

        // Without escaping, "100%" would match every row in the table.
        assertEquals(listOf<Any?>("%100\\%%", "%100\\%%"), sql.args)
        assertTrue(sql.sql.contains("ESCAPE '\\'"))
    }

    @Test
    fun `escapeLike escapes backslash before wildcards`() {
        // Backslash first, otherwise escaping % would produce a sequence that
        // then gets re-escaped into a different string.
        assertEquals("\\\\", MediaQuerySql.escapeLike("\\"))
        assertEquals("\\_\\%", MediaQuerySql.escapeLike("_%"))
    }

    @Test
    fun `blank search is ignored rather than matching everything`() {
        assertEquals("", MediaQuerySql.where(MediaQuerySql.Criteria(search = "   ")).sql)
        assertEquals("", MediaQuerySql.where(MediaQuerySql.Criteria(search = "")).sql)
    }

    @Test
    fun `unknown kinds are dropped and do not emit an empty IN clause`() {
        // An `IN ()` is a syntax error in SQLite, so a caller sending only
        // garbage kinds must produce no clause at all, not a broken one.
        val sql = MediaQuerySql.where(MediaQuerySql.Criteria(kinds = listOf("hologram")))

        assertEquals("", sql.sql)
        assertEquals(emptyList<Any?>(), sql.args)
    }

    @Test
    fun `known kinds bind one placeholder each`() {
        val sql = MediaQuerySql.where(
            MediaQuerySql.Criteria(
                kinds = listOf(MediaAssetEntity.KIND_VIDEO, MediaAssetEntity.KIND_AUDIO, "nope"),
            ),
        )

        assertTrue(sql.sql.contains("kind IN (?,?)"))
        assertEquals(
            listOf<Any?>(MediaAssetEntity.KIND_VIDEO, MediaAssetEntity.KIND_AUDIO),
            sql.args,
        )
    }

    @Test
    fun `onlyMissing covers every not-known-good state`() {
        val sql = MediaQuerySql.where(MediaQuerySql.Criteria(onlyMissing = true))

        // `changed` and `unsupported` are equally unplayable; if this filter
        // only matched `missing` they would be invisible to the user.
        assertEquals(
            listOf<Any?>(
                MediaAssetEntity.INTEGRITY_MISSING,
                MediaAssetEntity.INTEGRITY_CHANGED,
                MediaAssetEntity.INTEGRITY_UNSUPPORTED,
            ),
            sql.args,
        )
        assertFalse(
            "healthy media must never match the needs-attention filter",
            sql.args.contains(MediaAssetEntity.INTEGRITY_HEALTHY),
        )
    }

    @Test
    fun `count and page share identical filter arguments`() {
        val criteria = MediaQuerySql.Criteria(
            search = "morning",
            kinds = listOf(MediaAssetEntity.KIND_AUDIO),
            onlyMissing = true,
            limit = 10,
            offset = 20,
        )

        val page = MediaQuerySql.page(criteria)
        val count = MediaQuerySql.count(criteria)

        // The page's args are the filter args plus limit/offset. If these ever
        // diverge, `Page.total` and `hasMore` describe a different result set
        // than the rows actually returned.
        assertEquals(count.args, page.args.dropLast(2))
        assertEquals(listOf<Any?>(10, 20), page.args.takeLast(2))
        assertFalse("count must not paginate", count.sql.contains("LIMIT"))
    }

    @Test
    fun `limit is clamped and offset cannot go negative`() {
        val tooBig = MediaQuerySql.page(MediaQuerySql.Criteria(limit = 10_000, offset = -5))
        assertEquals(listOf<Any?>(MediaQuerySql.MAX_LIMIT, 0), tooBig.args)

        val zero = MediaQuerySql.page(MediaQuerySql.Criteria(limit = 0))
        assertEquals(listOf<Any?>(1, 0), zero.args)
    }

    @Test
    fun `every supported sort is total and deterministic`() {
        // A tie on the primary sort key must fall back to a unique column, or
        // paging with LIMIT/OFFSET can repeat or skip rows between pages.
        val sorts = listOf(
            MediaQuerySql.SORT_RECENT,
            MediaQuerySql.SORT_NAME,
            MediaQuerySql.SORT_SIZE,
            MediaQuerySql.SORT_MOST_SCHEDULED,
        )
        sorts.forEach { sort ->
            val orderBy = MediaQuerySql.orderBy(sort)
            assertTrue("$sort must start with ORDER BY", orderBy.startsWith("ORDER BY"))
            assertTrue("$sort must tie-break on id", orderBy.contains("id ASC"))
        }
    }

    @Test
    fun `name sort is case-insensitive`() {
        assertTrue(MediaQuerySql.orderBy(MediaQuerySql.SORT_NAME).contains("COLLATE NOCASE"))
    }

    @Test
    fun `unknown sort throws instead of silently defaulting`() {
        // Concatenated into SQL rather than bound, so an unrecognized value is
        // both an injection risk and a caller bug worth surfacing.
        assertThrows(IllegalArgumentException::class.java) {
            MediaQuerySql.orderBy("id; DROP TABLE media_assets")
        }
    }

    @Test
    fun `mostScheduled counts only active reminders`() {
        val orderBy = MediaQuerySql.orderBy(MediaQuerySql.SORT_MOST_SCHEDULED)

        assertTrue(orderBy.contains("FROM reminders"))
        assertTrue(orderBy.contains("r.effective_state = 'active'"))
        // Guards the bug this test was written after: comparing a reminder's
        // state against a *media integrity* state, which is always true.
        assertFalse(orderBy.contains(MediaAssetEntity.INTEGRITY_HEALTHY))
    }
}
