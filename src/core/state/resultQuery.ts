/**
 * Bridges `Result<T, AppError>` into React Query, which expects a
 * throw-to-fail query function.
 *
 * Repositories return `Result` so non-UI callers (services, other
 * repositories) are forced to handle failure explicitly. React Query's model
 * is throw-based. Rather than have two failure conventions leak into feature
 * code, this one adapter unwraps `Result` at the query boundary, and
 * `useAppQuery`/`useAppMutation` (in `src/hooks`) are the only place a
 * feature touches React Query's `error` as an `AppError`.
 */
import type {AppError} from '../errors';
import type {Result} from '../result/Result';

export const unwrapResult = async <T>(
  operation: () => Promise<Result<T, AppError>>,
): Promise<T> => {
  const result = await operation();
  if (result.ok) {
    return result.value;
  }
  // React Query stores whatever is thrown as `query.error`. Throwing the
  // `AppError` object itself (not a generic `Error`) is what lets
  // `useAppQuery` hand back a typed, structured error instead of a message
  // string the UI would have to parse.
  throw result.error;
};
