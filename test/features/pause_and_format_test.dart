import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/features/home/pause_all.dart';
import 'package:nudgio/l10n/format.dart';

void main() {
  group('pause durations', () {
    final now = DateTime(2026, 10, 6, 21, 30); // Tue 6 Oct 2026, 9:30 PM local

    test('"until tomorrow morning" ends at 6 AM the next day, not 24 hours later', () {
      final end = pauseEndFor(PauseChoice.tomorrowMorning, now);
      expect([end.day, end.hour, end.minute], [7, 6, 0]);
    });

    test('counts days from now', () {
      expect(pauseEndFor(PauseChoice.threeDays, now).day, 9);
      expect(pauseEndFor(PauseChoice.week, now).day, 13);
    });

    test('"until I turn them back on" is the native far-future marker', () {
      final end = pauseEndFor(PauseChoice.indefinite, now);
      expect(end, DateTime.utc(9999, 12, 31, 23, 59, 59));
      expect(isIndefinite(end), isTrue);
      expect(isIndefinite(pauseEndFor(PauseChoice.week, now)), isFalse);
    });
  });

  group('activePauseEnd', () {
    final now = DateTime.utc(2026, 10, 6, 12);

    test('reports a pause that is still ahead', () {
      expect(activePauseEnd(DateTime.utc(2026, 10, 7, 6), now), DateTime.utc(2026, 10, 7, 6));
    });

    test('treats an expired cached pause, or none, as not paused', () {
      expect(activePauseEnd(DateTime.utc(2026, 10, 6, 11, 59, 59), now), isNull);
      expect(activePauseEnd(null, now), isNull);
    });
  });

  group('formatStorageSize', () {
    test('uses decimal units, matching what phone storage screens show', () {
      expect(formatStorageSize(486000000), '486 MB');
    });

    test('never rounds a real file down to nothing, and shows empty as zero', () {
      expect(formatStorageSize(1), '<1 MB');
      expect(formatStorageSize(999999), '<1 MB');
      expect(formatStorageSize(0), '0 MB');
    });

    test('switches to one decimal place past a gigabyte', () {
      expect(formatStorageSize(1200000000), '1.2 GB');
      expect(formatStorageSize(999000000), '999 MB');
    });

    test('accepts the decimal-string and BigInt byte counts the host sends', () {
      expect(formatStorageSize('486000000'), '486 MB');
      expect(formatStorageSize(BigInt.from(486000000)), '486 MB');
    });

    test('degrades instead of crashing a settings row on a malformed count', () {
      expect(formatStorageSize('not-a-number'), '—');
    });
  });
}
