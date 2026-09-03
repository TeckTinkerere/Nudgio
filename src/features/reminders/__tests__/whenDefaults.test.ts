import {newReminderWhenState, whenStateFromSchedule} from '../whenDefaults';
import type {Instant, LocalDate, LocalTime, ZoneId} from '../../../native-client/types';

describe('whenStateFromSchedule', () => {
  it('falls back to the create-time defaults for a new reminder', () => {
    expect(whenStateFromSchedule(undefined)).toEqual(newReminderWhenState());
  });

  it('reads the time back out of a daily rule', () => {
    const state = whenStateFromSchedule({
      type: 'daily',
      localTime: '17:18:00' as LocalTime,
      zonePolicy: 'follow_device',
    });

    expect(state.time).toEqual({hour: 5, minute: 18, period: 'PM'});
  });

  it('keeps midnight and noon on the right side of AM/PM', () => {
    const midnight = whenStateFromSchedule({
      type: 'daily',
      localTime: '00:05:00' as LocalTime,
      zonePolicy: 'follow_device',
    });
    const noon = whenStateFromSchedule({
      type: 'daily',
      localTime: '12:00:00' as LocalTime,
      zonePolicy: 'follow_device',
    });

    expect(midnight.time).toEqual({hour: 12, minute: 5, period: 'AM'});
    expect(noon.time).toEqual({hour: 12, minute: 0, period: 'PM'});
  });

  it('carries each rule type its own extra fields', () => {
    expect(
      whenStateFromSchedule({
        type: 'weekdays',
        localTime: '07:30:00' as LocalTime,
        isoWeekdays: [6, 7],
        zonePolicy: 'follow_device',
      }).weekdays,
    ).toEqual([6, 7]);

    expect(
      whenStateFromSchedule({
        type: 'yearly',
        localTime: '07:30:00' as LocalTime,
        month: 11,
        dayOfMonth: 24,
        zonePolicy: 'follow_device',
      }),
    ).toMatchObject({month: 11, dayOfMonth: 24});

    expect(
      whenStateFromSchedule({
        type: 'custom',
        localTime: '07:30:00' as LocalTime,
        intervalDays: 10,
        anchorDate: '2026-09-03' as LocalDate,
        zonePolicy: 'follow_device',
      }).intervalDays,
    ).toBe(10);
  });

  it('reads a one-shot rule from its instant, in the device zone', () => {
    const at = new Date();
    at.setHours(21, 45, 0, 0);

    expect(
      whenStateFromSchedule({
        type: 'once',
        instant: at.toISOString() as Instant,
        originZone: 'Asia/Singapore' as ZoneId,
      }).time,
    ).toEqual({hour: 9, minute: 45, period: 'PM'});
  });

  it('ignores an unparseable local time rather than showing a nonsense hour', () => {
    const state = whenStateFromSchedule({
      type: 'daily',
      localTime: 'not-a-time' as LocalTime,
      zonePolicy: 'follow_device',
    });

    expect(state.time).toEqual(newReminderWhenState().time);
  });
});
