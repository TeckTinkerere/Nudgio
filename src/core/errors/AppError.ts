/**
 * The application's error value.
 *
 * Deliberately a plain object, not an `Error` subclass: it crosses the bridge,
 * goes into query caches and is compared in tests, none of which want a stack
 * trace attached.
 *
 * Privacy invariant (MR-07, MR-08): an `AppError` MUST NOT carry a file path,
 * a media title or a user label. `safeDetails` is restricted to primitives and
 * is stripped by `assertNoSensitiveDetails` in debug builds.
 */
import {isRetryable, type ErrorCategory, type ErrorCodeValue} from './errorCodes';

export interface AppError {
  /** Stable machine code, e.g. `MR_STORAGE_INSUFFICIENT`. */
  readonly code: string;
  /** Localization key. MR-13 forbids storing a localized display string. */
  readonly messageKey: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  /** Correlates the UI error with a local diagnostic entry (MR-07). */
  readonly correlationId: string;
  /** Field name for a validation error, so the form can focus it. */
  readonly field?: string;
  /** Bounded, non-identifying extras such as counts or byte thresholds. */
  readonly safeDetails?: Readonly<Record<string, string | number | boolean>>;
}

export interface CreateAppErrorInput {
  readonly code: ErrorCodeValue | string;
  readonly messageKey: string;
  readonly category: ErrorCategory;
  readonly correlationId: string;
  readonly retryable?: boolean;
  readonly field?: string;
  readonly safeDetails?: Readonly<Record<string, string | number | boolean>>;
}

export const createAppError = (input: CreateAppErrorInput): AppError => ({
  code: input.code,
  messageKey: input.messageKey,
  category: input.category,
  retryable: input.retryable ?? isRetryable(input.code),
  correlationId: input.correlationId,
  field: input.field,
  safeDetails: input.safeDetails,
});

/**
 * Anything that looks like a filesystem path or a long free-text value is a
 * privacy leak in an error envelope. This runs in development only; release
 * builds trust the native contract, which is covered by its own Kotlin tests.
 */
const PATH_LIKE = /(^|[\s"'])(\/|[A-Za-z]:\\|file:|content:)/;

export const assertNoSensitiveDetails = (error: AppError): void => {
  if (!__DEV__ || error.safeDetails === undefined) {
    return;
  }
  for (const [key, value] of Object.entries(error.safeDetails)) {
    if (typeof value !== 'string') {
      continue;
    }
    if (PATH_LIKE.test(value) || value.length > 120) {
      throw new Error(
        `AppError.safeDetails["${key}"] looks like a path or free text. MR-07 forbids file names and user labels in error envelopes.`,
      );
    }
  }
};
