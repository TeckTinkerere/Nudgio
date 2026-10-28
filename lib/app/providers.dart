import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/logging/logger.dart';
import '../core/result.dart';
import '../native/nudgio_client.dart';
import '../native/nudgio_host.dart';
import '../native/types.dart';

/// Dependency wiring (the Riverpod replacement for `AppContainer`). Tests
/// override [hostProvider] with a `FakeNudgioHost`, the way
/// `createTestContainer()` installed a mock native module.
final hostProvider = Provider<NudgioHost>((ref) => MethodChannelNudgioHost());

final loggerProvider = Provider<Logger>((ref) => const ConsoleLogger());

final clientProvider = Provider<NudgioClient>(
  (ref) => NudgioClient(
    host: ref.watch(hostProvider),
    logger: ref.watch(loggerProvider),
    strictContractVersion: kDebugMode,
  ),
);

/// Native state is the source of truth; these providers only cache snapshots
/// and are invalidated after every mutation, never patched by hand.
final startupProvider = FutureProvider<Result<StartupSnapshot>>(
  (ref) => ref.watch(clientProvider).getStartupSnapshot(),
);

final remindersProvider = FutureProvider<Result<Page<ReminderSummary>>>(
  (ref) => ref.watch(clientProvider).listReminders(),
);
