/**
 * Touch/confirmation haptics.
 *
 * MR-03: "Alarm and notification actions respond immediately with haptic
 * confirmation where allowed." MR-04's alarm-button-confirmation motion token
 * falls back to "Haptic/color only" under reduced motion, and MR-13 names a
 * "stronger haptics toggle where supported" whose "custom vibration patterns
 * are bounded and previewable."
 *
 * Built on React Native's core `Vibration` module rather than a third-party
 * haptics library: it needs no new native dependency (AGENTS.md gates those
 * behind an ADR) and no new Android permission — `VIBRATE` is already
 * declared by React Native's own manifest.
 *
 * Android-only, matching the app's v1 scope (AGENTS.md): iOS has no
 * equivalent build target, so there is nothing to branch on.
 */
import {Platform, Vibration} from 'react-native';

export type HapticPattern = 'light' | 'confirm' | 'warning';

export interface HapticsService {
  /**
   * Fires a bounded, non-looping vibration. `stronger` selects the MR-13
   * "stronger haptics" intensity; both variants stay short enough to be a
   * confirmation, never a ring pattern.
   */
  vibrate(pattern: HapticPattern, stronger: boolean): void;
}

/** Milliseconds. Bounded per MR-13 — the longest pattern is under 150 ms. */
const DURATIONS_MS: Readonly<Record<HapticPattern, {readonly standard: number; readonly stronger: number}>> = {
  light: {standard: 10, stronger: 20},
  confirm: {standard: 25, stronger: 45},
  warning: {standard: 40, stronger: 70},
};

export const createSystemHaptics = (): HapticsService => ({
  vibrate: (pattern, stronger) => {
    if (Platform.OS !== 'android') {
      return;
    }
    const spec = DURATIONS_MS[pattern];
    Vibration.vibrate(stronger ? spec.stronger : spec.standard);
  },
});

/** Test/preview double: records calls instead of touching the platform API. */
export interface RecordingHaptics extends HapticsService {
  readonly calls: ReadonlyArray<{readonly pattern: HapticPattern; readonly stronger: boolean}>;
}

export const createRecordingHaptics = (): RecordingHaptics => {
  const calls: Array<{pattern: HapticPattern; stronger: boolean}> = [];
  return {
    calls,
    vibrate: (pattern, stronger) => {
      calls.push({pattern, stronger});
    },
  };
};
