package com.aslam.mediareminder.data.db.entity

import androidx.room.*

@Entity(tableName = "library_folders", foreignKeys = [ForeignKey(entity = LibraryFolderEntity::class, parentColumns = ["id"], childColumns = ["parent_id"], onDelete = ForeignKey.CASCADE)], indices = [Index("parent_id")])
data class LibraryFolderEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "parent_id") val parentId: String?,
    val name: String,
    val pinned: Boolean = false,
)

@Entity(tableName = "library_memberships", foreignKeys = [
    ForeignKey(entity = MediaAssetEntity::class, parentColumns = ["id"], childColumns = ["media_id"], onDelete = ForeignKey.CASCADE),
    ForeignKey(entity = LibraryFolderEntity::class, parentColumns = ["id"], childColumns = ["folder_id"], onDelete = ForeignKey.CASCADE),
], indices = [Index("folder_id")])
data class LibraryMembershipEntity(
    @PrimaryKey @ColumnInfo(name = "media_id") val mediaId: String,
    @ColumnInfo(name = "folder_id") val folderId: String,
)

@Entity(tableName = "library_state")
data class LibraryStateEntity(@PrimaryKey val id: Int = 1, val revision: Long = 0, val undo: String? = null, val receipts: String = "[]")
