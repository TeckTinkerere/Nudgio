import 'errors/app_error.dart';

/// Explicit success/failure type (MR-18: "Errors use typed domain envelopes").
///
/// Client and repository methods return [Result] rather than throwing, so a
/// caller cannot forget that an operation can fail: `switch` over the sealed
/// type is exhaustive. Exceptions remain for programmer errors only.
sealed class Result<T> {
  const Result();

  bool get isOk => this is Ok<T>;

  /// The value, or [fallback] on failure.
  T valueOr(T fallback) => switch (this) {
        Ok(:final value) => value,
        Err() => fallback,
      };

  Result<U> map<U>(U Function(T value) transform) => switch (this) {
        Ok(:final value) => Ok(transform(value)),
        Err(:final error) => Err(error),
      };
}

final class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;

  @override
  bool operator ==(Object other) => other is Ok<T> && other.value == value;

  @override
  int get hashCode => value.hashCode;

  @override
  String toString() => 'Ok($value)';
}

final class Err<T> extends Result<T> {
  const Err(this.error);
  final AppError error;

  @override
  bool operator ==(Object other) => other is Err<T> && other.error == error;

  @override
  int get hashCode => error.hashCode;

  @override
  String toString() => 'Err($error)';
}

/// Runs [operation] and turns any throw into an [Err] through [toError], so a
/// native rejection never escapes as an unhandled async error.
Future<Result<T>> attempt<T>(
  Future<T> Function() operation,
  AppError Function(Object cause) toError,
) async {
  try {
    return Ok(await operation());
  } on Object catch (cause) {
    return Err(toError(cause));
  }
}
