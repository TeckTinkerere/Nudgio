package com.aslam.mediareminder.data.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity

/**
 * Builds the SQL for MR-08's `MediaQuery` against MR-09's `media_assets`.
 *
 * Pure by design: no Android imports, no Room, no `Context`. Filter and sort
 * behavior is the part most likely to be wrong (an accidental `OR` that widens
 * a filter, a sort that silently falls back, a `LIKE` that lets `%` through
 * from user input), and keeping it pure means all of that is covered by plain
 * JVM unit tests rather than requiring an emulator — MR-14's testing pyramid
 * puts this kind of logic at the unit level.
 *
 * The list and count queries are built from one shared `WHERE` so they can
 * never disagree, which is what would make `Page.total`/`hasMore` lie.
 */
object MediaQuerySql {

    /** MR-08 `MediaQuery.sort` values. Anything else is rejected, not defaulted. */
    const val SORT_RECENT = "recent"
    const val SORT_NAME = "name"
    const val SORT_MOST_SCHEDULED = "mostScheduled"
    const val SORT_SIZE = "size"

    /** Bounds the page size so a hostile or buggy caller cannot ask for everything. */
    const val MAX_LIMIT = 200
    const val DEFAULT_LIMIT = 50

    data class Criteria(
        val search: String? = null,
        val kinds: List<String> = emptyList(),
        val categoryId: String? = null,
        val onlyMissing: Boolean = false,
        val sort: String = SORT_RECENT,
        val offset: Int = 0,
        val limit: Int = DEFAULT_LIMIT,
    )

    data class Sql(val sql: String, val args: List<Any?>)

    /**
     * `ORDER BY` fragment for a validated sort key.
     *
     * Concatenated into SQL rather than bound, because a bound parameter cannot
     * be an ORDER BY column. That makes this the one injection-sensitive spot in
     * the builder, so the mapping is an exhaustive `when` over known constants
     * and an unrecognized key throws instead of falling through to a default —
     * a caller sending garbage is a bug to surface, and silently sorting by
     * something else would hide it.
     *
     * `mostScheduled` orders by a correlated count of non-archived reminders
     * referencing the asset, matching MR-08's "mostScheduled" intent and the
     * `activeReminderCount` the DTO exposes.
     */
    fun orderBy(sort: String): String = when (sort) {
        SORT_RECENT -> "ORDER BY created_at DESC, id ASC"
        // NOCASE so "apple" and "Apple" sort together (MR-13: user-visible
        // ordering must not depend on capitalization).
        SORT_NAME -> "ORDER BY title COLLATE NOCASE ASC, id ASC"
        SORT_SIZE -> "ORDER BY size_bytes DESC, id ASC"
        SORT_MOST_SCHEDULED ->
            """
            ORDER BY (
                SELECT COUNT(*) FROM reminders r
                WHERE r.media_id = media_assets.id
                  AND r.effective_state = '${ReminderEntity.STATE_ACTIVE}'
            ) DESC, created_at DESC, id ASC
            """.trimIndent()
        else -> throw IllegalArgumentException("Unsupported media sort: $sort")
    }

    /**
     * Shared `WHERE` clause plus its bound arguments.
     *
     * Every filter is additive (`AND`) and omitted entirely when unset, rather
     * than emitted as `(:arg IS NULL OR ...)`. That keeps the statement free of
     * unused predicates so SQLite can still use the MR-09 indices.
     */
    fun where(criteria: Criteria): Sql {
        val clauses = mutableListOf<String>()
        val args = mutableListOf<Any?>()

        criteria.search
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?.let { term ->
                // ESCAPE '\' with the wildcards escaped below: without it a
                // user typing "100%" would match every row, and "_" would
                // match any single character.
                clauses += "(title LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')"
                val pattern = "%${escapeLike(term)}%"
                args += pattern
                args += pattern
            }

        criteria.kinds
            .filter { it in MediaAssetEntity.KINDS }
            .takeIf { it.isNotEmpty() }
            ?.let { kinds ->
                clauses += "kind IN (${kinds.joinToString(",") { "?" }})"
                // addAll, not `+=`: with a Collection operand Kotlin cannot
                // choose between `plusAssign` and `plus`-then-reassign, and
                // reports it as "'val' cannot be reassigned".
                args.addAll(kinds)
            }

        criteria.categoryId?.let {
            clauses += "category_id = ?"
            args += it
        }

        if (criteria.onlyMissing) {
            // MR-08 `onlyMissing` is the Library's "needs attention" filter, so
            // it means "the bytes are not known-good", not literally
            // integrity_state = 'missing'. `changed` and `unsupported` are also
            // unplayable and must surface here or they would be invisible.
            clauses += "integrity_state IN (?, ?, ?)"
            args += MediaAssetEntity.INTEGRITY_MISSING
            args += MediaAssetEntity.INTEGRITY_CHANGED
            args += MediaAssetEntity.INTEGRITY_UNSUPPORTED
        }

        val sql = if (clauses.isEmpty()) "" else "WHERE ${clauses.joinToString(" AND ")}"
        return Sql(sql, args)
    }

    /** Page of rows for the Library list. */
    fun page(criteria: Criteria): Sql {
        val filter = where(criteria)
        val limit = criteria.limit.coerceIn(1, MAX_LIMIT)
        val offset = criteria.offset.coerceAtLeast(0)

        val sql = buildString {
            append("SELECT * FROM media_assets ")
            if (filter.sql.isNotEmpty()) {
                append(filter.sql).append(' ')
            }
            append(orderBy(criteria.sort)).append(' ')
            append("LIMIT ? OFFSET ?")
        }
        return Sql(sql, filter.args + listOf(limit, offset))
    }

    /** Total matching rows, ignoring limit/offset, for `Page.total` and `hasMore`. */
    fun count(criteria: Criteria): Sql {
        val filter = where(criteria)
        val sql = buildString {
            append("SELECT COUNT(*) FROM media_assets")
            if (filter.sql.isNotEmpty()) {
                append(' ').append(filter.sql)
            }
        }
        return Sql(sql, filter.args)
    }

    /**
     * Escapes SQL `LIKE` wildcards in user input using `\` as the escape
     * character. The backslash itself must be escaped first, otherwise
     * escaping `%` would produce a sequence this function then re-escapes.
     */
    fun escapeLike(term: String): String = term
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
}
