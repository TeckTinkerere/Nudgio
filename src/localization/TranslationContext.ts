import {createContext} from 'react';

import type {Translate} from './types';

export const TranslationContext = createContext<Translate | undefined>(undefined);
TranslationContext.displayName = 'TranslationContext';
