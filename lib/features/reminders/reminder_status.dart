import '../../native/types.dart';

/// What a reminder is doing right now, in words a person reads at a glance,
/// and the order a list of them should appear in. Pure, so the rules are
/// testable without rendering anything. Ported from `reminderStatus.ts`.
sealed class ReminderStatus {
  const ReminderStatus();
}

final class NextAt extends ReminderStatus {
  const NextAt(this.at);
  final DateTime at;

  @override
  bool operator ==(Object other) => other is NextAt && other.at == at;

  @override
  int get hashCode => at.hashCode;
}

/// The media this reminder plays is gone. Checked before [Paused] because it
/// is the cause: the integrity sweep disables these, so they would otherwise
/// read as paused by the user beside a thumbnail that still renders.
final class MediaMissing extends ReminderStatus {
  const MediaMissing();
}

final class Paused extends ReminderStatus {
  const Paused();
}

/// A one-time reminder whose moment has passed.
final class Done extends ReminderStatus {
  const Done();
}

/// Enabled, but nothing scheduled (e.g. waiting on a capability).
final class Unscheduled extends ReminderStatus {
  const Unscheduled();
}

ReminderStatus reminderStatus(ReminderSummary reminder, DateTime now) {
  if (reminder.mediaMissing) return const MediaMissing();
  if (!reminder.enabledIntent) return const Paused();
  final next = reminder.nextOccurrence;
  if (next != null) return NextAt(next.scheduledAt);
  final schedule = reminder.schedule;
  if (schedule is OnceRule && !schedule.instant.isAfter(now)) return const Done();
  return const Unscheduled();
}

// Broken sorts second, above merely waiting: it is the only state that needs
// the user to act, and burying it under every paused reminder is how it
// stayed invisible in the first place.
int _rank(ReminderStatus status) => switch (status) {
      NextAt() => 0,
      MediaMissing() => 1,
      Unscheduled() => 2,
      Paused() => 3,
      Done() => 4,
    };

/// Soonest first, then anything broken, then waiting, then paused, then
/// finished one-time reminders; ties by label.
List<ReminderSummary> sortByStatus(Iterable<ReminderSummary> items, DateTime now) {
  final entries = [for (final item in items) (item: item, status: reminderStatus(item, now))];
  entries.sort((a, b) {
    final rank = _rank(a.status) - _rank(b.status);
    if (rank != 0) return rank;
    if ((a.status, b.status) case (NextAt(at: final x), NextAt(at: final y))) return x.compareTo(y);
    return compareLabels(a.item.label, b.item.label);
  });
  return [for (final entry in entries) entry.item];
}

/// Case-insensitive first, so "apple" and "Banana" sort as people expect, then
/// exact, so the order is stable.
int compareLabels(String a, String b) {
  final folded = a.toLowerCase().compareTo(b.toLowerCase());
  return folded != 0 ? folded : a.compareTo(b);
}

enum RelativeDay { today, tomorrow, thisWeek, later }

/// Which wording to use for [at] relative to [now], both in local time.
RelativeDay relativeDayOf(DateTime at, DateTime now) {
  final atLocal = at.toLocal();
  final nowLocal = now.toLocal();
  // Calendar days, not 24-hour spans: UTC dates avoid DST-length days.
  final days = DateTime.utc(atLocal.year, atLocal.month, atLocal.day)
      .difference(DateTime.utc(nowLocal.year, nowLocal.month, nowLocal.day))
      .inDays;
  if (days <= 0) return RelativeDay.today;
  if (days == 1) return RelativeDay.tomorrow;
  return days < 7 ? RelativeDay.thisWeek : RelativeDay.later;
}
