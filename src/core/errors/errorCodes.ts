/**
 * Domain error codes.
 *
 * These mirror the representative codes in the MR-08 error-envelope table.
 * The list is the TypeScript half of a two-sided contract: the Kotlin side
 * emits the same string constants, and the contract fixtures in
 * `src/testing` assert both halves agree.
 *
 * Codes are stable identifiers, never user-visible text. The translated
 * message comes from `messageKey` on the envelope (MR-13: "Persist stable
 * semantic values, never localized display strings").
 */

export const ErrorCode = {
  // validation
  VALIDATION_FAILED: 'MR_VALIDATION_FAILED',

  // media
  MEDIA_UNSUPPORTED_TYPE: 'MR_MEDIA_UNSUPPORTED_TYPE',
  MEDIA_UNAVAILABLE: 'MR_MEDIA_UNAVAILABLE',

  // storage
  STORAGE_INSUFFICIENT: 'MR_STORAGE_INSUFFICIENT',

  // schedule
  SCHEDULE_NONEXISTENT_TIME: 'MR_SCHEDULE_NONEXISTENT_TIME',
  SCHEDULE_AMBIGUOUS_TIME: 'MR_SCHEDULE_AMBIGUOUS_TIME',

  // capability
  EXACT_ACCESS_REQUIRED: 'MR_EXACT_ACCESS_REQUIRED',
  NOTIFICATION_BLOCKED: 'MR_NOTIFICATION_BLOCKED',

  // backup
  BACKUP_CHECKSUM_INVALID: 'MR_BACKUP_CHECKSUM_INVALID',
  BACKUP_TOO_NEW: 'MR_BACKUP_TOO_NEW',

  // alarm action
  ACTION_ALREADY_RESOLVED: 'MR_ACTION_ALREADY_RESOLVED',

  // internal
  INTERNAL_FAILED_SAFE: 'MR_INTERNAL_FAILED_SAFE',

  /**
   * Client-side only: the bridge is unreachable or returned something the
   * decoder rejected. Never emitted by Kotlin.
   */
  BRIDGE_UNAVAILABLE: 'MR_BRIDGE_UNAVAILABLE',
  CONTRACT_MISMATCH: 'MR_CONTRACT_MISMATCH',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** MR-08 error categories. */
export type ErrorCategory =
  | 'validation'
  | 'capability'
  | 'storage'
  | 'media'
  | 'schedule'
  | 'backup'
  | 'security'
  | 'internal';

/**
 * Whether retrying the identical request can plausibly succeed, per the
 * "Retry" column of the MR-08 table. Used to decide if the UI offers a retry
 * affordance — it never triggers an automatic retry loop.
 */
export const isRetryable = (code: string): boolean => {
  switch (code) {
    case ErrorCode.STORAGE_INSUFFICIENT:
    case ErrorCode.EXACT_ACCESS_REQUIRED:
    case ErrorCode.NOTIFICATION_BLOCKED:
    case ErrorCode.SCHEDULE_NONEXISTENT_TIME:
    case ErrorCode.SCHEDULE_AMBIGUOUS_TIME:
    case ErrorCode.BACKUP_TOO_NEW:
    case ErrorCode.BRIDGE_UNAVAILABLE:
      return true;
    default:
      return false;
  }
};

/**
 * MR-08: `MR_ACTION_ALREADY_RESOLVED` is "Treated as success-like result".
 * A duplicate Play/Snooze/Dismiss is the expected outcome of a double tap or a
 * replayed notification intent, not a failure to show the user.
 */
export const isSuccessLike = (code: string): boolean =>
  code === ErrorCode.ACTION_ALREADY_RESOLVED;
