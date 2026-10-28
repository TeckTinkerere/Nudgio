import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/features/reminders/reminder_status.dart';
import 'package:nudgio/native/types.dart';

final now = DateTime(2026, 10, 2, 12);

ReminderSummary base(
  String id, {
  bool enabledIntent = true,
  bool mediaMissing = false,
  ScheduleRule schedule = const DailyRule(localTime: '07:00:00'),
  OccurrenceSummary? nextOccurrence,
}) =>
    ReminderSummary(
      id: id,
      label: id,
      mediaId: 'm',
      mediaKind: MediaKind.image,
      profileId: 'p',
      enabledIntent: enabledIntent,
      effectiveState: ReminderEffectiveState.active,
      nextOccurrence: nextOccurrence,
      repeatSummary: '',
      schedule: schedule,
      mediaMissing: mediaMissing,
    );

ReminderSummary next(String id, DateTime at) => base(
      id,
      nextOccurrence: OccurrenceSummary(
        id: 'o-$id',
        reminderId: id,
        kind: OccurrenceKind.base,
        scheduledAt: at,
        state: OccurrenceState.pending,
      ),
    );

void main() {
  group('reminderStatus', () {
    test('distinguishes next, paused, done and unscheduled', () {
      final at = DateTime(2026, 10, 3, 7);
      expect(reminderStatus(next('a', at), now), NextAt(at));
      expect(reminderStatus(base('b', enabledIntent: false), now), isA<Paused>());
      final pastOnce = base('c', schedule: OnceRule(instant: DateTime.utc(2026, 10, 1, 9), originZone: 'UTC'));
      expect(reminderStatus(pastOnce, now), isA<Done>());
      expect(reminderStatus(base('d'), now), isA<Unscheduled>());
    });

    test('reports missing media ahead of the pause it caused', () {
      // The integrity sweep disables these, so without the earlier check they
      // would read as "Paused" beside a thumbnail that still renders.
      expect(reminderStatus(base('broken', enabledIntent: false, mediaMissing: true), now), isA<MediaMissing>());
      // Still reported while enabled, between the file going and the next sweep.
      expect(reminderStatus(base('e', mediaMissing: true), now), isA<MediaMissing>());
    });

    test('sorts soonest first, then broken, waiting, paused and done', () {
      final later = next('later', DateTime(2026, 10, 5, 7));
      final soon = next('soon', DateTime(2026, 10, 2, 18));
      final paused = base('paused', enabledIntent: false);
      final done = base('done', schedule: OnceRule(instant: DateTime.utc(2026, 9, 1, 9), originZone: 'UTC'));
      final waiting = base('waiting');
      final broken = base('broken', enabledIntent: false, mediaMissing: true);
      expect(
        sortByStatus([done, paused, later, waiting, soon, broken], now).map((r) => r.id),
        ['soon', 'later', 'broken', 'waiting', 'paused', 'done'],
      );
    });
  });

  group('relativeDayOf', () {
    for (final (at, expected) in [
      (DateTime(2026, 10, 2, 23, 59), RelativeDay.today),
      (DateTime(2026, 10, 3, 0, 1), RelativeDay.tomorrow),
      (DateTime(2026, 10, 6, 9), RelativeDay.thisWeek),
      (DateTime(2026, 10, 20, 9), RelativeDay.later),
    ]) {
      test('$at is $expected', () => expect(relativeDayOf(at, now), expected));
    }
  });
}
