package com.aslam.mediareminder.bridge

/**
 * Every `nudgio/host` method name with its argument keys, in call order: the
 * Kotlin copy of `contract/host_methods.json` (generated from
 * `lib/native/host_contract.dart`). Plain Kotlin with no Flutter types, so
 * `HostMethodsContractTest` can compare it with the file on the JVM.
 */
object HostMethods {
    val ARGUMENTS: Map<String, List<String>> = linkedMapOf(
        "libraryCommand" to listOf("requestJson"),
        "getStartupSnapshot" to emptyList(),
        "getCapabilitySnapshot" to emptyList(),
        "getPreferences" to emptyList(),
        "setPreferences" to listOf("patch"),
        "getDynamicColorScheme" to emptyList(),
        "listMedia" to listOf("query"),
        "getMedia" to listOf("id"),
        "listProfiles" to emptyList(),
        "pickDocument" to listOf("mimeTypes"),
        "pickDocuments" to listOf("mimeTypes", "maxItems"),
        "pickAlarmRingtone" to listOf("currentUri"),
        "previewAlarmRingtone" to listOf("uri"),
        "stopAlarmRingtonePreview" to emptyList(),
        "listReminders" to emptyList(),
        "getReminder" to listOf("id"),
        "saveReminder" to listOf("request"),
        "setReminderEnabled" to listOf("id", "enabled"),
        "skipNextOccurrence" to listOf("id", "skip"),
        "setPausedUntil" to listOf("until"),
        "takeSharedDocuments" to emptyList(),
        "deleteReminder" to listOf("id"),
        "scheduleTestReminder" to listOf("request"),
        "listRecentlyMissed" to listOf("hours"),
        "playDueSession" to listOf("sessionId", "nonce"),
        "snoozeDueSession" to listOf("sessionId", "minutes", "nonce"),
        "dismissDueSession" to listOf("sessionId", "nonce"),
        "beginExport" to listOf("request"),
        "shareBackupExport" to listOf("fileName"),
        "inspectBackup" to listOf("uriToken"),
        "commitImport" to listOf("request"),
        "cancelOperation" to listOf("id"),
        "beginMediaImport" to listOf("request"),
        "updateMedia" to listOf("request"),
        "deleteMedia" to listOf("request"),
        "exportMediaAssets" to listOf("ids"),
        "shareLibrarySelection" to listOf("mediaIds", "folderIds"),
        "saveLibrarySelectionToGallery" to listOf("mediaIds", "folderIds"),
        "replaceMediaSource" to listOf("request"),
        "saveMediaCopyToGallery" to listOf("id"),
        "getMediaStorageUsage" to emptyList(),
        "requestNotificationPermission" to emptyList(),
        "saveProfile" to listOf("request"),
        "resetBuiltInProfile" to listOf("id"),
        "openCapabilitySettings" to listOf("kind"),
        "takePendingMediaOpen" to emptyList(),
        "getStatistics" to listOf("rangeDays"),
    )

    val NAMES: Set<String> get() = ARGUMENTS.keys

    /** Reported in `StartupSnapshot.contractVersion`; `bridgeContractVersion` in Dart. */
    const val CONTRACT_VERSION = 1
}
