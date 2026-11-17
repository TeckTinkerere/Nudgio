import 'dart:async';

import 'package:flutter/services.dart';

import '../nudgio_host.dart';

typedef FakeHandler = FutureOr<Object?> Function(Map<String, Object?> arguments);

/// A programmable [NudgioHost] for tests and screen work without a device:
/// the Dart port of `mockNativeModule.ts`.
///
/// Register a handler per method with [on]. An unregistered method fails the
/// way the native hosts fail a declared-but-unimplemented method, so a test
/// that forgets a handler sees a typed error, not a hang.
class FakeNudgioHost implements NudgioHost {
  final Map<String, FakeHandler> _handlers = {};
  final StreamController<Object?> _events = StreamController.broadcast();

  /// Every call, in order, for assertions.
  final List<({String method, Map<String, Object?> arguments})> calls = [];

  void on(String method, FakeHandler handler) => _handlers[method] = handler;

  /// Resolves [method] with [value] (a wire-shaped map, list or primitive).
  void answer(String method, Object? value) => on(method, (_) => value);

  /// Rejects [method] with an MR-08 envelope, as a native host would.
  void reject(String method, Map<String, Object?> envelope) =>
      on(method, (_) => throw PlatformException(code: envelope['code']! as String, details: envelope));

  void emit(String event, Map<String, Object?> payload) => _events.add({'event': event, 'payload': payload});

  @override
  Future<Object?> invoke(String method, Map<String, Object?> arguments) async {
    calls.add((method: method, arguments: arguments));
    final handler = _handlers[method];
    if (handler == null) {
      throw PlatformException(
        code: 'MR_INTERNAL_FAILED_SAFE',
        details: {
          'code': 'MR_INTERNAL_FAILED_SAFE',
          'messageKey': 'error.notImplemented',
          'category': 'internal',
          'retryable': false,
          'correlationId': '00000000-0000-4000-8000-000000000000',
          'field': method,
        },
      );
    }
    return handler(arguments);
  }

  @override
  Stream<Object?> get events => _events.stream;

  Future<void> close() => _events.close();
}
