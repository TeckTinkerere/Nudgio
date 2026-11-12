import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/core/errors/app_error.dart';
import 'package:nudgio/core/errors/error_codes.dart';
import 'package:nudgio/core/errors/to_app_error.dart';

void main() {
  const envelope = {
    'code': 'MR_STORAGE_INSUFFICIENT',
    'messageKey': 'error.storageInsufficient',
    'category': 'storage',
    'correlationId': 'c-1',
    'field': 'share',
    'safeDetails': {'neededMb': 12, 'path': '/data/x', 'nested': <String, Object>{}},
  };

  test('decodes the envelope from a PlatformException, deriving retryable from the code', () {
    final error = toAppError(PlatformException(code: 'MR_STORAGE_INSUFFICIENT', details: envelope),
        fallbackCorrelationId: 'unused');
    expect(error.code, ErrorCode.storageInsufficient);
    expect(error.category, ErrorCategory.storage);
    expect(error.retryable, isTrue);
    expect(error.correlationId, 'c-1');
    expect(error.field, 'share');
    // Primitives only: a nested map never reaches safeDetails.
    expect(error.safeDetails, {'neededMb': 12, 'path': '/data/x'});
  });

  test('an explicit retryable flag wins over the code table', () {
    final error = toAppError({...envelope, 'retryable': false}, fallbackCorrelationId: 'unused');
    expect(error.retryable, isFalse);
  });

  test('a rejection without an envelope keeps the code but never the message', () {
    final error = toAppError(PlatformException(code: 'E_WEIRD', message: '/sdcard/private.jpg'),
        fallbackCorrelationId: 'fallback');
    expect(error.code, 'E_WEIRD');
    expect(error.messageKey, 'error.unexpected');
    expect(error.correlationId, 'fallback');
    expect(error.toString(), isNot(contains('sdcard')));
  });

  test('anything else is failed-safe', () {
    final error = toAppError(StateError('boom'), fallbackCorrelationId: 'f');
    expect(error.code, ErrorCode.internalFailedSafe);
    expect(error.category, ErrorCategory.internal);
    expect(error.retryable, isFalse);
  });

  test('an unknown category is not an envelope', () {
    expect(isNativeErrorEnvelope({...envelope, 'category': 'cosmic'}), isFalse);
  });

  test('assertNoSensitiveDetails rejects path-like details in debug', () {
    final leaky = AppError.create(
      code: 'X',
      messageKey: 'k',
      category: ErrorCategory.internal,
      correlationId: 'c',
      safeDetails: {'file': 'content://media/1'},
    );
    expect(() => assertNoSensitiveDetails(leaky), throwsStateError);
  });

  test('already-resolved is success-like, and only it', () {
    expect(isSuccessLike(ErrorCode.actionAlreadyResolved), isTrue);
    expect(isSuccessLike(ErrorCode.internalFailedSafe), isFalse);
  });
}
