/**
 * Byte-count formatting.
 *
 * MR-08: byte sizes cross the bridge as decimal strings because they can
 * exceed `Number.MAX_SAFE_INTEGER`. Display, however, only ever needs an
 * approximate magnitude, so this converts through `Number` deliberately and
 * documents why that is safe here specifically: no library storage or backup
 * realistically approaches 2^53 bytes (9 million TB), and MR-09's hard caps
 * (2 GB per asset, 10 GB per backup) are many orders of magnitude below it.
 */
import type {ByteCount} from '../native-client/types';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export const formatBytes = (value: ByteCount | string | number): string => {
  const bytes = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes === 0) {
    return '0 B';
  }

  const exponent = Math.min(
    UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const scaled = bytes / 1024 ** exponent;
  const precision = exponent === 0 ? 0 : scaled < 10 ? 1 : 0;

  return `${scaled.toFixed(precision)} ${UNITS[exponent]}`;
};
