/// Storage figures in decimal units, matching what Android and iPhone storage
/// screens show (486 MB here is 486 MB in Settings, not a binary figure that
/// reads ~5% smaller). Accepts the decimal-string `ByteCount` the host sends.
String formatStorageSize(Object bytes) {
  final double? value = switch (bytes) {
    final BigInt b => b.toDouble(),
    final num n => n.toDouble(),
    final String s => double.tryParse(s),
    _ => null,
  };
  // A malformed byte count is not worth a crash in a settings row.
  if (value == null || !value.isFinite) return '—';
  final mb = value / 1000000;
  // Never round a real file down to "0 MB": that reads as "nothing stored".
  if (mb < 1 && value > 0) return '<1 MB';
  if (mb < 1000) return '${mb.round()} MB';
  return '${(mb / 1000).toStringAsFixed(1)} GB';
}
