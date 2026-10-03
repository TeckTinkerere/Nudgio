package com.aslam.mediareminder.data.db.dao

import androidx.room.*
import com.aslam.mediareminder.data.db.entity.*

@Dao
interface LibraryDao {
    @Query("SELECT * FROM library_folders ORDER BY pinned DESC, name COLLATE NOCASE, id")
    suspend fun folders(): List<LibraryFolderEntity>
    @Insert(onConflict = OnConflictStrategy.ABORT) suspend fun insert(folder: LibraryFolderEntity)
    @Update suspend fun update(folder: LibraryFolderEntity)
    @Query("DELETE FROM library_folders WHERE id = :id") suspend fun delete(id: String)
    @Query("DELETE FROM library_folders") suspend fun clearFolders()
    @Query("SELECT * FROM library_memberships") suspend fun memberships(): List<LibraryMembershipEntity>
    @Query("SELECT * FROM library_memberships WHERE media_id IN (:ids)") suspend fun membershipsFor(ids: List<String>): List<LibraryMembershipEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun assign(row: LibraryMembershipEntity)
    @Query("DELETE FROM library_memberships WHERE media_id IN (:ids)") suspend fun unassign(ids: List<String>)
    @Query("UPDATE library_memberships SET folder_id = :parent WHERE folder_id = :child") suspend fun moveToParent(child: String, parent: String)
    @Query("SELECT * FROM library_state WHERE id = 1") suspend fun state(): LibraryStateEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun setState(state: LibraryStateEntity)
    @Query("SELECT folder_id AS folderId, COUNT(*) AS count FROM library_memberships GROUP BY folder_id") suspend fun counts(): List<FolderCount>

    /** Album covers: the newest items filed in any of [folderIds] (a folder plus its subfolders). */
    @Query("SELECT m.* FROM media_assets m JOIN library_memberships lm ON lm.media_id = m.id WHERE lm.folder_id IN (:folderIds) ORDER BY m.created_at DESC LIMIT :limit")
    suspend fun newestIn(folderIds: List<String>, limit: Int): List<MediaAssetEntity>

    /** Cover for the virtual Unsorted album. */
    @Query("SELECT * FROM media_assets WHERE id NOT IN (SELECT media_id FROM library_memberships) ORDER BY created_at DESC LIMIT :limit")
    suspend fun newestUnsorted(limit: Int): List<MediaAssetEntity>
    data class FolderCount(val folderId: String, val count: Int)
}
