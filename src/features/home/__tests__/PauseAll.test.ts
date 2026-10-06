import {activePauseEnd, INDEFINITE_PAUSE_ISO, isIndefinite, pauseEndFor} from '../PauseAll';

describe('pause durations', () => {
  const now = new Date(2026, 9, 6, 21, 30); // Tue 6 Oct 2026, 9:30 PM local

  it('"until tomorrow morning" ends at 6 AM the next day, not 24 hours later', () => {
    const end = pauseEndFor('tomorrowMorning', now);
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([7, 6, 0]);
  });

  it('counts days from now', () => {
    expect(pauseEndFor('threeDays', now).getDate()).toBe(9);
    expect(pauseEndFor('week', now).getDate()).toBe(13);
  });

  it('"until I turn them back on" is the native far-future marker', () => {
    const end = pauseEndFor('indefinite', now);
    expect(end.toISOString()).toBe(new Date(INDEFINITE_PAUSE_ISO).toISOString());
    expect(isIndefinite(end)).toBe(true);
    expect(isIndefinite(pauseEndFor('week', now))).toBe(false);
  });
});

describe('activePauseEnd', () => {
  const now = new Date('2026-10-06T12:00:00Z');

  it('reports a pause that is still ahead', () => {
    expect(activePauseEnd('2026-10-07T06:00:00Z', now)?.toISOString()).toBe('2026-10-07T06:00:00.000Z');
  });

  it('treats an expired cached pause as not paused', () => {
    expect(activePauseEnd('2026-10-06T11:59:59Z', now)).toBeNull();
  });

  it('treats a missing value as not paused', () => {
    expect(activePauseEnd(null, now)).toBeNull();
    expect(activePauseEnd(undefined, now)).toBeNull();
  });
});
