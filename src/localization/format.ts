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

/**
 * Storage size for display: "486 MB", "1.2 GB", "0 MB" when empty.
 *
 * Decimal units (MB = 10^6), matching what Android's own storage screens
 * show — a figure the user can compare against Settings > Storage rather
 * than a binary one that reads ~5% smaller for no reason they can see.
 *
 * One decimal place only above a gigabyte: "486.3 MB" is noise at that
 * scale, while "1.2 GB" vs "1 GB" is a difference worth seeing.
 */
export const formatStorageSize = (bytes: string | number): string => {
  const value = typeof bytes === 'string' ? Number(bytes) : bytes;
  const mb = value / 1_000_000;
  if (!Number.isFinite(value)) {
    // A malformed byte count is not worth a crash in a settings row.
    return '—';
  }
  if (mb < 1 && value > 0) {
    // Never round a real file down to "0 MB" — that reads as "nothing stored".
    return '<1 MB';
  }
  if (mb < 1000) {
    return `${Math.round(mb)} MB`;
  }
  return `${(mb / 1000).toFixed(1)} GB`;
};

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
