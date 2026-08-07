/**
 * MR-07: "No user-visible stack trace... Errors have four layers: domain
 * code, user-safe message key, diagnostic correlation ID, optional internal
 * cause." These tests pin the normalization behavior that guarantees a raw
 * throw can never reach a screen unshaped.
 */
import {assertNoSensitiveDetails, createAppError} from '../AppError';
import {ErrorCode} from '../errorCodes';
import {isNativeErrorEnvelope, toAppError} from '../toAppError';

describe('toAppError', () => {
  it('passes a well-formed native envelope through unchanged', () => {
    const envelope = {
      code: 'MR_STORAGE_INSUFFICIENT',
      messageKey: 'error.storage.insufficient',
      category: 'storage' as const,
      retryable: true,
      correlationId: 'abc-123',
    };

    const result = toAppError(envelope, {fallbackCorrelationId: 'fallback'});

    expect(result).toMatchObject(envelope);
  });

  it('falls back to INTERNAL_FAILED_SAFE for a bare thrown string', () => {
    const result = toAppError('boom', {fallbackCorrelationId: 'fallback-1'});

    expect(result.code).toBe(ErrorCode.INTERNAL_FAILED_SAFE);
    expect(result.category).toBe('internal');
    expect(result.correlationId).toBe('fallback-1');
  });

  it('salvages a code from an Error-shaped rejection without leaking its message', () => {
    const result = toAppError(
      {code: 'MR_MEDIA_UNAVAILABLE', message: '/private/data/user123/secret.mp4 missing'},
      {fallbackCorrelationId: 'fallback-2'},
    );

    expect(result.code).toBe('MR_MEDIA_UNAVAILABLE');
    expect(JSON.stringify(result)).not.toContain('secret.mp4');
  });
});

describe('isNativeErrorEnvelope', () => {
  it('rejects a payload missing a required field', () => {
    expect(isNativeErrorEnvelope({code: 'X', messageKey: 'y'})).toBe(false);
  });
});

describe('assertNoSensitiveDetails', () => {
  // The React Native Jest preset sets `__DEV__ = true` by default, which is
  // exactly the state `assertNoSensitiveDetails` checks (MR-07: the guard is
  // development-only, trusting the native contract's own tests in release).
  // No setup/teardown needed here beyond that default.

  it('throws in development when safeDetails looks like a filesystem path', () => {
    const error = createAppError({
      code: ErrorCode.INTERNAL_FAILED_SAFE,
      messageKey: 'error.unexpected',
      category: 'internal',
      correlationId: 'corr-1',
      safeDetails: {hint: '/data/user/0/com.aslam.mediareminder/files/media/foo.mp4'},
    });

    expect(() => assertNoSensitiveDetails(error)).toThrow(/MR-07/);
  });

  it('allows bounded, non-path safeDetails', () => {
    const error = createAppError({
      code: ErrorCode.STORAGE_INSUFFICIENT,
      messageKey: 'error.storage.insufficient',
      category: 'storage',
      correlationId: 'corr-2',
      safeDetails: {requiredMegabytes: 420, hasSpace: false},
    });

    expect(() => assertNoSensitiveDetails(error)).not.toThrow();
  });
});
