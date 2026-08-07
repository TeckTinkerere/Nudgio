/**
 * Placeholder interpolation and ICU-aware helpers.
 *
 * MR-13: "Use ICU/plural-aware formatting, locale date/time formatting."
 * `Intl.PluralRules` (built into Hermes) drives plural selection; a full ICU
 * MessageFormat parser is more than v1's string set needs and is deferred
 * until a plural-heavy string actually requires it.
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
