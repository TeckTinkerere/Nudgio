/**
 * Translation provider.
 *
 * Loads the resource for `languageTag` and exposes a `t()` function. Only
 * `en` exists today (MR-13: "V1 ships English"); the switch below is the seam
 * where Tamil and Arabic resources plug in without touching a call site.
 */
import {useMemo, type PropsWithChildren} from 'react';

import {interpolate} from './format';
import {en} from './resources/en';
import {TranslationContext} from './TranslationContext';
import type {SupportedLanguageTag, TranslateOptions, TranslationKey} from './types';

export interface TranslationProviderProps {
  readonly languageTag: SupportedLanguageTag;
}

const resourceFor = (_languageTag: SupportedLanguageTag) => {
  // Exhaustiveness note: when 'ta'/'ar' are added to SupportedLanguageTag,
  // this switch must grow with them — TypeScript will flag the gap.
  return en;
};

export function TranslationProvider({
  languageTag,
  children,
}: PropsWithChildren<TranslationProviderProps>) {
  const translate = useMemo(() => {
    const resource = resourceFor(languageTag);
    return (key: TranslationKey, options?: TranslateOptions): string =>
      interpolate(resource[key], options);
  }, [languageTag]);

  return (
    <TranslationContext.Provider value={translate}>
      {children}
    </TranslationContext.Provider>
  );
}
