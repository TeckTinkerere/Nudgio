package com.aslam.mediareminder.data.db

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val MIGRATION_5_6 = object : Migration(5, 6) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS library_folders (id TEXT NOT NULL PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, pinned INTEGER NOT NULL, FOREIGN KEY(parent_id) REFERENCES library_folders(id) ON UPDATE NO ACTION ON DELETE CASCADE)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_library_folders_parent_id ON library_folders(parent_id)")
        db.execSQL("CREATE TABLE IF NOT EXISTS library_memberships (media_id TEXT NOT NULL PRIMARY KEY, folder_id TEXT NOT NULL, FOREIGN KEY(media_id) REFERENCES media_assets(id) ON UPDATE NO ACTION ON DELETE CASCADE, FOREIGN KEY(folder_id) REFERENCES library_folders(id) ON UPDATE NO ACTION ON DELETE CASCADE)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_library_memberships_folder_id ON library_memberships(folder_id)")
        db.execSQL("CREATE TABLE IF NOT EXISTS library_state (id INTEGER NOT NULL PRIMARY KEY, revision INTEGER NOT NULL, undo TEXT, receipts TEXT NOT NULL)")
        db.execSQL("INSERT INTO library_state VALUES (1, 0, NULL, '[]')")
    }
}
