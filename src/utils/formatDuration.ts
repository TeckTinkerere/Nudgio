/**
 * Media duration formatting for MediaCard/MediaDetail (MR-04, MR-13).
 *
 * MR-13 "Media card" example: "1 minute 33 seconds" for the accessible label,
 * vs. a compact "1:33" for the visible chip. Both are produced from the same
 * input so they can never disagree.
 */
export const formatDurationCompact = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
};

/**
 * Accessible duration, e.g. "1 minute 33 seconds" (MR-13 TalkBack example).
 * `t` is injected so this stays free of a hardcoded English plural rule.
 */
export const formatDurationAccessible = (
  durationMs: number,
  formatUnit: (value: number, unit: 'minute' | 'second') => string,
): string => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (minutes > 0) {
    parts.push(formatUnit(minutes, 'minute'));
  }
  if (seconds > 0 || minutes === 0) {
    parts.push(formatUnit(seconds, 'second'));
  }
  return parts.join(' ');
};
