package com.aslam.mediareminder.media

import com.aslam.mediareminder.data.db.entity.LibraryFolderEntity
import com.aslam.mediareminder.data.db.entity.LibraryMembershipEntity
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity

/** A media file chosen for sharing or saving, with the Library folders it sits under. */
data class PlannedFile(val asset: MediaAssetEntity, val folderPath: List<String>)

/** A [PlannedFile] with its final, filesystem-safe, collision-free place. */
data class NamedFile(val asset: MediaAssetEntity, val directory: List<String>, val fileName: String) {
    /** `Folder/Sub/name.ext`, or just the name for a file chosen on its own. */
    val path: String get() = (directory + fileName).joinToString("/")
}

/**
 * Turns a Library selection (loose media plus whole folders) into the list of
 * files to share or save, pure so the folder rules are testable on the JVM.
 *
 * - A selected folder brings every item filed in it and in its subfolders,
 *   under that folder's own name (`Holidays/Beach/pic.jpg`); the folder
 *   chosen is the root, whatever its depth in the Library.
 * - If a folder and its subfolder are both selected the subfolder is not a
 *   second root, so nothing appears twice.
 * - Media chosen individually sits at the top level, whichever folder it is
 *   filed in: the user picked that file, not its folder.
 * - A file reached both ways is listed once, in its folder.
 * - [UNSORTED_ID] is the Library's virtual "Unsorted" album: everything filed
 *   nowhere.
 */
object SelectionPlanner {

    const val UNSORTED_ID = "unsorted"
    const val UNSORTED_NAME = "Unsorted"

    fun plan(
        mediaIds: Collection<String>,
        folderIds: Collection<String>,
        folders: List<LibraryFolderEntity>,
        memberships: List<LibraryMembershipEntity>,
        assets: List<MediaAssetEntity>,
    ): List<PlannedFile> {
        val assetsById = assets.associateBy { it.id }
        val homeOf = memberships.associate { it.mediaId to it.folderId }
        val folderById = folders.associateBy { it.id }
        val childrenOf = folders.groupBy { it.parentId }
        val selected = folderIds.toSet()
        val planned = LinkedHashMap<String, PlannedFile>()

        // Roots only: a selected folder whose parent is also selected is
        // reached through the parent, with the longer path.
        val roots = folderIds.distinct().filter { id ->
            id == UNSORTED_ID || (folderById[id]?.let { it.parentId == null || it.parentId !in selected } == true)
        }

        for (rootId in roots) {
            if (rootId == UNSORTED_ID) {
                assets.filter { it.id !in homeOf }.forEach { planned.putIfAbsent(it.id, PlannedFile(it, listOf(UNSORTED_NAME))) }
                continue
            }
            val root = folderById.getValue(rootId)
            val queue = ArrayDeque<Pair<LibraryFolderEntity, List<String>>>()
            queue.addLast(root to listOf(root.name))
            while (queue.isNotEmpty()) {
                val (folder, path) = queue.removeFirst()
                memberships.filter { it.folderId == folder.id }.forEach { membership ->
                    assetsById[membership.mediaId]?.let { planned.putIfAbsent(it.id, PlannedFile(it, path)) }
                }
                childrenOf[folder.id].orEmpty().forEach { child -> queue.addLast(child to path + child.name) }
            }
        }

        mediaIds.distinct().forEach { id ->
            assetsById[id]?.let { planned.putIfAbsent(it.id, PlannedFile(it, emptyList())) }
        }
        return planned.values.toList()
    }

    /**
     * Gives every planned file a safe folder path and a file name that is
     * unique within its directory (case-insensitively, so the result also
     * extracts cleanly on Windows and macOS).
     */
    fun nameFiles(planned: List<PlannedFile>): List<NamedFile> {
        val used = HashMap<String, MutableSet<String>>()
        return planned.map { file ->
            val directory = file.folderPath.map { SafeNames.segment(it, FOLDER_FALLBACK) }
            val taken = used.getOrPut(directory.joinToString("/").lowercase()) { mutableSetOf() }
            val wanted = MediaStoreExporter.displayNameFor(file.asset.title, file.asset.storageKey)
            NamedFile(file.asset, directory, SafeNames.unique(taken, wanted))
        }
    }

    private const val FOLDER_FALLBACK = "Folder"
}

/** Filesystem-safe names, shared by the gallery export and the share zip. */
object SafeNames {
    private val SAFE_PUNCTUATION = setOf(' ', '-', '_', ',', '(', ')')
    private const val MAX_SEGMENT = 80

    /**
     * One path segment: every character outside a conservative allowlist
     * becomes `-`, so a title can never carry a separator, a traversal
     * sequence or a leading dot; the result is capped well under any
     * filesystem limit and is never empty.
     */
    fun segment(raw: String, fallback: String): String =
        raw
            .map { if (it.isLetterOrDigit() || it in SAFE_PUNCTUATION) it else '-' }
            .joinToString("")
            .trim()
            .trim('.', '-')
            .take(MAX_SEGMENT)
            .ifBlank { fallback }

    /**
     * [name], or `name (1).ext`, `name (2).ext`... if [taken] already holds it
     * (compared case-insensitively). Records the chosen name in [taken].
     */
    fun unique(taken: MutableSet<String>, name: String): String {
        val stem = name.substringBeforeLast('.', name)
        val extension = name.substringAfterLast('.', "")
        var candidate = name
        var counter = 1
        while (!taken.add(candidate.lowercase())) {
            candidate = if (extension.isEmpty() || stem == name) "$stem ($counter)" else "$stem ($counter).$extension"
            counter += 1
        }
        return candidate
    }
}
