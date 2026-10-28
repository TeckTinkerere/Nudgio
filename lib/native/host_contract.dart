/// The host contract: every method name and its argument keys, in one place.
///
/// Both native hosts dispatch on exactly these strings: Android in
/// `bridge/NudgioHostChannel.kt`, iPhone in `NudgioKernel/HostDispatcher.swift`.
/// `contract/host_methods.json` is generated from [hostMethods] by
/// `test/native/host_contract_test.dart` and checked by the Kotlin and Swift
/// test suites, so a method one side does not answer fails CI instead of
/// failing on a phone.
///
/// Why a method channel and not Pigeon: see DL-121. Arguments are always a
/// map of named values so adding an optional argument is not a breaking
/// change, mirroring how the TurboModule spec grew.
library;

/// Bridge contract version, reported natively in `StartupSnapshot`. A
/// mismatch means the Dart and native halves of one app came from different
/// builds (MR-08 "Versioning rules").
const bridgeContractVersion = 1;

const hostChannelName = 'nudgio/host';
const eventChannelName = 'nudgio/events';

/// Method name → argument keys, in call order.
const Map<String, List<String>> hostMethods = {
  'libraryCommand': ['requestJson'],
  'getStartupSnapshot': [],
  'getCapabilitySnapshot': [],
  'getPreferences': [],
  'setPreferences': ['patch'],
  'getDynamicColorScheme': [],
  'listMedia': ['query'],
  'getMedia': ['id'],
  'listProfiles': [],
  'pickDocument': ['mimeTypes'],
  'pickDocuments': ['mimeTypes', 'maxItems'],
  'pickAlarmRingtone': ['currentUri'],
  'previewAlarmRingtone': ['uri'],
  'stopAlarmRingtonePreview': [],
  'listReminders': [],
  'getReminder': ['id'],
  'saveReminder': ['request'],
  'setReminderEnabled': ['id', 'enabled'],
  'skipNextOccurrence': ['id', 'skip'],
  'setPausedUntil': ['until'],
  'takeSharedDocuments': [],
  'deleteReminder': ['id'],
  'scheduleTestReminder': ['request'],
  'listRecentlyMissed': ['hours'],
  'playDueSession': ['sessionId', 'nonce'],
  'snoozeDueSession': ['sessionId', 'minutes', 'nonce'],
  'dismissDueSession': ['sessionId', 'nonce'],
  'beginExport': ['request'],
  'shareBackupExport': ['fileName'],
  'inspectBackup': ['uriToken'],
  'commitImport': ['request'],
  'cancelOperation': ['id'],
  'beginMediaImport': ['request'],
  'updateMedia': ['request'],
  'deleteMedia': ['request'],
  'exportMediaAssets': ['ids'],
  'shareLibrarySelection': ['mediaIds', 'folderIds'],
  'saveLibrarySelectionToGallery': ['mediaIds', 'folderIds'],
  'replaceMediaSource': ['request'],
  'saveMediaCopyToGallery': ['id'],
  'getMediaStorageUsage': [],
  'requestNotificationPermission': [],
  'saveProfile': ['request'],
  'resetBuiltInProfile': ['id'],
  'openCapabilitySettings': ['kind'],
  'takePendingMediaOpen': [],
  'getStatistics': ['rangeDays'],
};

/// Event names carried on [eventChannelName] as `{event, payload}` maps.
abstract final class HostEventName {
  static const operationProgress = 'operationProgress';
  static const reminderDueWhileForeground = 'reminderDueWhileForeground';
}
