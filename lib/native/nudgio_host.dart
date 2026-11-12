import 'package:flutter/services.dart';

import 'host_contract.dart';

/// The raw transport to the native core: a method name and named arguments
/// in, a `StandardMessageCodec` value out.
///
/// Only `NudgioClient` talks to a host. Screens never do: decoding, error
/// normalization and contract checks happen once, there.
abstract interface class NudgioHost {
  /// Resolves with the native result, or throws a [PlatformException] whose
  /// `details` is the MR-08 error envelope.
  Future<Object?> invoke(String method, Map<String, Object?> arguments);

  /// `{event, payload}` maps from the native side. Empty when the engine
  /// runs without a host (tests, desktop).
  Stream<Object?> get events;
}

/// The production host: one method channel and one event channel, answered
/// by `NudgioHostChannel.kt` on Android and `HostDispatcher.swift` on iPhone.
class MethodChannelNudgioHost implements NudgioHost {
  MethodChannelNudgioHost({MethodChannel? channel, EventChannel? eventChannel})
      : _channel = channel ?? const MethodChannel(hostChannelName),
        _eventChannel = eventChannel ?? const EventChannel(eventChannelName);

  final MethodChannel _channel;
  final EventChannel _eventChannel;
  Stream<Object?>? _events;

  @override
  Future<Object?> invoke(String method, Map<String, Object?> arguments) =>
      _channel.invokeMethod<Object?>(method, arguments);

  @override
  Stream<Object?> get events => _events ??= _eventChannel.receiveBroadcastStream().handleError(
        // A host that has no event channel (a desktop run) is not an error
        // for the UI: the journal-backed operation is the source of truth.
        (Object _) {},
        test: (error) => error is MissingPluginException,
      );
}
