import {useContext} from 'react';

import {TranslationContext} from './TranslationContext';
import type {Translate} from './types';

export const useTranslation = (): Translate => {
  const translate = useContext(TranslationContext);
  if (translate === undefined) {
    throw new Error(
      'useTranslation() was called outside <TranslationProvider>. Wrap the tree in AppProviders.',
    );
  }
  return translate;
};
