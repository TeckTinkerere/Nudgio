/**
 * Explicit success/failure type.
 *
 * MR-18: "Errors use typed domain envelopes and safe message keys." Repository
 * and service methods return `Result` rather than throwing, so a caller cannot
 * forget that an operation can fail — the type will not let them read `.value`
 * without narrowing first.
 *
 * Exceptions are still used for programmer errors (a missing provider, a
 * broken invariant). `Result` is for expected, user-visible failure.
 */
import type {AppError} from '../errors/AppError';

export type Result<T, E = AppError> =
  | {readonly ok: true; readonly value: T}
  | {readonly ok: false; readonly error: E};

export const ok = <T>(value: T): Result<T, never> => ({ok: true, value});

export const err = <E>(error: E): Result<never, E> => ({ok: false, error});

export const isOk = <T, E>(
  result: Result<T, E>,
): result is {ok: true; value: T} => result.ok;

export const isErr = <T, E>(
  result: Result<T, E>,
): result is {ok: false; error: E} => !result.ok;

export const map = <T, U, E>(
  result: Result<T, E>,
  transform: (value: T) => U,
): Result<U, E> => (result.ok ? ok(transform(result.value)) : result);

export const mapError = <T, E, F>(
  result: Result<T, E>,
  transform: (error: E) => F,
): Result<T, F> => (result.ok ? result : err(transform(result.error)));

export const unwrapOr = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

/**
 * Run a promise-returning operation and normalize any throw into a `Result`.
 *
 * Every bridge call goes through this, so a native rejection can never escape
 * as an unhandled promise rejection and crash the JS thread.
 */
export const attempt = async <T>(
  operation: () => Promise<T>,
  toError: (cause: unknown) => AppError,
): Promise<Result<T, AppError>> => {
  try {
    return ok(await operation());
  } catch (cause) {
    return err(toError(cause));
  }
};
