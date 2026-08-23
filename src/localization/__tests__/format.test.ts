import {formatClockParts, formatLocalTime, is24HourClock} from '../format';

describe('clock preference', () => {
  const sample = new Date(2020, 0, 1, 18, 5, 0);

  it('formats 24-hour time without a day period when use24Hour is true', () => {
    expect(is24HourClock(true)).toBe(true);
    const parts = formatClockParts(sample, true);
    expect(parts.period).toBe('');
    expect(formatLocalTime(sample, true)).toMatch(/18/);
  });

  it('formats 12-hour time with a day period when use24Hour is false', () => {
    expect(is24HourClock(false)).toBe(false);
    const parts = formatClockParts(sample, false);
    expect(parts.period.length).toBeGreaterThan(0);
    expect(parts.time).not.toMatch(/^18:/);
  });
});
