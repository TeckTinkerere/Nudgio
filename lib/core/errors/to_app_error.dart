import 'package:flutter/services.dart';

import 'app_error.dart';
import 'error_codes.dart';

/// True when [value] already matches the MR-08 `NativeErrorEnvelope` shape.
bool isNativeErrorEnvelope(Object? value) =>
    value is Map &&
    value['code'] is String &&
    value['messageKey'] is String &&
    ErrorCategory.tryParse(value['category']) != null &&
    value['correlationId'] is String;

/// Normalizes anything thrown into an [AppError].
///
/// The host rejects with the MR-08 envelope as a [PlatformException] whose
/// `details` is the envelope map. MR-18 requires runtime decoding rather than
/// trusting the wire: a malformed rejection, a decoder `TypeError` or a string
/// thrown by a library all have to end up as a well-formed, user-safe error.
AppError toAppError(
  Object? cause, {
  required String fallbackCorrelationId,
  String fallbackMessageKey = 'error.unexpected',
}) {
  final envelope = cause is PlatformException ? cause.details : cause;
  if (isNativeErrorEnvelope(envelope)) {
    final map = envelope! as Map;
    final retryable = map['retryable'];
    final field = map['field'];
    final details = map['safeDetails'];
    return AppError.create(
      code: map['code']! as String,
      messageKey: map['messageKey']! as String,
      category: ErrorCategory.tryParse(map['category'])!,
      correlationId: map['correlationId']! as String,
      retryable: retryable is bool ? retryable : null,
      field: field is String ? field : null,
      safeDetails: details is Map
          ? {
              for (final MapEntry(:key, :value) in details.entries)
                if (key is String && (value is String || value is num || value is bool)) key: value as Object,
            }
          : null,
    );
  }

  // Salvage a code from a platform rejection that skipped the envelope, but
  // never surface its message: it may embed a path.
  final salvagedCode = cause is PlatformException ? cause.code : ErrorCode.internalFailedSafe;
  return AppError.create(
    code: salvagedCode,
    messageKey: fallbackMessageKey,
    category: ErrorCategory.internal,
    correlationId: fallbackCorrelationId,
    retryable: false,
  );
}

/// The error used when no native host is registered (widget tests, a desktop
/// run). Retryable, as in the React Native client.
AppError bridgeUnavailableError(String correlationId) => AppError.create(
      code: ErrorCode.bridgeUnavailable,
      messageKey: 'error.bridgeUnavailable',
      category: ErrorCategory.internal,
      correlationId: correlationId,
      retryable: true,
    );
