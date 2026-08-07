/**
 * Supplies localized copy to the class-based `ErrorBoundary`.
 *
 * `ErrorBoundary` cannot call `useTranslation()` itself — hooks require a
 * function component, and only a class component can implement
 * `componentDidCatch`/`getDerivedStateFromError`. This function component sits
 * between `AppProviders` (which mounts `TranslationProvider`) and the boundary,
 * doing the one hook call the class needs.
 */
import type {PropsWithChildren} from 'react';

import type {Logger} from '../core/logging';
import {useTranslation} from '../localization';
import {ErrorBoundary} from './ErrorBoundary';

export interface ErrorBoundaryTextProps {
  readonly logger: Logger;
}

export function ErrorBoundaryText({
  logger,
  children,
}: PropsWithChildren<ErrorBoundaryTextProps>) {
  const t = useTranslation();

  return (
    <ErrorBoundary
      logger={logger}
      title={t('error.unexpected.title')}
      effect={t('error.unexpected.effect')}
      recoveryLabel={t('action.retry')}>
      {children}
    </ErrorBoundary>
  );
}
