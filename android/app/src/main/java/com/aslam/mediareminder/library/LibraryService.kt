package com.aslam.mediareminder.library

import androidx.room.withTransaction
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** All folder mutations are atomic and compare the revision the user saw. */
class LibraryService(private val db: MediaReminderDatabase) {
    suspend fun command(encoded: String): String {
        require(encoded.length <= 65536) { "Library request is too large." }
        val request = JSONObject(encoded)
        return db.withTransaction {
            val dao = db.libraryDao()
            val state = dao.state() ?: LibraryStateEntity()
            val action = request.getString("action")
            if (action != "list") {
                val commandId = request.getString("commandId")
                UUID.fromString(commandId)
                val now = System.currentTimeMillis()
                val oldReceipts = JSONArray(state.receipts)
                val receipts = (0 until oldReceipts.length()).map { oldReceipts.getJSONObject(it) }
                    .filter { now - it.getLong("at") < 86_400_000 }
                if (receipts.any { it.getString("id") == commandId }) return@withTransaction snapshot().toString()
                require(request.getLong("revision") == state.revision) { "Your library changed. Refresh and try again." }
                var undo: String? = null
                val folders = dao.folders()
                when (action) {
                    "create", "rename", "pin", "reparent" -> {
                        val old = if (action == "create") null else folders.find { it.id == request.getString("id") }
                            ?: error("Folder no longer exists.")
                        val folder = LibraryFolderEntity(
                            id = old?.id ?: UUID.randomUUID().toString(),
                            parentId = if (action == "reparent") request.optionalString("parentId") else old?.parentId ?: request.optionalString("parentId"),
                            name = if (action == "pin" || action == "reparent") old!!.name else FolderRules.name(request.getString("name")),
                            pinned = if (action == "pin") request.getBoolean("pinned") else old?.pinned ?: false,
                        )
                        FolderRules.validate((folders.filter { it.id != folder.id } + folder).map { it.rule() })
                        if (old == null) dao.insert(folder) else dao.update(folder)
                    }
                    "delete" -> {
                        val folder = folders.find { it.id == request.getString("id") } ?: error("Folder no longer exists.")
                        // Subfolder items return to their parent. Main-folder items and children become Unsorted via FK cascade.
                        folder.parentId?.let { dao.moveToParent(folder.id, it) }
                        dao.delete(folder.id)
                    }
                    "move" -> {
                        val items = request.getJSONArray("items")
                        require(items.length() in 1..200) { "Select 1–200 items to move." }
                        val ids = (0 until items.length()).map { items.getJSONObject(it).getString("id") }
                        require(ids.distinct().size == ids.size) { "Duplicate selection." }
                        val media = db.mediaDao().getByIds(ids).associateBy { it.id }
                        require(media.size == ids.size) { "Some selected media no longer exists." }
                        for (i in 0 until items.length()) {
                            val item = items.getJSONObject(i)
                            require(media[item.getString("id")]?.entityVersion == item.getInt("version")) { "Selected media changed. Select it again." }
                        }
                        val destination = request.optionalString("destination")
                        require(destination == null || folders.any { it.id == destination }) { "Destination no longer exists." }
                        val before = dao.membershipsFor(ids).associateBy { it.mediaId }
                        val rows = JSONArray(ids.map { id -> JSONObject().put("id", id).put("folder", before[id]?.folderId ?: JSONObject.NULL).put("version", media.getValue(id).entityVersion) })
                        dao.unassign(ids)
                        if (destination != null) ids.forEach { dao.assign(LibraryMembershipEntity(it, destination)) }
                        undo = JSONObject().put("at", now).put("rows", rows).toString()
                    }
                    "undo" -> {
                        val saved = state.undo?.let { JSONObject(it) } ?: error("There is no move to undo.")
                        require(now - saved.getLong("at") in 0..600_000) { "This move can no longer be undone." }
                        val rows = saved.getJSONArray("rows")
                        val ids = (0 until rows.length()).map { rows.getJSONObject(it).getString("id") }
                        val media = db.mediaDao().getByIds(ids).associateBy { it.id }
                        require(media.size == ids.size) { "Some moved media no longer exists." }
                        for (i in 0 until rows.length()) {
                            val row = rows.getJSONObject(i)
                            require(media[row.getString("id")]?.entityVersion == row.getInt("version")) { "Moved media changed; undo is unavailable." }
                            val folder = row.optionalString("folder")
                            require(folder == null || folders.any { it.id == folder }) { "Original folder no longer exists." }
                        }
                        dao.unassign(ids)
                        for (i in 0 until rows.length()) {
                            val row = rows.getJSONObject(i)
                            row.optionalString("folder")?.let { dao.assign(LibraryMembershipEntity(row.getString("id"), it)) }
                        }
                    }
                    else -> error("Unknown library action.")
                }
                val nextReceipts = JSONArray((receipts + JSONObject().put("id", commandId).put("at", now)).takeLast(32))
                dao.setState(state.copy(revision = state.revision + 1, undo = undo, receipts = nextReceipts.toString()))
            }
            snapshot().toString()
        }
    }

    private suspend fun snapshot(): JSONObject {
        val dao = db.libraryDao()
        val folders = dao.folders()
        val counts = dao.counts().associate { it.folderId to it.count }
        val state = dao.state() ?: LibraryStateEntity()
        val total = db.mediaDao().count()
        return JSONObject().put("revision", state.revision).put("total", total)
            .put("unsorted", total - counts.values.sum())
            .put("canUndo", state.undo?.let { System.currentTimeMillis() - JSONObject(it).getLong("at") in 0..600_000 } ?: false)
            .put("folders", JSONArray(folders.map { f ->
                JSONObject().put("id", f.id).put("parentId", f.parentId ?: JSONObject.NULL).put("name", f.name).put("pinned", f.pinned)
                    .put("directCount", counts[f.id] ?: 0)
                    .put("count", (counts[f.id] ?: 0) + folders.filter { it.parentId == f.id }.sumOf { counts[it.id] ?: 0 })
            }))
    }
}

fun LibraryFolderEntity.rule() = FolderRules.Folder(id, parentId, name, pinned)
fun JSONObject.optionalString(key: String): String? = if (!has(key) || isNull(key)) null else getString(key)
