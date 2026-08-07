/**
 * Composition root for context providers.
 *
 * Order matters: `AppContainerContext` and the React Query `QueryClientProvider`
 * must be mounted before anything that calls `useAppearance()` or
 * `usePreferences()`, since those hooks read both. `ThemedProviders` is
 * therefore a separate inner component rather than inline JSX, so its hooks
 * run with the outer providers already committed.
 */
import {QueryClientProvider} from '@tanstack/react-query';
import type {PropsWithChildren} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {ThemeProvider} from '../design-system';
import {TranslationProvider} from '../localization';
import type {AppContainer} from './di';
import {AppContainerContext} from './di';
import {useAppearance} from '../hooks/useAppearance';

export interface AppProvidersProps {
  readonly container: AppContainer;
}

function ThemedProviders({children}: PropsWithChildren) {
  const appearance = useAppearance();

  // First paint, before the appearance query resolves: the brand palette
  // under the system appearance. Never blocks on a bridge round trip merely
  // to pick a theme (MR-07: cold startup must render a fast shell).
  const preference = appearance.data?.preference ?? 'system';
  const useMaterialYou = appearance.data?.useMaterialYou ?? false;
  const dynamicColor = appearance.data?.dynamicColor ?? null;

  return (
    <ThemeProvider
      preference={preference}
      useMaterialYou={useMaterialYou}
      dynamicColor={dynamicColor}>
      {/* V1 ships English only (MR-13); languageTag wiring is a one-line
          change once a preference for it exists on PreferencesSnapshot. */}
      <TranslationProvider languageTag="en">{children}</TranslationProvider>
    </ThemeProvider>
  );
}

export function AppProviders({
  container,
  children,
}: PropsWithChildren<AppProvidersProps>) {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AppContainerContext.Provider value={container}>
          <QueryClientProvider client={container.queryClient}>
            <ThemedProviders>{children}</ThemedProviders>
          </QueryClientProvider>
        </AppContainerContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
