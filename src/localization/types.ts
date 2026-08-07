/**
 * Localization types.
 *
 * MR-13 "Localization architecture": "All user-visible strings... live in
 * localization resources. Concatenated sentences are prohibited." and "Persist
 * stable semantic values, never localized display strings."
 *
 * `TranslationKey` is a union of every key in the base (`en`) resource, so a
 * typo in a call to `t()` is a compile error, not a missing-string bug found
 * in QA. ICU MessageFormat syntax (`{count, plural, ...}`) is supported for
 * plural-aware strings per MR-13.
 */
import type {en} from './resources/en';

export type TranslationResource = typeof en;
export type TranslationKey = keyof TranslationResource;

export interface TranslateOptions {
  readonly [placeholder: string]: string | number;
}

export type Translate = (key: TranslationKey, options?: TranslateOptions) => string;

/** V1 ships English; MR-13's roadmap names Tamil and Arabic as next. */
export const supportedLanguageTags = ['en'] as const;
export type SupportedLanguageTag = (typeof supportedLanguageTags)[number];

/** Arabic is the RTL case the app must render correctly once shipped. */
export const rtlLanguageTags: ReadonlySet<string> = new Set(['ar']);
