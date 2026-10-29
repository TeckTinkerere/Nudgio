import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/core/errors/error_codes.dart';
import 'package:nudgio/core/logging/logger.dart';
import 'package:nudgio/core/result.dart';
import 'package:nudgio/native/nudgio_client.dart';
import 'package:nudgio/native/nudgio_host.dart';
import 'package:nudgio/native/testing/fake_host.dart';
import 'package:nudgio/native/types.dart';

import '../support/fixtures.dart';

void main() {
  late FakeNudgioHost host;
  late RecordingLogger logger;
  late NudgioClient client;

  setUp(() {
    host = FakeNudgioHost();
    logger = RecordingLogger();
    client = NudgioClient(host: host, logger: logger, newCorrelationId: () => 'corr-1');
  });

  group('decoding the shared fixtures', () {
    test('a reminder page, including an alarm with no attachment (DL-118)', () async {
      host.answer('listReminders', fixture('reminder_page'));
      final result = await client.listReminders();
      final page = (result as Ok<WirePage<ReminderSummary>>).value;

      expect(page.total, 2);
      final [withMedia, alarmOnly] = page.items;
      expect(withMedia.schedule, isA<WeekdaysRule>().having((r) => r.isoWeekdays, 'days', [1, 2, 3, 4, 5]));
      expect(withMedia.action, const ReminderAction(uri: 'https://youtu.be/x'));
      // Kotlin writes durations and offsets with putDouble.
      expect(withMedia.mediaStartMs, 15000);
      expect(withMedia.nextOccurrence?.scheduledAt, DateTime.utc(2026, 10, 29, 23));
      expect(alarmOnly.mediaId, isNull);
      expect(alarmOnly.schedule, isA<OnceRule>().having((r) => r.originZone, 'zone', 'Asia/Singapore'));
      expect(alarmOnly.action, isNull);
    });

    test('a reminder detail with a custom cadence', () async {
      host.answer('getReminder', fixture('reminder_detail'));
      final detail = (await client.getReminder('id') as Ok<ReminderDetail>).value;
      expect(detail.schedule, isA<CustomRule>().having((r) => r.intervalDays, 'every', 3));
      expect(detail.snooze.maximumMinutes, 60);
      expect(detail.entityVersion, 2);
    });

    test('a media page keeps byte counts past 2^53 exact', () async {
      host.answer('listMedia', fixture('media_page'));
      final page = (await client.listMedia(const MediaQuery()) as Ok<WirePage<MediaSummary>>).value;
      expect(page.items.single.sizeBytes, BigInt.parse('9007199254740993'));
      expect(page.items.single.durationMs, 61000);
    });

    test('preferences carry the indefinite pause marker', () async {
      host.answer('getPreferences', fixture('preferences'));
      final prefs = (await client.getPreferences() as Ok<PreferencesSnapshot>).value;
      expect(prefs.pausedUntil, DateTime.utc(9999, 12, 31, 23, 59, 59));
      expect(prefs.use24HourTime, isNull);
    });

    test('an action result', () async {
      host.answer('snoozeDueSession', fixture('action_result'));
      final result = (await client.snoozeDueSession('s', 10, 'n') as Ok<ActionResult>).value;
      expect(result.outcome, ActionOutcome.snoozed);
      expect(result.nextOccurrence?.kind, OccurrenceKind.snooze);
      expect(host.calls.single.arguments, {'sessionId': 's', 'minutes': 10, 'nonce': 'n'});
    });
  });

  group('errors', () {
    test('a native rejection becomes its envelope, not its message', () async {
      host.reject('saveReminder', fixtureMap('error_envelope'));
      final result = await client.saveReminder(const SaveReminderRequest(
        label: '',
        schedule: DailyRule(localTime: '07:00:00'),
        profileId: 'p',
        snooze: SnoozePolicy(defaultMinutes: 10, allowCustom: true, minimumMinutes: 1, maximumMinutes: 60),
        enabledIntent: true,
      ));
      final error = (result as Err).error;
      expect(error.code, ErrorCode.validationFailed);
      expect(error.field, 'label');
      expect(error.correlationId, '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b');
    });

    test('no registered host is a retryable bridge-unavailable error', () async {
      final unregistered = NudgioClient(host: _MissingHost(), logger: logger, newCorrelationId: () => 'c');
      final error = (await unregistered.getPreferences() as Err).error;
      expect(error.code, ErrorCode.bridgeUnavailable);
      expect(error.retryable, isTrue);
    });

    test('a payload that breaks the contract is a contract mismatch naming the field', () async {
      host.answer('getPreferences', {...fixtureMap('preferences'), 'defaultSnoozeMinutes': 'ten'});
      final error = (await client.getPreferences() as Err).error;
      expect(error.code, ErrorCode.contractMismatch);
      expect(error.field, 'PreferencesSnapshot.defaultSnoozeMinutes');
    });

    test('a different contract version is reported, not trusted', () async {
      host.answer('getStartupSnapshot', {...fixtureMap('startup_snapshot'), 'contractVersion': 2});
      final error = (await client.getStartupSnapshot() as Err).error;
      expect(error.messageKey, 'error.updateRequired');
      expect(error.safeDetails, {'expected': 1, 'received': 2});
    });

    test('calls are logged by name and outcome, never with arguments', () async {
      host.answer('getPreferences', fixture('preferences'));
      await client.getPreferences();
      final log = logger.records.single;
      expect(log.event, 'bridge.call');
      expect(log.fields.keys, containsAll(['method', 'ok', 'durationMs']));
      expect(log.fields.containsKey('arguments'), isFalse);
    });
  });

  group('requests', () {
    test('saving an alarm with no attachment sends an explicit null mediaId', () async {
      host.on('saveReminder', (args) => throw PlatformException(code: 'x'));
      await client.saveReminder(const SaveReminderRequest(
        label: 'Medicine',
        schedule: DailyRule(localTime: '21:00:00'),
        profileId: 'p',
        snooze: SnoozePolicy(defaultMinutes: 10, allowCustom: true, minimumMinutes: 1, maximumMinutes: 60),
        enabledIntent: true,
      ));
      final request = host.calls.single.arguments['request']! as Map<String, Object?>;
      expect(request.containsKey('mediaId'), isTrue);
      expect(request['mediaId'], isNull);
      expect(request.containsKey('id'), isFalse, reason: 'absent id means create');
    });

    test('a preference patch sends only what changed, plus explicit clears', () async {
      host.answer('setPreferences', fixture('preferences'));
      await client.setPreferences(const PreferencePatch(useMaterialYou: false, clear: {'languageTag'}));
      expect(host.calls.single.arguments['patch'], {'useMaterialYou': false, 'languageTag': null});
    });

    test('an empty pending-open slot is null', () async {
      host.answer('takePendingMediaOpen', {'reminderId': null, 'mediaId': null});
      expect(await client.takePendingMediaOpen(), const Ok<PendingReminderOpen?>(null));
    });
  });

  test('events decode by name, and a malformed one is dropped, not thrown', () async {
    final events = client.events.toList();
    host
      ..emit('operationProgress', {
        'operationId': 'op',
        'kind': 'import',
        'phase': 'copying',
        'completedUnits': '10',
        'totalUnits': '20',
        'cancellable': true,
        'sequence': '3',
        'correlationId': 'c',
      })
      ..emit('operationProgress', {'operationId': 'broken'})
      ..emit('somethingNew', {});
    await host.close();
    final received = await events;
    expect(received, hasLength(1));
    expect((received.single as OperationProgressEvent).sequence, 3);
    expect(logger.records.where((r) => r.event == 'bridge.eventDropped'), hasLength(1));
  });

  test('randomUuidV4 is a fresh RFC 4122 v4 UUID each time', () {
    final ids = {for (var i = 0; i < 50; i++) randomUuidV4()};
    expect(ids, hasLength(50));
    for (final id in ids) {
      expect(id, matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    }
  });
}

class _MissingHost implements NudgioHost {
  @override
  Future<Object?> invoke(String method, Map<String, Object?> arguments) =>
      throw MissingPluginException('No implementation found for $method');

  @override
  Stream<Object?> get events => const Stream.empty();
}
