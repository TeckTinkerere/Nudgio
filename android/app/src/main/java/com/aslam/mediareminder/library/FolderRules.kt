package com.aslam.mediareminder.library

import java.text.Normalizer
import java.util.Locale

/** Pure constraints shared by interactive edits and archive validation. */
object FolderRules {
    data class Folder(val id: String, val parentId: String?, val name: String, val pinned: Boolean = false)
    fun name(value: String): String {
        val result = Normalizer.normalize(value, Normalizer.Form.NFC).trim().replace(Regex("[\\s\\p{Z}]+"), " ")
        require(result.codePointCount(0, result.length) in 1..60) { "Folder names need 1–60 characters." }
        require(result.none { Character.isISOControl(it) }) { "Folder names cannot contain control characters." }
        return result
    }
    fun key(value: String): String = name(value).uppercase(Locale.ROOT).lowercase(Locale.ROOT)
    fun validate(folders: List<Folder>) {
        require(folders.size <= 500) { "The library supports up to 500 folders." }
        require(folders.count { it.pinned } <= 8) { "You can pin up to eight folders." }
        val byId = folders.associateBy { it.id }
        require(byId.size == folders.size) { "Duplicate folder ID." }
        val siblings = mutableSetOf<Pair<String?, String>>()
        folders.forEach { folder ->
            require(siblings.add(folder.parentId to key(folder.name))) { "A folder with that name already exists here." }
            folder.parentId?.let { parent ->
                require(parent != folder.id && byId.containsKey(parent) && byId[parent]?.parentId == null) {
                    "Only one level of subfolders is supported."
                }
            }
        }
    }
}
