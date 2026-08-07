import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import type {AppError} from '../core/errors';

export type AppMutationOptions<T, V> = UseMutationOptions<T, AppError, V>;
export type AppMutationResult<T, V> = UseMutationResult<T, AppError, V>;

/** Typed wrapper mirroring `useAppQuery`. See that file for the rationale. */
export const useAppMutation = <T, V = void>(
  options: AppMutationOptions<T, V>,
): AppMutationResult<T, V> => useMutation(options);
