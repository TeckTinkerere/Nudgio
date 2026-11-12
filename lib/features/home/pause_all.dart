/// "Pause all" (DL-110), the pure part: when each choice ends and whether a
/// cached pause is still in force. Native owns the effect (`setPausedUntil`
/// reschedules everything from the end), so nothing here wakes up to resume.
library;

/// Mirrors native `PreferencesRepository.INDEFINITE_PAUSE`: "until I resume".
final indefinitePause = DateTime.utc(9999, 12, 31, 23, 59, 59);

enum PauseChoice { tomorrowMorning, threeDays, week, indefinite }

/// When [choice] ends, from [now]. Day counts are calendar days in local
/// time, so a pause across a DST change still ends at the same wall clock.
DateTime pauseEndFor(PauseChoice choice, DateTime now) {
  final local = now.toLocal();
  DateTime plusDays(int days) =>
      DateTime(local.year, local.month, local.day + days, local.hour, local.minute, local.second, local.millisecond);
  return switch (choice) {
    PauseChoice.tomorrowMorning => DateTime(local.year, local.month, local.day + 1, 6),
    PauseChoice.threeDays => plusDays(3),
    PauseChoice.week => plusDays(7),
    PauseChoice.indefinite => indefinitePause,
  };
}

/// The pause's end if it is still ahead of [now], else null. Preferences are
/// cached, so an expired pause can still be in that cache.
DateTime? activePauseEnd(DateTime? pausedUntil, DateTime now) =>
    pausedUntil != null && pausedUntil.isAfter(now) ? pausedUntil : null;

bool isIndefinite(DateTime end) => end.toUtc().year >= 9999;
