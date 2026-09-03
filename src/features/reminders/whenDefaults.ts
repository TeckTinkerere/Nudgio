/**
 * Seeds the reminder editor's "When" fields from the reminder being edited.
 *
 * The editor used to open every one of these fields on its create-time
 * default — 6:15 AM, weekdays Mon-Fri, day 1 — no matter which saved
 * reminder was being edited, because each `useState` initializer read a
 * constant instead of `existing.schedule`. Saving then silently rewrote the
 * schedule to those defaults. Now the form starts from the rule it is
 * editing, and the defaults apply only to a genuinely new reminder.
 *
 * A pure function in its own file, not an inline initializer, so the mapping
 * from every `ScheduleRuleDto` variant back to form state can be unit-tested
 * without mounting the screen.
 */
import {fromHour24, type TimeOfDayValue} from './TimePicker';
import type {ScheduleRuleDto} from '../../native-client/types';

export interface WhenFormState {
  readonly time: TimeOfDayValue;
  /** ISO-8601 weekday numbers, Monday = 1. */
  readonly weekdays: readonly number[];
  readonly dayOfMonth: number;
  /** 1-12. */
  readonly month: number;
  readonly intervalDays: number;
}

/** What a brand-new reminder starts from. */
export const newReminderWhenState = (): WhenFormState => ({
  time: {hour: 6, minute: 15, period: 'AM'},
  weekdays: [1, 2, 3, 4, 5],
  dayOfMonth: 1,
  month: new Date().getMonth() + 1,
  intervalDays: 3,
});

/** `HH:MM:SS` -> the hour/minute/period triple the wheels take. */
const parseLocalTime = (localTime: string, fallback: TimeOfDayValue): TimeOfDayValue => {
  const [rawHour, rawMinute] = localTime.split(':');
  const hour24 = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isInteger(hour24) || !Number.isInteger(minute)) {
    return fallback;
  }
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) {
    return fallback;
  }
  return {...fromHour24(hour24), minute};
};

export const whenStateFromSchedule = (
  schedule: ScheduleRuleDto | undefined,
): WhenFormState => {
  const defaults = newReminderWhenState();
  if (schedule === undefined) {
    return defaults;
  }

  // A one-shot rule stores an instant, not a local time: read it back in the
  // device zone, which is the zone the wheels are showing.
  if (schedule.type === 'once') {
    const at = new Date(schedule.instant);
    if (Number.isNaN(at.getTime())) {
      return defaults;
    }
    return {
      ...defaults,
      time: {...fromHour24(at.getHours()), minute: at.getMinutes()},
    };
  }

  const time = parseLocalTime(schedule.localTime, defaults.time);
  switch (schedule.type) {
    case 'weekdays':
      return {...defaults, time, weekdays: schedule.isoWeekdays};
    case 'monthly':
      return {...defaults, time, dayOfMonth: schedule.dayOfMonth};
    case 'yearly':
      return {...defaults, time, dayOfMonth: schedule.dayOfMonth, month: schedule.month};
    case 'custom':
      return {...defaults, time, intervalDays: schedule.intervalDays};
    case 'daily':
      return {...defaults, time};
  }
};
