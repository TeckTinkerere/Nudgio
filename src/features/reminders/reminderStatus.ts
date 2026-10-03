/**
 * What a reminder is doing right now, in words a person reads at a glance —
 * and the order a list of them should appear in. Pure, so the rules are
 * testable without rendering anything.
 */
import type {ReminderSummary} from '../../native-client/types';

export type ReminderStatus =
  | {readonly kind: 'next'; readonly at: Date}
  /**
   * The media this reminder plays is gone from disk.
   *
   * Checked before `paused` because it is the *cause*: the startup integrity
   * sweep disables these, so they would otherwise read as "Paused", as
   * though the user had done it, beside a thumbnail that still renders from
   * cache. Naming the real reason is what makes the row actionable.
   */
  | {readonly kind: 'mediaMissing'}
  | {readonly kind: 'paused'}
  /** A one-time reminder whose moment has passed. */
  | {readonly kind: 'done'}
  /** Enabled, but nothing scheduled (e.g. waiting on a capability). */
  | {readonly kind: 'unscheduled'};

export const reminderStatus = (reminder: ReminderSummary, now: Date): ReminderStatus => {
  if (reminder.mediaMissing) {
    return {kind: 'mediaMissing'};
  }
  if (!reminder.enabledIntent) {
    return {kind: 'paused'};
  }
  if (reminder.nextOccurrence) {
    return {kind: 'next', at: new Date(reminder.nextOccurrence.scheduledAt)};
  }
  if (reminder.schedule.type === 'once' && new Date(reminder.schedule.instant).getTime() <= now.getTime()) {
    return {kind: 'done'};
  }
  return {kind: 'unscheduled'};
};

// Broken sorts second, above merely-waiting: it is the only state here that
// needs the user to do something, and burying it under every paused reminder
// is how it stayed invisible in the first place.
const RANK: Record<ReminderStatus['kind'], number> = {
  next: 0,
  mediaMissing: 1,
  unscheduled: 2,
  paused: 3,
  done: 4,
};

/** Soonest first, then anything broken, then waiting, then paused, then finished one-time reminders. */
export const sortByStatus = (items: readonly ReminderSummary[], now: Date): ReminderSummary[] =>
  items
    .map(item => ({item, status: reminderStatus(item, now)}))
    .sort((a, b) => {
      const rank = RANK[a.status.kind] - RANK[b.status.kind];
      if (rank !== 0) {
        return rank;
      }
      if (a.status.kind === 'next' && b.status.kind === 'next') {
        return a.status.at.getTime() - b.status.at.getTime();
      }
      return a.item.label.localeCompare(b.item.label);
    })
    .map(entry => entry.item);

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export type RelativeDay = 'today' | 'tomorrow' | 'thisWeek' | 'later';

/** Which wording to use for a date relative to `now`: "Today", "Tomorrow", a weekday, or a full date. */
export const relativeDayOf = (at: Date, now: Date): RelativeDay => {
  const days = Math.round((startOfDay(at) - startOfDay(now)) / 86_400_000);
  if (days <= 0) {
    return 'today';
  }
  if (days === 1) {
    return 'tomorrow';
  }
  return days < 7 ? 'thisWeek' : 'later';
};
