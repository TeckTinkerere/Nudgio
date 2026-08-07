import {createContext} from 'react';

import type {AppContainer} from './AppContainer';

/**
 * Undefined default so `useAppContainer()` fails loudly with a named error
 * instead of a screen silently receiving `undefined.repositories`.
 */
export const AppContainerContext = createContext<AppContainer | undefined>(undefined);
AppContainerContext.displayName = 'AppContainerContext';
