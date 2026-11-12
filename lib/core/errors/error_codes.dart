/// Domain error codes (MR-08 error-envelope table).
///
/// The Dart half of a three-sided contract: Kotlin (`NativeErrorEnvelope.kt`)
/// and Swift (`NudgioKernel/HostError.swift`) emit the same strings. Codes are
/// stable identifiers, never user-visible text; the translated message comes
/// from `messageKey` (MR-13).
abstract final class ErrorCode {
  static const validationFailed = 'MR_VALIDATION_FAILED';

  static const mediaUnsupportedType = 'MR_MEDIA_UNSUPPORTED_TYPE';
  static const mediaUnavailable = 'MR_MEDIA_UNAVAILABLE';

  static const storageInsufficient = 'MR_STORAGE_INSUFFICIENT';

  /// A write into shared storage failed for a reason other than space.
  static const storageWriteFailed = 'MR_STORAGE_WRITE_FAILED';

  static const scheduleNonexistentTime = 'MR_SCHEDULE_NONEXISTENT_TIME';
  static const scheduleAmbiguousTime = 'MR_SCHEDULE_AMBIGUOUS_TIME';

  static const exactAccessRequired = 'MR_EXACT_ACCESS_REQUIRED';
  static const notificationBlocked = 'MR_NOTIFICATION_BLOCKED';

  static const backupChecksumInvalid = 'MR_BACKUP_CHECKSUM_INVALID';
  static const backupTooNew = 'MR_BACKUP_TOO_NEW';

  static const actionAlreadyResolved = 'MR_ACTION_ALREADY_RESOLVED';

  static const internalFailedSafe = 'MR_INTERNAL_FAILED_SAFE';

  /// Client-side only: no native host answered. Never emitted natively.
  static const bridgeUnavailable = 'MR_BRIDGE_UNAVAILABLE';

  /// Client-side only: the host answered with something the decoder rejected,
  /// or reported a contract version this build does not speak.
  static const contractMismatch = 'MR_CONTRACT_MISMATCH';
}

/// MR-08 error categories.
enum ErrorCategory {
  validation,
  capability,
  storage,
  media,
  schedule,
  backup,
  security,
  internal;

  static ErrorCategory? tryParse(Object? value) {
    for (final category in values) {
      if (category.name == value) return category;
    }
    return null;
  }
}

/// Whether retrying the identical request can plausibly succeed (the "Retry"
/// column of the MR-08 table). Decides whether the UI offers a retry
/// affordance; it never triggers an automatic retry loop.
bool isRetryable(String code) => switch (code) {
      ErrorCode.storageInsufficient ||
      ErrorCode.exactAccessRequired ||
      ErrorCode.notificationBlocked ||
      ErrorCode.scheduleNonexistentTime ||
      ErrorCode.scheduleAmbiguousTime ||
      ErrorCode.backupTooNew ||
      ErrorCode.bridgeUnavailable =>
        true,
      _ => false,
    };

/// MR-08: a duplicate Play/Snooze/Dismiss is "treated as success-like".
bool isSuccessLike(String code) => code == ErrorCode.actionAlreadyResolved;
