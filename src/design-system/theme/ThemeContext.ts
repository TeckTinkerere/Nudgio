import {createContext} from 'react';

import type {Theme} from './Theme';

/**
 * Undefined default is deliberate: `useTheme()` throws a named error rather
 * than silently handing back a half-built theme when a provider is missing.
 */
export const ThemeContext = createContext<Theme | undefined>(undefined);
ThemeContext.displayName = 'ThemeContext';
