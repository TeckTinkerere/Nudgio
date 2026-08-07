package com.aslam.mediareminder.backup

import androidx.core.content.FileProvider
import com.aslam.mediareminder.R

/**
 * MR-10 "Sharing and privacy": "The app never grants a whole directory" —
 * a named subclass (rather than registering `androidx.core.content.FileProvider`
 * directly) exists only so the manifest authority reads as this app's own
 * component, matching [BackupExporter]'s and every other native component's
 * naming. All the real behavior is `androidx.core.content.FileProvider`'s;
 * `res/xml/file_paths.xml` is what actually scopes the grant to the
 * `backups/` export directory alone.
 */
class MediaReminderFileProvider : FileProvider(R.xml.file_paths)
