/// Runtime decoding of host payloads (MR-18 "Runtime-decode native/external
/// payloads").
///
/// The host channel carries `StandardMessageCodec` values: maps, lists,
/// strings, ints, doubles, bools and null. [WireReader] turns one map into
/// typed fields and throws [WireFormatException] for anything that does not
/// fit, which `NudgioClient` reports as `MR_CONTRACT_MISMATCH` instead of
/// letting a `TypeError` reach a screen.
library;

/// A host payload that does not match the contract.
class WireFormatException implements Exception {
  const WireFormatException(this.path);

  /// Where decoding failed, e.g. `ReminderSummary.nextOccurrence.scheduledAt`.
  /// A field path only, never a value: values can be titles.
  final String path;

  @override
  String toString() => 'WireFormatException($path)';
}

/// Reads typed fields out of one wire map.
class WireReader {
  WireReader(Object? value, this.path)
      : _map = value is Map ? value : throw WireFormatException(path);

  final Map<Object?, Object?> _map;
  final String path;

  bool has(String key) => _map.containsKey(key) && _map[key] != null;

  Object? raw(String key) => _map[key];

  String string(String key) {
    final value = _map[key];
    if (value is String) return value;
    throw WireFormatException('$path.$key');
  }

  String? stringOrNull(String key) {
    final value = _map[key];
    if (value == null || value is String) return value as String?;
    throw WireFormatException('$path.$key');
  }

  /// JavaScript numbers crossed the old bridge as doubles; Kotlin `putInt`
  /// and Swift `Int` arrive here as `int`. Both are accepted when integral.
  int integer(String key) => intOrNull(key) ?? (throw WireFormatException('$path.$key'));

  int? intOrNull(String key) {
    final value = _map[key];
    if (value == null) return null;
    if (value is int) return value;
    if (value is double && value == value.truncateToDouble()) return value.toInt();
    throw WireFormatException('$path.$key');
  }

  bool boolean(String key) {
    final value = _map[key];
    if (value is bool) return value;
    throw WireFormatException('$path.$key');
  }

  bool? boolOrNull(String key) {
    final value = _map[key];
    if (value == null || value is bool) return value as bool?;
    throw WireFormatException('$path.$key');
  }

  /// An `Instant`: UTC ISO-8601.
  DateTime instant(String key) => instantOrNull(key) ?? (throw WireFormatException('$path.$key'));

  DateTime? instantOrNull(String key) {
    final value = stringOrNull(key);
    if (value == null) return null;
    return DateTime.tryParse(value)?.toUtc() ?? (throw WireFormatException('$path.$key'));
  }

  /// A `ByteCount`: a decimal string, because a byte count can exceed 2^53.
  BigInt bytes(String key) => bytesOrNull(key) ?? (throw WireFormatException('$path.$key'));

  BigInt? bytesOrNull(String key) {
    final value = _map[key];
    if (value == null) return null;
    if (value is String) return BigInt.tryParse(value) ?? (throw WireFormatException('$path.$key'));
    if (value is int) return BigInt.from(value);
    throw WireFormatException('$path.$key');
  }

  WireReader object(String key) => WireReader(_map[key], '$path.$key');

  WireReader? objectOrNull(String key) => _map[key] == null ? null : object(key);

  List<T> list<T>(String key, T Function(WireReader item) decode) {
    final value = _map[key];
    if (value is! List) throw WireFormatException('$path.$key');
    return [for (var i = 0; i < value.length; i++) decode(WireReader(value[i], '$path.$key[$i]'))];
  }

  List<T>? listOrNull<T>(String key, T Function(WireReader item) decode) =>
      _map[key] == null ? null : list(key, decode);

  List<String> strings(String key) {
    final value = _map[key];
    if (value is! List) throw WireFormatException('$path.$key');
    return [
      for (var i = 0; i < value.length; i++)
        value[i] is String ? value[i]! as String : throw WireFormatException('$path.$key[$i]'),
    ];
  }

  List<int> ints(String key) {
    final value = _map[key];
    if (value is! List) throw WireFormatException('$path.$key');
    return [
      for (var i = 0; i < value.length; i++)
        switch (value[i]) {
          final int n => n,
          final double d when d == d.truncateToDouble() => d.toInt(),
          _ => throw WireFormatException('$path.$key[$i]'),
        },
    ];
  }

  /// One of [values] by `name`, matching the wire's snake_case strings.
  T enumValue<T extends Enum>(String key, List<T> values, String Function(T value) wireName) {
    final value = string(key);
    for (final candidate in values) {
      if (wireName(candidate) == value) return candidate;
    }
    throw WireFormatException('$path.$key');
  }
}

/// Builds a wire map, dropping null entries so "absent" stays absent: the
/// native readers treat a missing key as "leave alone" in patch requests.
Map<String, Object?> wireMap(Map<String, Object?> entries) => {
      for (final MapEntry(:key, :value) in entries.entries)
        key: ?value,
    };

String instantToWire(DateTime value) => value.toUtc().toIso8601String().replaceFirst(RegExp(r'\.000Z$'), 'Z');
