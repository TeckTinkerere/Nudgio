/**
 * Typed wrapper over `useQuery`.
 *
 * Every feature query goes through this instead of calling `@tanstack/
 * react-query` directly, for one reason: `error` comes back as `AppError`,
 * not `unknown`. `unwrapResult` (core/state) guarantees the thrown value is
 * always an `AppError`, and this hook's return type says so, so a component
 * can render `error.messageKey` without an `as AppError` cast anywhere in
 * feature code.
 */
import {useQuery, type UseQueryOptions, type UseQueryResult} from '@tanstack/react-query';

import type {AppError} from '../core/errors';

export type AppQueryOptions<T> = Omit<
  UseQueryOptions<T, AppError>,
  'queryFn' | 'queryKey'
> & {
  readonly queryKey: readonly unknown[];
  readonly queryFn: () => Promise<T>;
};

export type AppQueryResult<T> = UseQueryResult<T, AppError>;

export const useAppQuery = <T>(options: AppQueryOptions<T>): AppQueryResult<T> =>
  useQuery(options);
