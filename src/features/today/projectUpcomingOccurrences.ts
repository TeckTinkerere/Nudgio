/**
 * Derives the "Upcoming" 5-day occurrence list from each reminder's own
 * recurrence rule (`ReminderSummary.schedule`). This is a read-only display
 * projection, never persisted and never fed back into scheduling — MR-08's
 * "UI never calculates authoritative next occurrence" governs the one real
 * alarm the native scheduler registers, which this never touches. It is the
 * same "local approximation for display only" category as
 * `ReminderEditorScreen.tsx`'s own Preview-card `previewText`, generalized
 * from one reminder to every reminder and from one date to a 5-day window.
 *
 * Every date computed here goes through the `(year, month, day, ...)` local
 * `Date` constructor form, never raw millisecond addition — that constructor
 * already rolls a day-of-month past the end of its month into the next month
 * (handles month/year boundaries for free) and always resolves to a real
 * local wall-clock moment, so a spring-forward/fall-back transition inside
 * the window can never produce a skipped or doubled occurrence the way
 * `+ 24 * 60 * 60 * 1000` millisecond math would.
 */
import type {LocalDate, LocalTime, ReminderSummary, ScheduleRuleDto, UUID} from '../../native-client/types';

export interface UpcomingOccurrence {
  /** Stable within one 5-day projection: `{reminderId}-{localDate}`. */
  readonly id: string;
  readonly reminderId: UUID;
  /** `YYYY-MM-DD`, local. */
  readonly localDate: string;
  readonly dateTime: Date;
  readonly reminder: ReminderSummary;
}

const pad2 = (value: number): string => value.toString().padStart(2, '0');

export const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/**
 * `LocalDate`/`LocalTime` carry no zone info (MR-08: local wall-clock
 * values) — parsing them with the `Date` constructor's ISO-string path would
 * silently treat a date-only string as UTC midnight, which is a real
 * calendar day off in any negative-UTC-offset zone. Splitting on the
 * separator and building the value through the local constructor keeps
 * every value here anchored to the *device's* local calendar, matching what
 * the reminder editor's own schedule form already assumes.
 */
const parseLocalDate = (value: LocalDate): {readonly year: number; readonly month: number; readonly day: number} => {
  const parts = value.split('-').map(Number);
  return {year: parts[0] ?? 0, month: (parts[1] ?? 1) - 1, day: parts[2] ?? 1};
};

const parseLocalTime = (value: LocalTime): {readonly hour: number; readonly minute: number; readonly second: number} => {
  const parts = value.split(':').map(Number);
  return {hour: parts[0] ?? 0, minute: parts[1] ?? 0, second: parts[2] ?? 0};
};

const atLocalMidnight = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const withTime = (date: Date, time: LocalTime): Date => {
  const {hour, minute, second} = parseLocalTime(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, second);
};

const isSameLocalDate = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Whole calendar days between two local-midnight-anchored dates — safe across a DST transition, unlike dividing a raw millisecond gap. */
const calendarDaysBetween = (from: Date, to: Date): number =>
  Math.round((atLocalMidnight(to).getTime() - atLocalMidnight(from).getTime()) / 86_400_000);

/** ISO-8601 weekday, Monday = 1..Sunday = 7 (matches `isoWeekdays`'s own convention). */
const isoWeekdayOf = (date: Date): number => ((date.getDay() + 6) % 7) + 1;

const clampDayOfMonth = (year: number, month0: number, dayOfMonth: number): number => {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  return Math.min(dayOfMonth, daysInMonth);
};

/** Does `schedule` produce an occurrence on `day` (a local-midnight-anchored candidate date)? */
const ruleMatchesDay = (schedule: ScheduleRuleDto, day: Date): boolean => {
  switch (schedule.type) {
    case 'once':
      return isSameLocalDate(new Date(schedule.instant), day);
    case 'daily':
      return true;
    case 'weekdays':
      return schedule.isoWeekdays.includes(isoWeekdayOf(day));
    case 'monthly':
      return day.getDate() === clampDayOfMonth(day.getFullYear(), day.getMonth(), schedule.dayOfMonth);
    case 'yearly':
      return (
        day.getMonth() + 1 === schedule.month &&
        day.getDate() === clampDayOfMonth(day.getFullYear(), schedule.month - 1, schedule.dayOfMonth)
      );
    case 'custom': {
      const anchor = parseLocalDate(schedule.anchorDate);
      const anchorDate = new Date(anchor.year, anchor.month, anchor.day);
      const diff = calendarDaysBetween(anchorDate, day);
      return diff >= 0 && diff % schedule.intervalDays === 0;
    }
  }
};

const occurrenceDateTime = (schedule: ScheduleRuleDto, day: Date): Date =>
  schedule.type === 'once' ? new Date(schedule.instant) : withTime(day, schedule.localTime);

/**
 * Reminders eligible for the Upcoming projection. `archived` reminders are
 * soft-deleted in every sense that matters here; `disabled` is the user's
 * own explicit "don't alert me" choice. `needs_setup` (a live reminder
 * blocked only by a capability gap) still appears — matching Today's
 * existing row-state treatment, which shows rather than hides that state.
 */
const isEligible = (reminder: ReminderSummary): boolean =>
  reminder.effectiveState !== 'disabled' && reminder.effectiveState !== 'archived';

/**
 * Projects `days` calendar days forward from `now` (today included).
 * Today's own bucket excludes anything at or before `now` — every later
 * day includes every valid occurrence for that date, since by definition
 * none of them have happened yet.
 */
export const projectUpcomingOccurrences = (
  reminders: readonly ReminderSummary[],
  days: number,
  now: Date,
): readonly UpcomingOccurrence[] => {
  const eligible = reminders.filter(isEligible);
  const occurrences: UpcomingOccurrence[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    for (const reminder of eligible) {
      if (!ruleMatchesDay(reminder.schedule, day)) {
        continue;
      }
      const dateTime = occurrenceDateTime(reminder.schedule, day);
      if (offset === 0 && dateTime.getTime() <= now.getTime()) {
        continue;
      }
      occurrences.push({
        id: `${reminder.id}-${localDateKey(day)}`,
        reminderId: reminder.id,
        localDate: localDateKey(day),
        dateTime,
        reminder,
      });
    }
  }

  return occurrences.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
};

/** The 5 local-midnight day anchors the Upcoming screen sections against — same construction rule as the projector itself. */
export const upcomingDayAnchors = (now: Date, days: number): readonly Date[] =>
  Array.from({length: days}, (_, offset) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
