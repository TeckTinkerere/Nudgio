import 'package:flutter/foundation.dart';

import 'error_codes.dart';

/// The application's error value.
///
/// A plain immutable value, not an `Exception`: it crosses the bridge, goes
/// into provider state and is compared in tests, none of which want a stack
/// trace attached.
///
/// Privacy invariant (MR-07, MR-08): an [AppError] must not carry a file path,
/// a media title or a user label. [safeDetails] is restricted to primitives and
/// checked by [assertNoSensitiveDetails] in debug builds.
@immutable
class AppError {
  const AppError({
    required this.code,
    required this.messageKey,
    required this.category,
    required this.retryable,
    required this.correlationId,
    this.field,
    this.safeDetails,
  });

  /// Builds an error, deriving [retryable] from the code when not given.
  factory AppError.create({
    required String code,
    required String messageKey,
    required ErrorCategory category,
    required String correlationId,
    bool? retryable,
    String? field,
    Map<String, Object>? safeDetails,
  }) =>
      AppError(
        code: code,
        messageKey: messageKey,
        category: category,
        retryable: retryable ?? isRetryable(code),
        correlationId: correlationId,
        field: field,
        safeDetails: safeDetails,
      );

  /// Stable machine code, e.g. `MR_STORAGE_INSUFFICIENT`.
  final String code;

  /// Localization key. MR-13 forbids storing a localized display string.
  final String messageKey;
  final ErrorCategory category;
  final bool retryable;

  /// Correlates the UI error with a local diagnostic entry (MR-07).
  final String correlationId;

  /// Field name for a validation error, so the form can focus it.
  final String? field;

  /// Bounded, non-identifying extras such as counts or byte thresholds.
  final Map<String, Object>? safeDetails;

  @override
  bool operator ==(Object other) =>
      other is AppError &&
      other.code == code &&
      other.messageKey == messageKey &&
      other.category == category &&
      other.retryable == retryable &&
      other.correlationId == correlationId &&
      other.field == field &&
      mapEquals(other.safeDetails, safeDetails);

  @override
  int get hashCode => Object.hash(code, messageKey, category, retryable, correlationId, field);

  @override
  String toString() => 'AppError($code, $messageKey, ${category.name}, field: $field)';
}

final _pathLike = RegExp(r'''(^|[\s"'])(/|[A-Za-z]:\\|file:|content:)''');

/// Anything that looks like a filesystem path or long free text is a privacy
/// leak in an error envelope. Debug only; release trusts the native contract,
/// which its own Kotlin and Swift tests cover.
void assertNoSensitiveDetails(AppError error) {
  if (!kDebugMode) return;
  final details = error.safeDetails;
  if (details == null) return;
  for (final MapEntry(:key, :value) in details.entries) {
    if (value is! String) continue;
    if (_pathLike.hasMatch(value) || value.length > 120) {
      throw StateError(
        'AppError.safeDetails["$key"] looks like a path or free text. '
        'MR-07 forbids file names and user labels in error envelopes.',
      );
    }
  }
}
