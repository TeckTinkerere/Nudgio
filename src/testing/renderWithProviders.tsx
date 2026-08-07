/**
 * Component-test render helper.
 *
 * Wraps `@testing-library/react-native`'s `render` with exactly the providers
 * a screen needs (`useAppContainer`, `useTheme`, `useTranslation`) without
 * navigation or the startup gate, which most component tests do not need and
 * which would otherwise force every test to stub a bridge call it does not
 * care about.
 */
import {QueryClientProvider} from '@tanstack/react-query';
import {render, type RenderOptions} from '@testing-library/react-native';
import type {ReactElement} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppContainerContext} from '../app/di';
import {ThemeProvider} from '../design-system';
import {TranslationProvider} from '../localization';
import {createTestContainer, type CreateTestContainerOptions, type TestContainer} from './createTestContainer';

export interface RenderWithProvidersOptions extends RenderOptions {
  readonly container?: TestContainer;
  readonly containerOptions?: CreateTestContainerOptions;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) => {
  const container = options.container ?? createTestContainer(options.containerOptions);

  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        insets: {top: 24, right: 0, bottom: 16, left: 0},
        frame: {x: 0, y: 0, width: 412, height: 915},
      }}>
      <AppContainerContext.Provider value={container}>
        <QueryClientProvider client={container.queryClient}>
          <ThemeProvider preference="light" useMaterialYou={false} dynamicColor={null}>
            <TranslationProvider languageTag="en">{ui}</TranslationProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </AppContainerContext.Provider>
    </SafeAreaProvider>,
    options,
  );

  return {...result, container};
};
