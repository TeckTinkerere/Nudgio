import {useContext} from 'react';

import type {AppContainer} from './AppContainer';
import {AppContainerContext} from './AppContainerContext';

export const useAppContainer = (): AppContainer => {
  const container = useContext(AppContainerContext);
  if (container === undefined) {
    throw new Error(
      'useAppContainer() was called outside <AppProviders>. Wrap the tree in AppProviders, or use renderWithProviders() in tests.',
    );
  }
  return container;
};
