import 'package:flutter/foundation.dart';

enum LogLevel { debug, info, warn, error }

typedef LogFields = Map<String, Object?>;

/// The Dart counterpart of `Logger.ts` and `NativeLogger.kt`.
///
/// Events are stable dotted names; fields are counts, codes and durations. No
/// titles, notes, labels or paths, at any level (MR-07): a log line is the one
/// place private content could leave the app, if someone shares a bug report.
abstract interface class Logger {
  void debug(String event, [LogFields fields]);
  void info(String event, [LogFields fields]);
  void warn(String event, [LogFields fields]);
  void error(String event, [LogFields fields]);
}

/// Writes through `debugPrint`. Debug events are dropped outside debug builds,
/// matching the build-variant gating of the React Native and Kotlin loggers.
class ConsoleLogger implements Logger {
  const ConsoleLogger();

  void _write(LogLevel level, String event, LogFields fields) {
    if (level == LogLevel.debug && !kDebugMode) return;
    debugPrint('[nudgio] ${level.name} $event${fields.isEmpty ? '' : ' $fields'}');
  }

  @override
  void debug(String event, [LogFields fields = const {}]) => _write(LogLevel.debug, event, fields);
  @override
  void info(String event, [LogFields fields = const {}]) => _write(LogLevel.info, event, fields);
  @override
  void warn(String event, [LogFields fields = const {}]) => _write(LogLevel.warn, event, fields);
  @override
  void error(String event, [LogFields fields = const {}]) => _write(LogLevel.error, event, fields);
}

@immutable
class RecordedLog {
  const RecordedLog(this.level, this.event, this.fields);
  final LogLevel level;
  final String event;
  final LogFields fields;
}

/// Keeps every event in memory, for tests that assert what was logged.
class RecordingLogger implements Logger {
  final List<RecordedLog> records = [];

  @override
  void debug(String event, [LogFields fields = const {}]) => records.add(RecordedLog(LogLevel.debug, event, fields));
  @override
  void info(String event, [LogFields fields = const {}]) => records.add(RecordedLog(LogLevel.info, event, fields));
  @override
  void warn(String event, [LogFields fields = const {}]) => records.add(RecordedLog(LogLevel.warn, event, fields));
  @override
  void error(String event, [LogFields fields = const {}]) => records.add(RecordedLog(LogLevel.error, event, fields));
}
