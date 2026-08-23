/**
 * Placeholder interpolation and ICU-aware helpers.
 *
 * MR-13: "Use ICU/plural-aware formatting, locale date/time formatting."
 *
 * `Intl.DateTimeFormat` IS available in Hermes and is used below.
 * `Intl.PluralRules` is NOT — Hermes' Android Intl surface covers `Collator`,
 * `DateTimeFormat` and `NumberFormat` only. An earlier revision of this file
 * claimed PluralRules was "built into Hermes" and LibraryScreen acted on that
 * claim with a module-scope `new Intl.PluralRules('en')`; because it ran at
 * import time it threw "undefined cannot be used as a constructor", which
 * aborted the module, left the whole `features/library` barrel `undefined`,
 * and took the app down at launch with "Cannot read property
 * 'MediaDetailScreen' of undefined". Use [formatEnglishUnit] instead.
 *
 * A full ICU MessageFormat parser is more than v1's string set needs and is
 * deferred until a plural-heavy string actually requires it.
 */
import type {TranslateOptions} from './types';

const PLACEHOLDER = /\{(\w+)\}/g;

/** Replaces `{name}` tokens. Unknown placeholders are left as-is (dev-visible). */
export const interpolate = (template: string, options?: TranslateOptions): string => {
  if (!options) {
    return template;
  }
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = options[name];
    return value === undefined ? match : String(value);
  });
};

/**
 * Counted unit phrase, e.g. `1 minute` / `33 seconds`.
 *
 * English-only, matching MR-13's "V1 ships English" scope and the same
 * precedent as `RepeatSummaryFormatter.kt` on the native side. For integer
 * counts this is exactly the CLDR English rule (`one` when the value is 1,
 * `other` otherwise), so it produces the same output the `Intl.PluralRules`
 * call it replaces would have — see the file header for why that call could
 * not be used.
 *
 * Lives here rather than in a screen because plural selection is a
 * localization concern: when a second language lands, this is the single place
 * that has to grow a real rule set, and callers keep injecting it into
 * `formatDurationAccessible` unchanged.
 */
export const formatEnglishUnit = (value: number, unit: string): string =>
  `${value} ${unit}${value === 1 ? '' : 's'}`;

/** Locale-formatted date, honoring the MR-13 "avoid assuming first day of week" rule via `Intl`. */
export const formatLocalDate = (date: Date, languageTag: string | null): string =>
  new Intl.DateTimeFormat(languageTag ?? undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

/**
 * Locale-formatted time. `use24Hour: null` means "follow the device", which
 * `Intl` already does when `hour12` is omitted.
 */
export const formatLocalTime = (date: Date, use24Hour: boolean | null): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: use24Hour === null ? undefined : !use24Hour,
  }).format(date);

/**
 * Whether clocks should use a 24-hour cycle. `null` follows the device by
 * formatting 13:00 and checking whether the hour part is `13`.
 */
export const is24HourClock = (use24Hour: boolean | null): boolean => {
  if (use24Hour !== null) {
    return use24Hour;
  }
  const hour = new Intl.DateTimeFormat(undefined, {hour: 'numeric'}).formatToParts(
    new Date(2020, 0, 1, 13, 0, 0),
  );
  return hour.some(part => part.type === 'hour' && part.value === '13');
};

export interface FormattedClockParts {
  readonly time: string;
  readonly period: string;
}

/** Time + optional day-period for alarm-style rows. Honors the 12/24 preference. */
export const formatClockParts = (date: Date, use24Hour: boolean | null): FormattedClockParts => {
  if (is24HourClock(use24Hour)) {
    return {time: formatLocalTime(date, true), period: ''};
  }
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const hour = parts.find(part => part.type === 'hour')?.value ?? '';
  const minute = parts.find(part => part.type === 'minute')?.value ?? '';
  const period = parts.find(part => part.type === 'dayPeriod')?.value ?? '';
  return {time: `${hour}:${minute}`, period};
};
