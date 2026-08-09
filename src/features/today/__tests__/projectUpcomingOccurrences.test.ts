/**
 * `projectUpcomingOccurrences` is pure display projection (see its own doc
 * comment for why this is not the same thing as MR-08's authoritative
 * scheduling) — every case here uses a fixed, injected `now`, never the real
 * clock, locale or time zone, so these stay deterministic regardless of when
 * or where they run.
 */
import type {
  Instant,
  LocalDate,
  LocalTime,
  ReminderSummary,
  ScheduleRuleDto,
  UUID,
  ZoneId,
} from '../../../native-client/types';
import {localDateKey, projectUpcomingOccurrences, upcomingDayAnchors} from '../projectUpcomingOccurrences';

const uuid = (value: string): UUID => value as UUID;

let nextId = 0;
const reminder = (
  schedule: ScheduleRuleDto,
  overrides: Partial<ReminderSummary> = {},
): ReminderSummary => {
  nextId += 1;
  return {
    id: uuid(`reminder-${nextId}`),
    label: overrides.label ?? `Reminder ${nextId}`,
    mediaId: uuid(`media-${nextId}`),
    mediaKind: 'video',
    profileId: uuid('profile-1'),
    enabledIntent: true,
    effectiveState: 'active',
    nextOccurrence: null,
    repeatSummary: '',
    schedule,
    ...overrides,
  };
};

// Sunday 2026-08-09, 15:00 local — a fixed "now" every test anchors against.
const NOW = new Date(2026, 7, 9, 15, 0, 0);

describe('projectUpcomingOccurrences', () => {
  it('includes a daily reminder on every day of the window', () => {
    const daily = reminder({type: 'daily', localTime: '09:00:00' as LocalTime, zonePolicy: 'follow_device'});

    const result = projectUpcomingOccurrences([daily], 5, NOW);

    // Today's 09:00 has already passed relative to NOW (15:00) — 4 remain.
    expect(result).toHaveLength(4);
    expect(result.map(o => o.localDate)).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ]);
  });

  it("excludes today's occurrence once it has already passed", () => {
    const morning = reminder({type: 'daily', localTime: '08:00:00' as LocalTime, zonePolicy: 'follow_device'});
    const evening = reminder({type: 'daily', localTime: '20:00:00' as LocalTime, zonePolicy: 'follow_device'});

    const result = projectUpcomingOccurrences([morning, evening], 1, NOW);

    expect(result).toHaveLength(1);
    expect(result[0]!.reminderId).toBe(evening.id);
  });

  it('excludes disabled and archived reminders', () => {
    const active = reminder({type: 'daily', localTime: '20:00:00' as LocalTime, zonePolicy: 'follow_device'});
    const disabled = reminder(
      {type: 'daily', localTime: '20:00:00' as LocalTime, zonePolicy: 'follow_device'},
      {effectiveState: 'disabled'},
    );
    const archived = reminder(
      {type: 'daily', localTime: '20:00:00' as LocalTime, zonePolicy: 'follow_device'},
      {effectiveState: 'archived'},
    );

    const result = projectUpcomingOccurrences([active, disabled, archived], 1, NOW);

    expect(result.map(o => o.reminderId)).toEqual([active.id]);
  });

  it('includes a needs_setup reminder (capability-blocked, not user-disabled)', () => {
    const blocked = reminder(
      {type: 'daily', localTime: '20:00:00' as LocalTime, zonePolicy: 'follow_device'},
      {effectiveState: 'needs_setup'},
    );

    expect(projectUpcomingOccurrences([blocked], 1, NOW)).toHaveLength(1);
  });

  it('includes a one-time reminder only on its exact scheduled date', () => {
    const once = reminder({
      type: 'once',
      instant: new Date(2026, 7, 11, 10, 0, 0).toISOString() as Instant,
      originZone: 'Asia/Singapore' as ZoneId,
    });

    const result = projectUpcomingOccurrences([once], 5, NOW);

    expect(result).toHaveLength(1);
    expect(result[0]!.localDate).toBe('2026-08-11');
  });

  it('respects selected weekdays', () => {
    // Monday=1, Tuesday=2 — within the 5-day window (Sun 9 - Thu 13), only Mon 10 and Tue 11 match.
    const weekdays = reminder({
      type: 'weekdays',
      localTime: '09:00:00' as LocalTime,
      isoWeekdays: [1, 2],
      zonePolicy: 'follow_device',
    });

    const result = projectUpcomingOccurrences([weekdays], 5, NOW);

    expect(result.map(o => o.localDate)).toEqual(['2026-08-10', '2026-08-11']);
  });

  it('respects a custom interval anchored to a fixed date', () => {
    const everyThirdDay = reminder({
      type: 'custom',
      localTime: '09:00:00' as LocalTime,
      intervalDays: 3,
      anchorDate: '2026-08-09' as LocalDate,
      zonePolicy: 'follow_device',
    });

    // Anchor is today (offset 0, already past by NOW) then every 3 days: 12, (15 outside window).
    const result = projectUpcomingOccurrences([everyThirdDay], 5, NOW);

    expect(result.map(o => o.localDate)).toEqual(['2026-08-12']);
  });

  it('handles a monthly reminder crossing a month boundary', () => {
    const endOfAugust = new Date(2026, 7, 30, 15, 0, 0); // Sun 2026-08-30
    const monthly = reminder({
      type: 'monthly',
      localTime: '09:00:00' as LocalTime,
      dayOfMonth: 1,
      zonePolicy: 'follow_device',
    });

    const result = projectUpcomingOccurrences([monthly], 5, endOfAugust);

    expect(result).toHaveLength(1);
    expect(result[0]!.localDate).toBe('2026-09-01');
  });

  it('clamps a monthly day-of-month that does not exist in a short month', () => {
    const endOfFeb = new Date(2026, 1, 27, 8, 0, 0); // Fri 2026-02-27, non-leap year
    const monthly = reminder({
      type: 'monthly',
      localTime: '09:00:00' as LocalTime,
      dayOfMonth: 31,
      zonePolicy: 'follow_device',
    });

    const result = projectUpcomingOccurrences([monthly], 5, endOfFeb);

    // 2026 is not a leap year: February has 28 days, so day 31 clamps to 28.
    expect(result.map(o => o.localDate)).toEqual(['2026-02-28']);
  });

  it('sorts chronologically across reminders and days', () => {
    const late = reminder({type: 'daily', localTime: '22:00:00' as LocalTime, zonePolicy: 'follow_device'});
    const early = reminder({type: 'daily', localTime: '06:00:00' as LocalTime, zonePolicy: 'follow_device'});

    const result = projectUpcomingOccurrences([late, early], 2, NOW);

    expect(result.map(o => o.reminderId)).toEqual([
      late.id, // today 22:00 (early's today 06:00 already passed by NOW=15:00)
      early.id, // tomorrow 06:00
      late.id, // tomorrow 22:00
    ]);
  });

  it('produces stable ids of the form {reminderId}-{localDate}', () => {
    const daily = reminder({type: 'daily', localTime: '20:00:00' as LocalTime, zonePolicy: 'follow_device'});

    const result = projectUpcomingOccurrences([daily], 1, NOW);

    expect(result[0]!.id).toBe(`${daily.id}-2026-08-09`);
  });

  it('never produces duplicate occurrence ids', () => {
    const daily = reminder({type: 'daily', localTime: '20:00:00' as LocalTime, zonePolicy: 'follow_device'});

    const result = projectUpcomingOccurrences([daily], 5, NOW);

    expect(new Set(result.map(o => o.id)).size).toBe(result.length);
  });
});

describe('localDateKey', () => {
  it('formats a zero-padded local YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('upcomingDayAnchors', () => {
  it('returns exactly 5 consecutive local-midnight days starting today', () => {
    const anchors = upcomingDayAnchors(NOW, 5);

    expect(anchors.map(localDateKey)).toEqual([
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ]);
  });

  it('rolls correctly across a year boundary', () => {
    const nyeEve = new Date(2026, 11, 30, 10, 0, 0);
    const anchors = upcomingDayAnchors(nyeEve, 5);

    expect(anchors.map(localDateKey)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });
});
