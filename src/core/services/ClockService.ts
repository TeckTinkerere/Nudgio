/**
 * Time access.
 *
 * Nothing in the app calls `Date.now()` or `new Date()` directly. Time is
 * injected, for three reasons that all bite this product specifically:
 *
 *  - MR-11 requires deterministic tests around DST transitions, missed
 *    occurrences and grace windows;
 *  - ADR-007 forbids clock polling, so a component that reaches for the clock
 *    is a smell worth making visible;
 *  - the device time zone can change under the app, and a single accessor is
 *    where that is observed.
 *
 * Authoritative *scheduling* time is always the native side's (MR-08: "UI
 * never calculates authoritative next occurrence"). This service is for
 * display and for relative-time formatting only.
 */

export interface ClockService {
  /** Milliseconds since the Unix epoch, UTC. */
  now(): number;
  /** Current instant as a `Date`. Prefer `now()` unless a `Date` is required. */
  nowDate(): Date;
  /** The device's current IANA zone, e.g. `Asia/Singapore`. */
  timeZone(): string;
}

export const createSystemClock = (): ClockService => ({
  now: () => Date.now(),
  nowDate: () => new Date(),
  timeZone: () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Some minimal Android ICU builds can throw. UTC is a safe display
      // fallback; it never feeds a schedule calculation.
      return 'UTC';
    }
  },
});

/** Deterministic clock for tests. */
export const createFixedClock = (
  fixedNow: number,
  timeZone = 'UTC',
): ClockService => ({
  now: () => fixedNow,
  nowDate: () => new Date(fixedNow),
  timeZone: () => timeZone,
});
