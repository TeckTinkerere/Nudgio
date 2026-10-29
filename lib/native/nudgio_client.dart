import 'dart:convert';
import 'dart:math';

import 'package:flutter/services.dart';

import '../core/errors/app_error.dart';
import '../core/errors/error_codes.dart';
import '../core/errors/to_app_error.dart';
import '../core/logging/logger.dart';
import '../core/result.dart';
import 'host_contract.dart';
import 'nudgio_host.dart';
import 'types.dart';
import 'wire.dart';

/// Typed client over a [NudgioHost], ported from `MediaReminderClient.ts`.
///
/// Everything MR-08 and MR-18 require to happen exactly once lives here:
///  - normalize rejections into an [AppError], never leaking a native message;
///  - runtime-decode payloads ([WireReader]);
///  - check the bridge contract version;
///  - log each call's method, outcome and latency, never its arguments.
///
/// Every method returns a [Result]; nothing throws for an expected failure.
class NudgioClient {
  NudgioClient({
    required this.host,
    required this.logger,
    String Function()? newCorrelationId,
    this.strictContractVersion = false,
  }) : _newCorrelationId = newCorrelationId ?? randomUuidV4;

  final NudgioHost host;
  final Logger logger;
  final String Function() _newCorrelationId;

  /// MR-08: a mismatch is a hard developer error in debug builds.
  final bool strictContractVersion;

  Future<Result<T>> _call<T>(String method, Map<String, Object?> arguments, T Function(Object? raw) decode) async {
    assert(hostMethods.containsKey(method), 'Unknown host method $method');
    final started = DateTime.now();
    final result = await attempt(
      () async => decode(await host.invoke(method, arguments)),
      (cause) => switch (cause) {
        MissingPluginException() => bridgeUnavailableError(_newCorrelationId()),
        WireFormatException(:final path) => AppError.create(
            code: ErrorCode.contractMismatch,
            messageKey: 'error.unexpected',
            category: ErrorCategory.internal,
            correlationId: _newCorrelationId(),
            retryable: false,
            field: path,
          ),
        _ => toAppError(cause, fallbackCorrelationId: _newCorrelationId()),
      },
    );
    logger.debug('bridge.call', {
      'method': method,
      'ok': result.isOk,
      'durationMs': DateTime.now().difference(started).inMilliseconds,
      if (result case Err(:final error)) 'code': error.code,
    });
    return result;
  }

  static T Function(Object?) _object<T>(String type, T Function(WireReader r) decode) =>
      (raw) => decode(WireReader(raw, type));

  static List<T> Function(Object?) _listOf<T>(String type, T Function(WireReader r) decode) => (raw) {
        if (raw is! List) throw WireFormatException(type);
        return [for (var i = 0; i < raw.length; i++) decode(WireReader(raw[i], '$type[$i]'))];
      };

  // --- Startup, settings, capability ---------------------------------------------

  Future<Result<StartupSnapshot>> getStartupSnapshot() async {
    final result = await _call('getStartupSnapshot', const {}, _object('StartupSnapshot', StartupSnapshot.fromWire));
    if (result case Ok(:final value) when value.contractVersion != bridgeContractVersion) {
      if (strictContractVersion) {
        throw StateError(
          'Bridge contract mismatch: Dart expects v$bridgeContractVersion, '
          'native reports v${value.contractVersion}. Rebuild the app.',
        );
      }
      logger.error('bridge.contractMismatch', {'expected': bridgeContractVersion, 'received': value.contractVersion});
      return Err(AppError.create(
        code: ErrorCode.contractMismatch,
        messageKey: 'error.updateRequired',
        category: ErrorCategory.internal,
        correlationId: _newCorrelationId(),
        retryable: false,
        safeDetails: {'expected': bridgeContractVersion, 'received': value.contractVersion},
      ));
    }
    return result;
  }

  Future<Result<CapabilitySnapshot>> getCapabilitySnapshot() =>
      _call('getCapabilitySnapshot', const {}, _object('CapabilitySnapshot', CapabilitySnapshot.fromWire));

  /// Deep-links to the OS settings screen for [kind]; resolves once launched.
  Future<Result<void>> openCapabilitySettings(String kind) =>
      _call('openCapabilitySettings', {'kind': kind}, (_) {});

  Future<Result<NotificationPermissionResult>> requestNotificationPermission() => _call(
        'requestNotificationPermission',
        const {},
        _object('NotificationPermissionResult', NotificationPermissionResult.fromWire),
      );

  Future<Result<PreferencesSnapshot>> getPreferences() =>
      _call('getPreferences', const {}, _object('PreferencesSnapshot', PreferencesSnapshot.fromWire));

  Future<Result<PreferencesSnapshot>> setPreferences(PreferencePatch patch) => _call(
        'setPreferences',
        {'patch': patch.toWire()},
        _object('PreferencesSnapshot', PreferencesSnapshot.fromWire),
      );

  /// DL-110 "Pause all" until [until], or null to resume. Reschedules natively.
  Future<Result<PreferencesSnapshot>> setPausedUntil(DateTime? until) => _call(
        'setPausedUntil',
        {'until': until == null ? null : instantToWire(until)},
        _object('PreferencesSnapshot', PreferencesSnapshot.fromWire),
      );

  /// Android 12+ system palette ramps, or null to use the brand palette
  /// (older Android, an OEM that omits a ramp, and always on iPhone).
  Future<Result<Map<String, Object?>?>> getDynamicColorScheme() => _call(
        'getDynamicColorScheme',
        const {},
        (raw) => raw == null ? null : Map<String, Object?>.from(raw is Map ? raw : throw const WireFormatException('DynamicColorScheme')),
      );

  Future<Result<StatisticsSummary>> getStatistics(int rangeDays) =>
      _call('getStatistics', {'rangeDays': rangeDays}, _object('StatisticsSummary', StatisticsSummary.fromWire));

  // --- Reminders ------------------------------------------------------------------

  Future<Result<WirePage<ReminderSummary>>> listReminders() => _call(
        'listReminders',
        const {},
        (raw) => WirePage.fromWire(WireReader(raw, 'ReminderPage'), ReminderSummary.fromWire),
      );

  Future<Result<ReminderDetail>> getReminder(String id) =>
      _call('getReminder', {'id': id}, _object('ReminderDetail', ReminderDetail.fromWire));

  Future<Result<SaveReminderResult>> saveReminder(SaveReminderRequest request) => _call(
        'saveReminder',
        {'request': request.toWire()},
        _object('SaveReminderResult', SaveReminderResult.fromWire),
      );

  Future<Result<EnableResult>> setReminderEnabled(String id, {required bool enabled}) =>
      _call('setReminderEnabled', {'id': id, 'enabled': enabled}, _object('EnableResult', EnableResult.fromWire));

  /// DL-110 "Skip next"; `skip: false` undoes it.
  Future<Result<EnableResult>> skipNextOccurrence(String id, {required bool skip}) =>
      _call('skipNextOccurrence', {'id': id, 'skip': skip}, _object('EnableResult', EnableResult.fromWire));

  Future<Result<MutationResult>> deleteReminder(String id) =>
      _call('deleteReminder', {'id': id}, _object('MutationResult', MutationResult.fromWire));

  Future<Result<TestReminderResult>> scheduleTestReminder(TestReminderRequest request) => _call(
        'scheduleTestReminder',
        {'request': request.toWire()},
        _object('TestReminderResult', TestReminderResult.fromWire),
      );

  Future<Result<List<ReminderProfile>>> listProfiles() =>
      _call('listProfiles', const {}, _listOf('ReminderProfile', ReminderProfile.fromWire));

  /// DL-082: moments the user never saw in the last [hours], newest first.
  Future<Result<List<MissedMoment>>> listRecentlyMissed(int hours) =>
      _call('listRecentlyMissed', {'hours': hours}, _listOf('MissedMoment', MissedMoment.fromWire));

  /// Drains the one-slot "Play asked to open this" handoff. Null when empty.
  Future<Result<PendingReminderOpen?>> takePendingMediaOpen() => _call('takePendingMediaOpen', const {}, (raw) {
        final r = WireReader(raw ?? const <String, Object?>{}, 'PendingReminderOpen');
        final reminderId = r.stringOrNull('reminderId');
        final mediaId = r.stringOrNull('mediaId');
        return reminderId == null && mediaId == null
            ? null
            : PendingReminderOpen(reminderId: reminderId, mediaId: mediaId);
      });

  // --- Due actions ------------------------------------------------------------------

  Future<Result<ActionResult>> playDueSession(String sessionId, String nonce) => _call(
        'playDueSession',
        {'sessionId': sessionId, 'nonce': nonce},
        _object('ActionResult', ActionResult.fromWire),
      );

  Future<Result<ActionResult>> snoozeDueSession(String sessionId, int minutes, String nonce) => _call(
        'snoozeDueSession',
        {'sessionId': sessionId, 'minutes': minutes, 'nonce': nonce},
        _object('ActionResult', ActionResult.fromWire),
      );

  Future<Result<ActionResult>> dismissDueSession(String sessionId, String nonce) => _call(
        'dismissDueSession',
        {'sessionId': sessionId, 'nonce': nonce},
        _object('ActionResult', ActionResult.fromWire),
      );

  // --- Library ------------------------------------------------------------------------

  Future<Result<WirePage<MediaSummary>>> listMedia(MediaQuery query) => _call(
        'listMedia',
        {'query': query.toWire()},
        (raw) => WirePage.fromWire(WireReader(raw, 'MediaPage'), MediaSummary.fromWire),
      );

  Future<Result<MediaDetail>> getMedia(String id) =>
      _call('getMedia', {'id': id}, _object('MediaDetail', MediaDetail.fromWire));

  /// The folder command bus (`LibraryService.kt`). JSON both ways, as the
  /// native side already speaks it; `library_albums.dart` decodes snapshots.
  Future<Result<Object?>> libraryCommand(Map<String, Object?> request) => _call(
        'libraryCommand',
        {'requestJson': jsonEncode(request)},
        (raw) => raw is String ? jsonDecode(raw) : throw const WireFormatException('libraryCommand'),
      );

  Future<Result<MediaDetail>> updateMedia(UpdateMediaRequest request) =>
      _call('updateMedia', {'request': request.toWire()}, _object('MediaDetail', MediaDetail.fromWire));

  Future<Result<MutationResult>> deleteMedia(DeleteMediaRequest request) =>
      _call('deleteMedia', {'request': request.toWire()}, _object('MutationResult', MutationResult.fromWire));

  Future<Result<MediaDetail>> replaceMediaSource(ReplaceMediaSourceRequest request) =>
      _call('replaceMediaSource', {'request': request.toWire()}, _object('MediaDetail', MediaDetail.fromWire));

  Future<Result<MediaStorageUsage>> getMediaStorageUsage() =>
      _call('getMediaStorageUsage', const {}, _object('MediaStorageUsage', MediaStorageUsage.fromWire));

  Future<Result<MutationResult>> exportMediaAssets(List<String> ids) =>
      _call('exportMediaAssets', {'ids': ids}, _object('MutationResult', MutationResult.fromWire));

  Future<Result<MutationResult>> shareLibrarySelection(List<String> mediaIds, List<String> folderIds) => _call(
        'shareLibrarySelection',
        {'mediaIds': mediaIds, 'folderIds': folderIds},
        _object('MutationResult', MutationResult.fromWire),
      );

  Future<Result<GallerySaveSummary>> saveLibrarySelectionToGallery(List<String> mediaIds, List<String> folderIds) =>
      _call(
        'saveLibrarySelectionToGallery',
        {'mediaIds': mediaIds, 'folderIds': folderIds},
        _object('GallerySaveSummary', GallerySaveSummary.fromWire),
      );

  Future<Result<MutationResult>> saveMediaCopyToGallery(String id) =>
      _call('saveMediaCopyToGallery', {'id': id}, _object('MutationResult', MutationResult.fromWire));

  // --- Import and pickers ----------------------------------------------------------------

  /// Ok(null), not an error, when the user backed out with no selection.
  Future<Result<PickedDocument?>> pickDocument(List<String> mimeTypes) => _call(
        'pickDocument',
        {'mimeTypes': mimeTypes},
        (raw) => raw == null ? null : PickedDocument.fromWire(WireReader(raw, 'PickedDocument')),
      );

  /// Ok([]) when the user backed out. Native clamps [maxItems] to its cap.
  Future<Result<List<PickedDocument>>> pickDocuments(List<String> mimeTypes, int maxItems) => _call(
        'pickDocuments',
        {'mimeTypes': mimeTypes, 'maxItems': maxItems},
        _listOf('PickedDocument', PickedDocument.fromWire),
      );

  /// DL-110 "Share to Nudgio": files shared in since the last call. Take-once.
  Future<Result<List<PickedDocument>>> takeSharedDocuments() =>
      _call('takeSharedDocuments', const {}, _listOf('PickedDocument', PickedDocument.fromWire));

  /// Resolves once the file is copied, hashed, probed and stored. Progress
  /// arrives as [OperationProgressEvent]s of kind `import`.
  Future<Result<MediaDetail>> beginMediaImport(ImportRequest request) =>
      _call('beginMediaImport', {'request': request.toWire()}, _object('MediaDetail', MediaDetail.fromWire));

  Future<Result<MutationResult>> cancelOperation(String id) =>
      _call('cancelOperation', {'id': id}, _object('MutationResult', MutationResult.fromWire));

  // --- Alarm tone -----------------------------------------------------------------------

  /// Ok(null) when the user backed out; a null `uri` means "Default".
  Future<Result<PickedRingtone?>> pickAlarmRingtone(String? currentUri) => _call(
        'pickAlarmRingtone',
        {'currentUri': currentUri},
        (raw) => raw == null ? null : PickedRingtone.fromWire(WireReader(raw, 'PickedRingtone')),
      );

  Future<Result<MutationResult>> previewAlarmRingtone(String? uri) =>
      _call('previewAlarmRingtone', {'uri': uri}, _object('MutationResult', MutationResult.fromWire));

  Future<Result<MutationResult>> stopAlarmRingtonePreview() =>
      _call('stopAlarmRingtonePreview', const {}, _object('MutationResult', MutationResult.fromWire));

  // --- Backup -------------------------------------------------------------------------------

  Future<Result<ExportResult>> beginExport() =>
      _call('beginExport', {'request': const {'scope': 'all'}}, _object('ExportResult', ExportResult.fromWire));

  Future<Result<MutationResult>> shareBackupExport(String fileName) =>
      _call('shareBackupExport', {'fileName': fileName}, _object('MutationResult', MutationResult.fromWire));

  Future<Result<BackupInspection>> inspectBackup(String uriToken) =>
      _call('inspectBackup', {'uriToken': uriToken}, _object('BackupInspection', BackupInspection.fromWire));

  Future<Result<MutationResult>> commitImport(ImportCommitRequest request) =>
      _call('commitImport', {'request': request.toWire()}, _object('MutationResult', MutationResult.fromWire));

  // --- Events ---------------------------------------------------------------------------------

  /// Decoded host events. A malformed event is logged and dropped: events are
  /// display hints, and the native journal stays the source of truth.
  Stream<HostEvent> get events => host.events.expand((Object? raw) {
        try {
          final r = WireReader(raw, 'HostEvent');
          final payload = r.object('payload');
          return switch (r.string('event')) {
            HostEventName.operationProgress => [OperationProgressEvent.fromWire(payload)],
            HostEventName.reminderDueWhileForeground => [ReminderDueEvent.fromWire(payload)],
            _ => const <HostEvent>[],
          };
        } on WireFormatException catch (error) {
          logger.warn('bridge.eventDropped', {'path': error.path});
          return const <HostEvent>[];
        }
      });
}

final _random = Random.secure();

/// A random RFC 4122 version-4 UUID (correlation and command ids).
String randomUuidV4() {
  final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-${hex.substring(20)}';
}
