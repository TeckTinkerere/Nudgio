/// Host data transfer objects (MR-08), ported from `src/native-client/types.ts`.
///
/// Wire rules carried over unchanged:
///  - UUIDs are lowercase canonical strings;
///  - instants are UTC ISO-8601 strings, decoded to UTC [DateTime]s;
///  - byte sizes are decimal strings, decoded to [BigInt];
///  - no field carries a filesystem path, an Android URI or a PendingIntent.
///    `thumbnailToken`/`sourceToken` are opaque app-local tokens; only
///    `media_tokens.dart` may turn one into something loadable.
///
/// Each type decodes itself with `fromWire`; request types encode with
/// `toWire`. A reminder's `mediaId` is nullable (schema v9, DL-118).
library;

import 'wire.dart';

enum ResultStatus { ok, limited, needsAction }

String resultStatusWire(ResultStatus status) => switch (status) {
      ResultStatus.ok => 'ok',
      ResultStatus.limited => 'limited',
      ResultStatus.needsAction => 'needs_action',
    };

ResultStatus _status(WireReader r, String key) => r.enumValue(key, ResultStatus.values, resultStatusWire);

final class NamedRef {
  const NamedRef({required this.id, required this.name});
  factory NamedRef.fromWire(WireReader r) => NamedRef(id: r.string('id'), name: r.string('name'));
  final String id;
  final String name;
}

final class Page<T> {
  const Page({required this.items, required this.total, required this.offset, required this.hasMore});

  factory Page.fromWire(WireReader r, T Function(WireReader item) decode) => Page(
        items: r.list('items', decode),
        total: r.integer('total'),
        offset: r.integer('offset'),
        hasMore: r.boolean('hasMore'),
      );

  final List<T> items;
  final int total;
  final int offset;
  final bool hasMore;
}

// --- Media ---------------------------------------------------------------------

enum MediaKind { video, audio, image, text }

MediaKind _mediaKind(WireReader r, String key) => r.enumValue(key, MediaKind.values, (k) => k.name);

enum IntegrityState { healthy, unchecked, missing, changed, unsupported }

class MediaSummary {
  const MediaSummary({
    required this.id,
    required this.kind,
    required this.title,
    required this.sizeBytes,
    required this.sourceToken,
    required this.tags,
    required this.activeReminderCount,
    required this.integrity,
    required this.createdAt,
    this.durationMs,
    this.thumbnailToken,
    this.widthPx,
    this.heightPx,
    this.category,
  });

  factory MediaSummary.fromWire(WireReader r) => MediaSummary(
        id: r.string('id'),
        kind: _mediaKind(r, 'kind'),
        title: r.string('title'),
        durationMs: r.intOrNull('durationMs'),
        sizeBytes: r.bytes('sizeBytes'),
        thumbnailToken: r.stringOrNull('thumbnailToken'),
        sourceToken: r.string('sourceToken'),
        widthPx: r.intOrNull('widthPx'),
        heightPx: r.intOrNull('heightPx'),
        category: r.objectOrNull('category')?.let(NamedRef.fromWire),
        tags: r.list('tags', NamedRef.fromWire),
        activeReminderCount: r.integer('activeReminderCount'),
        integrity: r.enumValue('integrity', IntegrityState.values, (s) => s.name),
        createdAt: r.instant('createdAt'),
      );

  final String id;
  final MediaKind kind;
  final String title;
  final int? durationMs;
  final BigInt sizeBytes;
  final String? thumbnailToken;

  /// Always present, even when [integrity] is `missing`: check [integrity]
  /// before offering playback, not this field's presence.
  final String sourceToken;
  final int? widthPx;
  final int? heightPx;
  final NamedRef? category;
  final List<NamedRef> tags;
  final int activeReminderCount;
  final IntegrityState integrity;
  final DateTime createdAt;
}

final class MediaDetail extends MediaSummary {
  const MediaDetail({
    required super.id,
    required super.kind,
    required super.title,
    required super.sizeBytes,
    required super.sourceToken,
    required super.tags,
    required super.activeReminderCount,
    required super.integrity,
    required super.createdAt,
    required this.mimeType,
    required this.updatedAt,
    required this.entityVersion,
    super.durationMs,
    super.thumbnailToken,
    super.widthPx,
    super.heightPx,
    super.category,
    this.notes,
  });

  factory MediaDetail.fromWire(WireReader r) {
    final summary = MediaSummary.fromWire(r);
    return MediaDetail(
      id: summary.id,
      kind: summary.kind,
      title: summary.title,
      durationMs: summary.durationMs,
      sizeBytes: summary.sizeBytes,
      thumbnailToken: summary.thumbnailToken,
      sourceToken: summary.sourceToken,
      widthPx: summary.widthPx,
      heightPx: summary.heightPx,
      category: summary.category,
      tags: summary.tags,
      activeReminderCount: summary.activeReminderCount,
      integrity: summary.integrity,
      createdAt: summary.createdAt,
      notes: r.stringOrNull('notes'),
      mimeType: r.string('mimeType'),
      updatedAt: r.instant('updatedAt'),
      entityVersion: r.integer('entityVersion'),
    );
  }

  final String? notes;
  final String mimeType;
  final DateTime updatedAt;
  final int entityVersion;
}

enum MediaLocation { all, unsorted, folder }

enum MediaSort { recent, name, mostScheduled, size }

final class MediaQuery {
  const MediaQuery({
    this.search,
    this.location,
    this.folderId,
    this.kinds,
    this.categoryId,
    this.onlyMissing,
    this.onlyUnused,
    this.sort,
    this.offset,
    this.limit,
  });

  final String? search;

  /// Folder views are database-scoped; omitted means every asset.
  final MediaLocation? location;
  final String? folderId;
  final List<MediaKind>? kinds;
  final String? categoryId;
  final bool? onlyMissing;

  /// DL-110: only media no reminder refers to.
  final bool? onlyUnused;
  final MediaSort? sort;
  final int? offset;
  final int? limit;

  Map<String, Object?> toWire() => wireMap({
        'search': search,
        'location': location?.name,
        'folderId': folderId,
        'kinds': kinds?.map((k) => k.name).toList(),
        'categoryId': categoryId,
        'onlyMissing': onlyMissing,
        'onlyUnused': onlyUnused,
        'sort': sort?.name,
        'offset': offset,
        'limit': limit,
      });
}

/// A file the user picked. [uriToken] is opaque: a `content://` URI on
/// Android, a staged-copy token on iPhone. Never a path to open directly.
final class PickedDocument {
  const PickedDocument({required this.uriToken, required this.mimeType, this.displayName, this.sizeBytes});

  factory PickedDocument.fromWire(WireReader r) => PickedDocument(
        uriToken: r.string('uriToken'),
        displayName: r.stringOrNull('displayName'),
        mimeType: r.string('mimeType'),
        sizeBytes: r.bytesOrNull('sizeBytes'),
      );

  final String uriToken;
  final String? displayName;
  final String mimeType;
  final BigInt? sizeBytes;

  ImportRequest toImportRequest() =>
      ImportRequest(sourceUri: uriToken, displayName: displayName, mimeType: mimeType, sizeBytes: sizeBytes);
}

final class ImportRequest {
  const ImportRequest({required this.sourceUri, required this.mimeType, this.displayName, this.sizeBytes});
  final String sourceUri;
  final String? displayName;
  final String mimeType;
  final BigInt? sizeBytes;

  Map<String, Object?> toWire() => wireMap({
        'sourceUri': sourceUri,
        'displayName': displayName,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes?.toString(),
      });
}

/// MR-03 "Edit details": an absent field means "leave it", not "clear it".
final class UpdateMediaRequest {
  const UpdateMediaRequest({required this.id, this.title, this.notes});
  final String id;
  final String? title;
  final String? notes;

  Map<String, Object?> toWire() => wireMap({'id': id, 'title': title, 'notes': notes});
}

/// `cascadeDeleteReminders: true` deletes attached reminders; otherwise they
/// are only disabled (no FK on `reminders.media_id`).
final class DeleteMediaRequest {
  const DeleteMediaRequest({required this.id, this.cascadeDeleteReminders = false});
  final String id;
  final bool cascadeDeleteReminders;

  Map<String, Object?> toWire() => {'id': id, 'cascadeDeleteReminders': cascadeDeleteReminders};
}

/// New bytes for an existing record; the id, title and notes are kept so one
/// replacement repairs every reminder pointing at it.
final class ReplaceMediaSourceRequest {
  const ReplaceMediaSourceRequest({
    required this.mediaId,
    required this.sourceUri,
    this.displayName,
    this.mimeType,
    this.sizeBytes,
  });

  final String mediaId;
  final String sourceUri;
  final String? displayName;
  final String? mimeType;
  final BigInt? sizeBytes;

  Map<String, Object?> toWire() => wireMap({
        'mediaId': mediaId,
        'sourceUri': sourceUri,
        'displayName': displayName,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes?.toString(),
      });
}

final class MediaStorageUsage {
  const MediaStorageUsage({
    required this.itemCount,
    required this.totalBytes,
    required this.unavailableCount,
    this.unusedCount,
    this.unusedBytes,
  });

  factory MediaStorageUsage.fromWire(WireReader r) => MediaStorageUsage(
        itemCount: r.integer('itemCount'),
        totalBytes: r.bytes('totalBytes'),
        unavailableCount: r.integer('unavailableCount'),
        unusedCount: r.intOrNull('unusedCount'),
        unusedBytes: r.bytesOrNull('unusedBytes'),
      );

  final int itemCount;
  final BigInt totalBytes;
  final int unavailableCount;
  final int? unusedCount;
  final BigInt? unusedBytes;
}

final class MutationResult {
  const MutationResult({required this.status, required this.affectedCount});

  /// `shareBackupExport` answers with `status` alone, so the count defaults.
  factory MutationResult.fromWire(WireReader r) =>
      MutationResult(status: _status(r, 'status'), affectedCount: r.intOrNull('affectedCount') ?? 0);

  final ResultStatus status;
  final int affectedCount;
}

final class GallerySaveSummary {
  const GallerySaveSummary({
    required this.status,
    required this.savedCount,
    required this.alreadySavedCount,
    required this.failedCount,
    required this.unsupportedCount,
  });

  factory GallerySaveSummary.fromWire(WireReader r) => GallerySaveSummary(
        status: _status(r, 'status'),
        savedCount: r.integer('savedCount'),
        alreadySavedCount: r.integer('alreadySavedCount'),
        failedCount: r.integer('failedCount'),
        unsupportedCount: r.integer('unsupportedCount'),
      );

  final ResultStatus status;
  final int savedCount;
  final int alreadySavedCount;
  final int failedCount;
  final int unsupportedCount;
}

// --- Reminders -------------------------------------------------------------------

/// MR-08's six-variant schedule rule. Every time field is the local wall-clock
/// value the user picked; DST and zone resolution happen natively, once.
sealed class ScheduleRule {
  const ScheduleRule();

  factory ScheduleRule.fromWire(WireReader r) => switch (r.string('type')) {
        'once' => OnceRule(instant: r.instant('instant'), originZone: r.stringOrNull('originZone') ?? 'UTC'),
        'daily' => DailyRule(localTime: r.string('localTime')),
        'weekdays' => WeekdaysRule(localTime: r.string('localTime'), isoWeekdays: r.ints('isoWeekdays')),
        'monthly' => MonthlyRule(localTime: r.string('localTime'), dayOfMonth: r.integer('dayOfMonth')),
        'yearly' => YearlyRule(
            localTime: r.string('localTime'),
            month: r.integer('month'),
            dayOfMonth: r.integer('dayOfMonth'),
          ),
        'custom' => CustomRule(
            localTime: r.string('localTime'),
            intervalDays: r.integer('intervalDays'),
            anchorDate: r.string('anchorDate'),
          ),
        _ => throw WireFormatException('${r.path}.type'),
      };

  Map<String, Object?> toWire();
}

final class OnceRule extends ScheduleRule {
  const OnceRule({required this.instant, required this.originZone});
  final DateTime instant;

  /// IANA zone the user picked the time in, e.g. `Asia/Singapore`.
  final String originZone;

  @override
  Map<String, Object?> toWire() => {'type': 'once', 'instant': instantToWire(instant), 'originZone': originZone};
}

final class DailyRule extends ScheduleRule {
  const DailyRule({required this.localTime});

  /// `HH:mm:ss`.
  final String localTime;

  @override
  Map<String, Object?> toWire() => {'type': 'daily', 'localTime': localTime, 'zonePolicy': 'follow_device'};
}

final class WeekdaysRule extends ScheduleRule {
  const WeekdaysRule({required this.localTime, required this.isoWeekdays});
  final String localTime;

  /// ISO-8601 weekday numbers, Monday = 1.
  final List<int> isoWeekdays;

  @override
  Map<String, Object?> toWire() =>
      {'type': 'weekdays', 'localTime': localTime, 'isoWeekdays': isoWeekdays, 'zonePolicy': 'follow_device'};
}

final class MonthlyRule extends ScheduleRule {
  const MonthlyRule({required this.localTime, required this.dayOfMonth});
  final String localTime;

  /// 1-31, clamped natively to the month's last day.
  final int dayOfMonth;

  @override
  Map<String, Object?> toWire() =>
      {'type': 'monthly', 'localTime': localTime, 'dayOfMonth': dayOfMonth, 'zonePolicy': 'follow_device'};
}

final class YearlyRule extends ScheduleRule {
  const YearlyRule({required this.localTime, required this.month, required this.dayOfMonth});
  final String localTime;
  final int month;
  final int dayOfMonth;

  @override
  Map<String, Object?> toWire() => {
        'type': 'yearly',
        'localTime': localTime,
        'month': month,
        'dayOfMonth': dayOfMonth,
        'zonePolicy': 'follow_device',
      };
}

final class CustomRule extends ScheduleRule {
  const CustomRule({required this.localTime, required this.intervalDays, required this.anchorDate});
  final String localTime;

  /// Every N days, N >= 1.
  final int intervalDays;

  /// `YYYY-MM-DD` the interval counts from.
  final String anchorDate;

  @override
  Map<String, Object?> toWire() => {
        'type': 'custom',
        'localTime': localTime,
        'intervalDays': intervalDays,
        'anchorDate': anchorDate,
        'zonePolicy': 'follow_device',
      };
}

/// DL-080: the optional "what next" button. One variant today, `open_link`.
final class ReminderAction {
  const ReminderAction({required this.uri, this.label});

  factory ReminderAction.fromWire(WireReader r) {
    if (r.string('type') != 'open_link') throw WireFormatException('${r.path}.type');
    return ReminderAction(uri: r.string('uri'), label: r.stringOrNull('label'));
  }

  final String uri;

  /// Custom button text; null means "derive one from the link".
  final String? label;

  Map<String, Object?> toWire() => {'type': 'open_link', 'uri': uri, 'label': label};

  @override
  bool operator ==(Object other) => other is ReminderAction && other.uri == uri && other.label == label;

  @override
  int get hashCode => Object.hash(uri, label);

  @override
  String toString() => 'ReminderAction($uri, label: $label)';
}

final class SnoozePolicy {
  const SnoozePolicy({
    required this.defaultMinutes,
    required this.allowCustom,
    required this.minimumMinutes,
    required this.maximumMinutes,
  });

  factory SnoozePolicy.fromWire(WireReader r) => SnoozePolicy(
        defaultMinutes: r.integer('defaultMinutes'),
        allowCustom: r.boolean('allowCustom'),
        minimumMinutes: r.integer('minimumMinutes'),
        maximumMinutes: r.integer('maximumMinutes'),
      );

  final int defaultMinutes;
  final bool allowCustom;
  final int minimumMinutes;
  final int maximumMinutes;

  Map<String, Object?> toWire() => {
        'defaultMinutes': defaultMinutes,
        'allowCustom': allowCustom,
        'minimumMinutes': minimumMinutes,
        'maximumMinutes': maximumMinutes,
      };
}

enum OccurrenceKind { base, snooze, retry, test }

enum OccurrenceState { pending, claimed, accepted, snoozed, dismissed, missed, timedOut, failedSafe }

String occurrenceStateWire(OccurrenceState state) => switch (state) {
      OccurrenceState.timedOut => 'timed_out',
      OccurrenceState.failedSafe => 'failed_safe',
      _ => state.name,
    };

final class OccurrenceSummary {
  const OccurrenceSummary({
    required this.id,
    required this.reminderId,
    required this.kind,
    required this.scheduledAt,
    required this.state,
  });

  factory OccurrenceSummary.fromWire(WireReader r) => OccurrenceSummary(
        id: r.string('id'),
        reminderId: r.string('reminderId'),
        kind: r.enumValue('kind', OccurrenceKind.values, (k) => k.name),
        scheduledAt: r.instant('scheduledAt'),
        state: r.enumValue('state', OccurrenceState.values, occurrenceStateWire),
      );

  final String id;
  final String reminderId;
  final OccurrenceKind kind;
  final DateTime scheduledAt;
  final OccurrenceState state;
}

enum ReminderEffectiveState { disabled, needsSetup, active, archived }

String effectiveStateWire(ReminderEffectiveState state) =>
    state == ReminderEffectiveState.needsSetup ? 'needs_setup' : state.name;

class ReminderSummary {
  const ReminderSummary({
    required this.id,
    required this.label,
    required this.mediaId,
    required this.mediaKind,
    required this.profileId,
    required this.enabledIntent,
    required this.effectiveState,
    required this.nextOccurrence,
    required this.repeatSummary,
    required this.schedule,
    this.action,
    this.thumbnailToken,
    this.sourceToken,
    this.mediaMissing = false,
    this.notes,
    this.skippedAt,
    this.mediaStartMs,
  });

  factory ReminderSummary.fromWire(WireReader r) => ReminderSummary(
        id: r.string('id'),
        label: r.string('label'),
        mediaId: r.stringOrNull('mediaId'),
        mediaKind: _mediaKind(r, 'mediaKind'),
        thumbnailToken: r.stringOrNull('thumbnailToken'),
        sourceToken: r.stringOrNull('sourceToken'),
        mediaMissing: r.boolOrNull('mediaMissing') ?? false,
        profileId: r.string('profileId'),
        enabledIntent: r.boolean('enabledIntent'),
        effectiveState: r.enumValue('effectiveState', ReminderEffectiveState.values, effectiveStateWire),
        nextOccurrence: r.objectOrNull('nextOccurrence')?.let(OccurrenceSummary.fromWire),
        repeatSummary: r.string('repeatSummary'),
        notes: r.stringOrNull('notes'),
        schedule: ScheduleRule.fromWire(r.object('schedule')),
        // A build older than DL-080 omits the key: the domain says null.
        action: r.objectOrNull('action')?.let(ReminderAction.fromWire),
        skippedAt: r.instantOrNull('skippedAt'),
        mediaStartMs: r.intOrNull('mediaStartMs'),
      );

  final String id;
  final String label;

  /// Null for an alarm with no attachment (DL-118); [mediaKind] is then only
  /// a placeholder.
  final String? mediaId;
  final MediaKind mediaKind;
  final String? thumbnailToken;
  final String? sourceToken;

  /// The media is no longer on disk; resolved from the filesystem on every
  /// read, so a sweep-disabled reminder is not mistaken for a paused one.
  final bool mediaMissing;
  final String profileId;
  final bool enabledIntent;
  final ReminderEffectiveState effectiveState;
  final OccurrenceSummary? nextOccurrence;

  /// Already localized natively (MR-13). Display as is.
  final String repeatSummary;

  /// Read-only here: every time the UI shows comes from [nextOccurrence].
  final ScheduleRule schedule;
  final ReminderAction? action;
  final String? notes;

  /// DL-110 "Skip next": the skipped occurrence, still ahead.
  final DateTime? skippedAt;

  /// DL-110: where playback starts, in ms. Null is the beginning.
  final int? mediaStartMs;
}

final class ReminderDetail extends ReminderSummary {
  const ReminderDetail({
    required super.id,
    required super.label,
    required super.mediaId,
    required super.mediaKind,
    required super.profileId,
    required super.enabledIntent,
    required super.effectiveState,
    required super.nextOccurrence,
    required super.repeatSummary,
    required super.schedule,
    required this.snooze,
    required this.historyEnabled,
    required this.createdAt,
    required this.updatedAt,
    required this.entityVersion,
    super.action,
    super.thumbnailToken,
    super.sourceToken,
    super.mediaMissing,
    super.notes,
    super.skippedAt,
    super.mediaStartMs,
  });

  factory ReminderDetail.fromWire(WireReader r) {
    final s = ReminderSummary.fromWire(r);
    return ReminderDetail(
      id: s.id,
      label: s.label,
      mediaId: s.mediaId,
      mediaKind: s.mediaKind,
      thumbnailToken: s.thumbnailToken,
      sourceToken: s.sourceToken,
      mediaMissing: s.mediaMissing,
      profileId: s.profileId,
      enabledIntent: s.enabledIntent,
      effectiveState: s.effectiveState,
      nextOccurrence: s.nextOccurrence,
      repeatSummary: s.repeatSummary,
      notes: s.notes,
      schedule: s.schedule,
      action: s.action,
      skippedAt: s.skippedAt,
      mediaStartMs: s.mediaStartMs,
      snooze: SnoozePolicy.fromWire(r.object('snooze')),
      historyEnabled: r.boolean('historyEnabled'),
      createdAt: r.instant('createdAt'),
      updatedAt: r.instant('updatedAt'),
      entityVersion: r.integer('entityVersion'),
    );
  }

  final SnoozePolicy snooze;
  final bool historyEnabled;
  final DateTime createdAt;
  final DateTime updatedAt;
  final int entityVersion;
}

/// `id` absent creates; present updates, with [entityVersion] as the
/// optimistic-concurrency token.
final class SaveReminderRequest {
  const SaveReminderRequest({
    required this.label,
    required this.schedule,
    required this.profileId,
    required this.snooze,
    required this.enabledIntent,
    this.id,
    this.entityVersion,
    this.mediaId,
    this.notes,
    this.historyEnabled,
    this.action,
    this.mediaStartMs,
  });

  final String? id;
  final int? entityVersion;

  /// Null saves an alarm with no attachment (DL-118).
  final String? mediaId;
  final String label;
  final String? notes;
  final ScheduleRule schedule;
  final String profileId;
  final SnoozePolicy snooze;
  final bool enabledIntent;
  final bool? historyEnabled;

  /// Null clears the action: the editor always sends the whole reminder.
  final ReminderAction? action;
  final int? mediaStartMs;

  Map<String, Object?> toWire() => {
        ...wireMap({'id': id, 'entityVersion': entityVersion, 'notes': notes, 'historyEnabled': historyEnabled}),
        'mediaId': mediaId,
        'label': label,
        'schedule': schedule.toWire(),
        'profileId': profileId,
        'snooze': snooze.toWire(),
        'enabledIntent': enabledIntent,
        'action': action?.toWire(),
        'mediaStartMs': mediaStartMs,
      };
}

final class CapabilityEvaluation {
  const CapabilityEvaluation({required this.status, this.effectKey});
  factory CapabilityEvaluation.fromWire(WireReader r) =>
      CapabilityEvaluation(status: _status(r, 'status'), effectKey: r.stringOrNull('effectKey'));
  final ResultStatus status;
  final String? effectKey;
}

final class SaveReminderResult {
  const SaveReminderResult({
    required this.reminder,
    required this.nextOccurrence,
    required this.capabilityResult,
    required this.schedulerGeneration,
  });

  factory SaveReminderResult.fromWire(WireReader r) => SaveReminderResult(
        reminder: ReminderDetail.fromWire(r.object('reminder')),
        nextOccurrence: r.objectOrNull('nextOccurrence')?.let(OccurrenceSummary.fromWire),
        capabilityResult: CapabilityEvaluation.fromWire(r.object('capabilityResult')),
        schedulerGeneration: r.string('schedulerGeneration'),
      );

  final ReminderDetail reminder;
  final OccurrenceSummary? nextOccurrence;
  final CapabilityEvaluation capabilityResult;
  final String schedulerGeneration;
}

final class EnableResult {
  const EnableResult({required this.reminder, required this.nextOccurrence});
  factory EnableResult.fromWire(WireReader r) => EnableResult(
        reminder: ReminderSummary.fromWire(r.object('reminder')),
        nextOccurrence: r.objectOrNull('nextOccurrence')?.let(OccurrenceSummary.fromWire),
      );
  final ReminderSummary reminder;
  final OccurrenceSummary? nextOccurrence;
}

/// Settings "Preview alarm styles". [title]/[body] are already localized.
final class TestReminderRequest {
  const TestReminderRequest({required this.title, required this.body, required this.fullScreenWhenLocked});
  final String title;
  final String body;
  final bool fullScreenWhenLocked;

  Map<String, Object?> toWire() => {'title': title, 'body': body, 'fullScreenWhenLocked': fullScreenWhenLocked};
}

final class TestReminderResult {
  const TestReminderResult({required this.sessionId, required this.scheduledAt});
  factory TestReminderResult.fromWire(WireReader r) =>
      TestReminderResult(sessionId: r.string('sessionId'), scheduledAt: r.instant('scheduledAt'));
  final String sessionId;
  final DateTime scheduledAt;
}

/// Which reminder Play asked to open; [mediaId] is the fallback when the
/// reminder is gone.
final class PendingReminderOpen {
  const PendingReminderOpen({required this.reminderId, required this.mediaId});
  final String? reminderId;
  final String? mediaId;
}

/// DL-082: a recent moment the user never saw.
final class MissedMoment {
  const MissedMoment({
    required this.occurrenceId,
    required this.reminderId,
    required this.scheduledAt,
    required this.state,
    required this.label,
    required this.mediaKind,
    this.thumbnailToken,
  });

  factory MissedMoment.fromWire(WireReader r) => MissedMoment(
        occurrenceId: r.string('occurrenceId'),
        reminderId: r.string('reminderId'),
        scheduledAt: r.instant('scheduledAt'),
        state: r.enumValue('state', OccurrenceState.values, occurrenceStateWire),
        label: r.string('label'),
        mediaKind: _mediaKind(r, 'mediaKind'),
        thumbnailToken: r.stringOrNull('thumbnailToken'),
      );

  final String occurrenceId;
  final String reminderId;
  final DateTime scheduledAt;
  final OccurrenceState state;
  final String label;
  final MediaKind mediaKind;
  final String? thumbnailToken;
}

// --- Profiles and statistics --------------------------------------------------------

final class ReminderProfile {
  const ReminderProfile({
    required this.id,
    required this.nameKey,
    required this.isBuiltIn,
    required this.fullScreenWhenLocked,
    required this.timeoutSeconds,
    required this.retryCount,
    required this.graceSeconds,
    required this.defaultSnoozeMinutes,
    required this.entityVersion,
  });

  factory ReminderProfile.fromWire(WireReader r) => ReminderProfile(
        id: r.string('id'),
        nameKey: r.string('nameKey'),
        isBuiltIn: r.boolean('isBuiltIn'),
        fullScreenWhenLocked: r.boolean('fullScreenWhenLocked'),
        timeoutSeconds: r.integer('timeoutSeconds'),
        retryCount: r.integer('retryCount'),
        graceSeconds: r.integer('graceSeconds'),
        defaultSnoozeMinutes: r.integer('defaultSnoozeMinutes'),
        entityVersion: r.integer('entityVersion'),
      );

  final String id;

  /// Localization key for built-ins; free text for user profiles.
  final String nameKey;
  final bool isBuiltIn;
  final bool fullScreenWhenLocked;
  final int timeoutSeconds;
  final int retryCount;
  final int graceSeconds;
  final int defaultSnoozeMinutes;
  final int entityVersion;
}

final class DailyOutcomeCount {
  const DailyOutcomeCount({required this.date, required this.completed, required this.dismissed, required this.missed});
  factory DailyOutcomeCount.fromWire(WireReader r) => DailyOutcomeCount(
        date: r.string('date'),
        completed: r.integer('completed'),
        dismissed: r.integer('dismissed'),
        missed: r.integer('missed'),
      );

  /// `yyyy-MM-dd`, local to the device.
  final String date;
  final int completed;
  final int dismissed;
  final int missed;
}

final class StatisticsSummary {
  const StatisticsSummary({
    required this.rangeDays,
    required this.totalOccurrences,
    required this.completed,
    required this.dismissed,
    required this.missed,
    required this.snoozed,
    required this.mostActiveReminderLabel,
    required this.dailyBreakdown,
  });

  factory StatisticsSummary.fromWire(WireReader r) => StatisticsSummary(
        rangeDays: r.integer('rangeDays'),
        totalOccurrences: r.integer('totalOccurrences'),
        completed: r.integer('completed'),
        dismissed: r.integer('dismissed'),
        missed: r.integer('missed'),
        snoozed: r.integer('snoozed'),
        mostActiveReminderLabel: r.stringOrNull('mostActiveReminderLabel'),
        dailyBreakdown: r.list('dailyBreakdown', DailyOutcomeCount.fromWire),
      );

  final int rangeDays;
  final int totalOccurrences;
  final int completed;
  final int dismissed;
  final int missed;
  final int snoozed;
  final String? mostActiveReminderLabel;
  final List<DailyOutcomeCount> dailyBreakdown;
}

// --- Capability and startup -----------------------------------------------------------

enum CapabilityStatus { ready, limited, blocked, unknown }

/// One capability row. [kind] and [action] stay strings: iPhone reports its
/// own kinds (`alarm_authorization`) and the set grows without a contract bump.
final class CapabilityItem {
  const CapabilityItem({
    required this.kind,
    required this.status,
    required this.effectKey,
    required this.action,
    required this.observedAt,
  });

  factory CapabilityItem.fromWire(WireReader r) => CapabilityItem(
        kind: r.string('kind'),
        status: r.enumValue('status', CapabilityStatus.values, (s) => s.name),
        effectKey: r.string('effectKey'),
        action: r.string('action'),
        observedAt: r.instant('observedAt'),
      );

  final String kind;
  final CapabilityStatus status;
  final String effectKey;
  final String action;
  final DateTime observedAt;
}

final class CapabilitySnapshot {
  const CapabilitySnapshot({required this.overall, required this.items, required this.observedAt});
  factory CapabilitySnapshot.fromWire(WireReader r) => CapabilitySnapshot(
        overall: _status(r, 'overall'),
        items: r.list('items', CapabilityItem.fromWire),
        observedAt: r.instant('observedAt'),
      );
  final ResultStatus overall;
  final List<CapabilityItem> items;
  final DateTime observedAt;
}

final class RepairSummary {
  const RepairSummary({required this.inProgress, required this.pendingOperations, this.lastResultKey});
  factory RepairSummary.fromWire(WireReader r) => RepairSummary(
        inProgress: r.boolean('inProgress'),
        pendingOperations: r.integer('pendingOperations'),
        lastResultKey: r.stringOrNull('lastResultKey'),
      );
  final bool inProgress;
  final int pendingOperations;
  final String? lastResultKey;
}

final class ActiveSessionSummary {
  const ActiveSessionSummary({
    required this.sessionId,
    required this.occurrenceId,
    required this.reminderId,
    required this.startedAt,
  });

  factory ActiveSessionSummary.fromWire(WireReader r) => ActiveSessionSummary(
        sessionId: r.string('sessionId'),
        occurrenceId: r.string('occurrenceId'),
        reminderId: r.string('reminderId'),
        startedAt: r.instant('startedAt'),
      );

  final String sessionId;
  final String occurrenceId;
  final String reminderId;
  final DateTime startedAt;
}

final class StartupSnapshot {
  const StartupSnapshot({
    required this.contractVersion,
    required this.schemaVersion,
    required this.appVersion,
    required this.buildVariant,
    required this.mediaCount,
    required this.activeReminderCount,
    required this.nextOccurrence,
    required this.capability,
    required this.repair,
    required this.activeSession,
    required this.sequence,
    required this.platform,
  });

  factory StartupSnapshot.fromWire(WireReader r) => StartupSnapshot(
        contractVersion: r.integer('contractVersion'),
        schemaVersion: r.integer('schemaVersion'),
        appVersion: r.string('appVersion'),
        buildVariant: r.string('buildVariant'),
        mediaCount: r.integer('mediaCount'),
        activeReminderCount: r.integer('activeReminderCount'),
        nextOccurrence: r.objectOrNull('nextOccurrence')?.let(OccurrenceSummary.fromWire),
        capability: CapabilitySnapshot.fromWire(r.object('capability')),
        repair: RepairSummary.fromWire(r.object('repair')),
        activeSession: r.objectOrNull('activeSession')?.let(ActiveSessionSummary.fromWire),
        sequence: r.string('sequence'),
        // Absent from the Android host before the iPhone core existed.
        platform: r.stringOrNull('platform') ?? 'android',
      );

  final int contractVersion;
  final int schemaVersion;
  final String appVersion;
  final String buildVariant;
  final int mediaCount;
  final int activeReminderCount;
  final OccurrenceSummary? nextOccurrence;
  final CapabilitySnapshot capability;
  final RepairSummary repair;
  final ActiveSessionSummary? activeSession;
  final String sequence;

  /// `android` or `ios`. Screens branch on capability fields, not on this;
  /// it exists for diagnostics and the About screen.
  final String platform;
}

final class NotificationPermissionResult {
  const NotificationPermissionResult({required this.granted});
  factory NotificationPermissionResult.fromWire(WireReader r) =>
      NotificationPermissionResult(granted: r.boolean('granted'));
  final bool granted;
}

// --- Alarm actions ----------------------------------------------------------------------

enum ActionOutcome { playing, snoozed, dismissed, alreadyResolved, mediaUnavailable, failedSafe }

String actionOutcomeWire(ActionOutcome outcome) => switch (outcome) {
      ActionOutcome.alreadyResolved => 'already_resolved',
      ActionOutcome.mediaUnavailable => 'media_unavailable',
      ActionOutcome.failedSafe => 'failed_safe',
      _ => outcome.name,
    };

final class ActionResult {
  const ActionResult({
    required this.sessionId,
    required this.outcome,
    required this.effectiveAt,
    this.snoozedUntil,
    this.nextOccurrence,
  });

  factory ActionResult.fromWire(WireReader r) => ActionResult(
        sessionId: r.string('sessionId'),
        outcome: r.enumValue('outcome', ActionOutcome.values, actionOutcomeWire),
        effectiveAt: r.instant('effectiveAt'),
        snoozedUntil: r.instantOrNull('snoozedUntil'),
        nextOccurrence: r.objectOrNull('nextOccurrence')?.let(OccurrenceSummary.fromWire),
      );

  final String sessionId;

  /// `alreadyResolved` is success-like: a double tap or a replayed intent.
  final ActionOutcome outcome;
  final DateTime effectiveAt;
  final DateTime? snoozedUntil;
  final OccurrenceSummary? nextOccurrence;
}

// --- Preferences --------------------------------------------------------------------------

enum ThemePreference { system, light, dark }

final class PreferencesSnapshot {
  const PreferencesSnapshot({
    required this.themePreference,
    required this.useMaterialYou,
    required this.use24HourTime,
    required this.languageTag,
    required this.hasCompletedOnboarding,
    required this.defaultSnoozeMinutes,
    required this.alarmRingtoneUri,
    required this.alarmRingtoneTitle,
    this.pausedUntil,
  });

  factory PreferencesSnapshot.fromWire(WireReader r) => PreferencesSnapshot(
        themePreference: r.enumValue('themePreference', ThemePreference.values, (t) => t.name),
        useMaterialYou: r.boolean('useMaterialYou'),
        use24HourTime: r.boolOrNull('use24HourTime'),
        languageTag: r.stringOrNull('languageTag'),
        hasCompletedOnboarding: r.boolean('hasCompletedOnboarding'),
        defaultSnoozeMinutes: r.integer('defaultSnoozeMinutes'),
        alarmRingtoneUri: r.stringOrNull('alarmRingtoneUri'),
        alarmRingtoneTitle: r.string('alarmRingtoneTitle'),
        pausedUntil: r.instantOrNull('pausedUntil'),
      );

  final ThemePreference themePreference;
  final bool useMaterialYou;
  final bool? use24HourTime;
  final String? languageTag;
  final bool hasCompletedOnboarding;
  final int defaultSnoozeMinutes;
  final String? alarmRingtoneUri;
  final String alarmRingtoneTitle;

  /// DL-110 "Pause all". Compare with now: an expired pause can be cached.
  /// Change it only through `setPausedUntil`, which reschedules.
  final DateTime? pausedUntil;
}

/// A partial preferences write. Only set fields are sent; to clear a nullable
/// one (`use24HourTime`, `languageTag`, `alarmRingtoneUri`) list it in
/// [clear].
final class PreferencePatch {
  const PreferencePatch({
    this.themePreference,
    this.useMaterialYou,
    this.use24HourTime,
    this.languageTag,
    this.hasCompletedOnboarding,
    this.defaultSnoozeMinutes,
    this.alarmRingtoneUri,
    this.clear = const {},
  });

  final ThemePreference? themePreference;
  final bool? useMaterialYou;
  final bool? use24HourTime;
  final String? languageTag;
  final bool? hasCompletedOnboarding;
  final int? defaultSnoozeMinutes;
  final String? alarmRingtoneUri;
  final Set<String> clear;

  Map<String, Object?> toWire() => {
        ...wireMap({
          'themePreference': themePreference?.name,
          'useMaterialYou': useMaterialYou,
          'use24HourTime': use24HourTime,
          'languageTag': languageTag,
          'hasCompletedOnboarding': hasCompletedOnboarding,
          'defaultSnoozeMinutes': defaultSnoozeMinutes,
          'alarmRingtoneUri': alarmRingtoneUri,
        }),
        for (final key in clear) key: null,
      };
}

final class PickedRingtone {
  const PickedRingtone({required this.uri, required this.title});
  factory PickedRingtone.fromWire(WireReader r) => PickedRingtone(uri: r.stringOrNull('uri'), title: r.string('title'));

  /// Null means the system default tone.
  final String? uri;
  final String title;
}

// --- Backup ---------------------------------------------------------------------------------

enum ImportMode { inspect, merge, replace }

final class ConflictSummary {
  const ConflictSummary({required this.kind, required this.count, required this.resolutionKey});
  factory ConflictSummary.fromWire(WireReader r) =>
      ConflictSummary(kind: r.string('kind'), count: r.integer('count'), resolutionKey: r.string('resolutionKey'));
  final String kind;
  final int count;
  final String resolutionKey;
}

final class BackupInspection {
  const BackupInspection({
    required this.operationId,
    required this.archiveVersion,
    required this.createdAt,
    required this.sourceAppVersion,
    required this.mediaCount,
    required this.reminderCount,
    required this.compressedBytes,
    required this.expectedUncompressedBytes,
    required this.checksumStatus,
    required this.compatibility,
    required this.conflicts,
    required this.warnings,
    required this.importToken,
  });

  factory BackupInspection.fromWire(WireReader r) => BackupInspection(
        operationId: r.string('operationId'),
        archiveVersion: r.string('archiveVersion'),
        createdAt: r.instant('createdAt'),
        sourceAppVersion: r.string('sourceAppVersion'),
        mediaCount: r.integer('mediaCount'),
        reminderCount: r.integer('reminderCount'),
        compressedBytes: r.bytes('compressedBytes'),
        expectedUncompressedBytes: r.bytes('expectedUncompressedBytes'),
        checksumStatus: r.string('checksumStatus'),
        compatibility: r.string('compatibility'),
        conflicts: r.list('conflicts', ConflictSummary.fromWire),
        warnings: r.strings('warnings'),
        importToken: r.string('importToken'),
      );

  final String operationId;
  final String archiveVersion;
  final DateTime createdAt;
  final String sourceAppVersion;
  final int mediaCount;
  final int reminderCount;
  final BigInt compressedBytes;
  final BigInt expectedUncompressedBytes;

  /// `valid`, `invalid` or `missing`.
  final String checksumStatus;

  /// `compatible`, `migratable`, `too_new` or `unsupported`.
  final String compatibility;
  final List<ConflictSummary> conflicts;

  /// Already-localized warning strings (MR-03).
  final List<String> warnings;

  /// References validated private staging; expires. Never a raw URI.
  final String importToken;
}

final class ExportResult {
  const ExportResult({required this.fileName, required this.sizeBytes, required this.sha256});
  factory ExportResult.fromWire(WireReader r) =>
      ExportResult(fileName: r.string('fileName'), sizeBytes: r.bytes('sizeBytes'), sha256: r.string('sha256'));
  final String fileName;
  final BigInt sizeBytes;
  final String sha256;
}

final class ImportCommitRequest {
  const ImportCommitRequest({required this.operationId, required this.importToken, required this.mode});
  final String operationId;
  final String importToken;
  final ImportMode mode;

  Map<String, Object?> toWire() => {'operationId': operationId, 'importToken': importToken, 'mode': mode.name};
}

// --- Events -------------------------------------------------------------------------------------

sealed class HostEvent {
  const HostEvent();
}

/// MR-08 `operationProgress`. [sequence] is monotonic per operation, so a gap
/// means a dropped event and the screen should refetch.
final class OperationProgressEvent extends HostEvent {
  const OperationProgressEvent({
    required this.operationId,
    required this.kind,
    required this.phase,
    required this.cancellable,
    required this.sequence,
    required this.correlationId,
    this.completedUnits,
    this.totalUnits,
    this.currentItemIndex,
    this.totalItems,
  });

  factory OperationProgressEvent.fromWire(WireReader r) => OperationProgressEvent(
        operationId: r.string('operationId'),
        kind: r.string('kind'),
        phase: r.string('phase'),
        completedUnits: r.bytesOrNull('completedUnits'),
        totalUnits: r.bytesOrNull('totalUnits'),
        currentItemIndex: r.intOrNull('currentItemIndex'),
        totalItems: r.intOrNull('totalItems'),
        cancellable: r.boolean('cancellable'),
        sequence: int.parse(r.string('sequence')),
        correlationId: r.string('correlationId'),
      );

  final String operationId;

  /// `import`, `export`, `backup_inspection`, `backup_commit` or `repair`.
  final String kind;

  /// `copying`, `checking`, `creating_preview` or `ready` (MR-03).
  final String phase;
  final BigInt? completedUnits;
  final BigInt? totalUnits;
  final int? currentItemIndex;
  final int? totalItems;
  final bool cancellable;
  final int sequence;
  final String correlationId;
}

/// MR-06 rule 4: a reminder came due while the app was in front. The
/// notification is already posted; this only drives the in-app card.
final class ReminderDueEvent extends HostEvent {
  const ReminderDueEvent({
    required this.sessionId,
    required this.nonce,
    required this.occurrence,
    required this.reminderLabel,
    required this.mediaTitle,
    required this.defaultSnoozeMinutes,
  });

  factory ReminderDueEvent.fromWire(WireReader r) => ReminderDueEvent(
        sessionId: r.string('sessionId'),
        nonce: r.string('nonce'),
        occurrence: OccurrenceSummary.fromWire(r.object('occurrence')),
        reminderLabel: r.string('reminderLabel'),
        mediaTitle: r.string('mediaTitle'),
        defaultSnoozeMinutes: r.integer('defaultSnoozeMinutes'),
      );

  final String sessionId;
  final String nonce;
  final OccurrenceSummary occurrence;
  final String reminderLabel;
  final String mediaTitle;
  final int defaultSnoozeMinutes;
}

extension _Let<T extends Object> on T {
  R let<R>(R Function(T value) transform) => transform(this);
}
