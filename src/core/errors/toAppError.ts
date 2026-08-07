/**
 * Normalizes anything thrown into an `AppError`.
 *
 * The bridge rejects with the MR-08 `NativeErrorEnvelope` shape, but MR-18
 * requires runtime decoding rather than trusting the wire: a malformed
 * rejection, a JS `TypeError` from a decoder, or a string thrown by a library
 * all have to end up as a well-formed, user-safe error.
 */
import {createAppError, type AppError} from './AppError';
import {ErrorCode, type ErrorCategory} from './errorCodes';

const CATEGORIES: readonly ErrorCategory[] = [
  'validation',
  'capability',
  'storage',
  'media',
  'schedule',
  'backup',
  'security',
  'internal',
];

const isCategory = (value: unknown): value is ErrorCategory =>
  typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** True when the value already matches the MR-08 envelope shape. */
export const isNativeErrorEnvelope = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.code === 'string' &&
  typeof value.messageKey === 'string' &&
  isCategory(value.category) &&
  typeof value.correlationId === 'string';

export interface ToAppErrorOptions {
  /** Correlation ID to use when the thrown value carries none. */
  readonly fallbackCorrelationId: string;
  /** Message key for an unrecognized failure. */
  readonly fallbackMessageKey?: string;
}

export const toAppError = (cause: unknown, options: ToAppErrorOptions): AppError => {
  if (isNativeErrorEnvelope(cause)) {
    const envelope = cause as Record<string, unknown>;
    return createAppError({
      code: envelope.code as string,
      messageKey: envelope.messageKey as string,
      category: envelope.category as ErrorCategory,
      correlationId: envelope.correlationId as string,
      retryable:
        typeof envelope.retryable === 'boolean' ? envelope.retryable : undefined,
      field: typeof envelope.field === 'string' ? envelope.field : undefined,
      safeDetails: isRecord(envelope.safeDetails)
        ? (envelope.safeDetails as Record<string, string | number | boolean>)
        : undefined,
    });
  }

  // React Native rejects TurboModule promises with a `code`-bearing Error when
  // the native side used `promise.reject(code, message)`. Salvage the code but
  // never surface the message: it may embed a path.
  const salvagedCode =
    isRecord(cause) && typeof cause.code === 'string'
      ? cause.code
      : ErrorCode.INTERNAL_FAILED_SAFE;

  return createAppError({
    code: salvagedCode,
    messageKey: options.fallbackMessageKey ?? 'error.unexpected',
    category: 'internal',
    correlationId: options.fallbackCorrelationId,
    retryable: false,
  });
};

/** The error used when the native module is absent (Metro-only dev, tests). */
export const bridgeUnavailableError = (correlationId: string): AppError =>
  createAppError({
    code: ErrorCode.BRIDGE_UNAVAILABLE,
    messageKey: 'error.bridgeUnavailable',
    category: 'internal',
    correlationId,
    retryable: true,
  });
