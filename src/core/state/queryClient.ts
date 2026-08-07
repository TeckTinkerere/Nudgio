/**
 * React Query client.
 *
 * MR-07: "state: view state and query cache only; no duplicate source-of-truth
 * schedule database." React Query IS that query cache, scoped deliberately:
 * it never becomes a second database, because every query function is a thin
 * pass-through to a repository that already returns the authoritative value.
 *
 * Defaults:
 *  - no background refetch loop (ADR-007 forbids clock/interval polling from
 *    JS); data refreshes on window/screen focus and explicit invalidation
 *    instead;
 *  - retries are off by default because `MediaReminderClient` already
 *    classifies retryability per MR-08 and the UI decides retries explicitly,
 *    rather than React Query silently repeating a non-retryable call.
 */
import {MutationCache, QueryCache, QueryClient} from '@tanstack/react-query';

import type {AppError} from '../errors';
import type {Logger} from '../logging';

export interface CreateQueryClientDeps {
  readonly logger: Logger;
}

/** Narrow check: our repositories reject with `AppError`, not raw `Error`. */
const isAppError = (error: unknown): error is AppError =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  'category' in error;

export const createQueryClient = (deps: CreateQueryClientDeps): QueryClient => {
  const {logger} = deps;

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger.warn('query.error', {
          queryKey: JSON.stringify(query.queryKey),
          code: isAppError(error) ? error.code : 'unknown',
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: error => {
        logger.warn('mutation.error', {
          code: isAppError(error) ? error.code : 'unknown',
        });
      },
    }),
    defaultOptions: {
      queries: {
        // No fixed polling interval — ADR-007.
        refetchInterval: false,
        refetchOnReconnect: false,
        // ADR-015: there is no network, so "reconnect" has no meaning here,
        // but focus refetch still helps after backgrounding the app.
        refetchOnWindowFocus: true,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};
