/**
 * Material You (dynamic color).
 *
 * MR-04 states that dynamic color "MAY be offered later but the fixed brand
 * palette remains the default for consistent screenshots and alarm
 * recognition". This module implements it as an explicit opt-in; the brand
 * scheme stays the default. See docs/decision-log.md entry DL-002.
 *
 * Rather than reimplementing HCT tonal-palette generation in JavaScript, the
 * native side reads Android's own `system_accent*` / `system_neutral*` ramps
 * (API 31+) and hands them across the bridge. That is the same source the
 * platform uses, so the app matches the system's idea of the wallpaper palette
 * exactly instead of approximating it.
 *
 * Two roles are deliberately NOT derived from the wallpaper:
 *
 *  - `error`, because MR-04 reserves red for destructive action and blocking
 *    fault. A green-tinted "error" would break that contract.
 *  - `success`, for the same reason in reverse.
 *
 * Both stay on the brand values so status meaning survives any wallpaper.
 */

import type {ColorRoles} from './colorRoles';
import {blend, preferAccessible, readableOn, withAlpha} from './colorUtils';
import {darkScheme, lightScheme, type ThemeAppearance} from './schemes';
import {brandPalette} from '../tokens/palette';

/** Tonal stops exposed by Android's dynamic color ramps. */
export type ToneStop =
  | 0
  | 10
  | 50
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 1000;

export type TonalRamp = Readonly<Record<ToneStop, string>>;

/**
 * The payload returned by the native `getDynamicColorScheme()` call.
 * `null` on API < 31 or when the platform declines to report a palette.
 */
export interface DynamicColorPayload {
  readonly accent1: TonalRamp;
  readonly accent2: TonalRamp;
  readonly accent3: TonalRamp;
  readonly neutral1: TonalRamp;
  readonly neutral2: TonalRamp;
}

const TONE_STOPS: readonly ToneStop[] = [
  0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
];

const HEX = /^#[0-9a-f]{6}$/i;

const isTonalRamp = (value: unknown): value is TonalRamp => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const ramp = value as Record<string, unknown>;
  return TONE_STOPS.every(stop => {
    const entry = ramp[String(stop)];
    return typeof entry === 'string' && HEX.test(entry);
  });
};

/**
 * Runtime-decode the bridge payload.
 *
 * MR-18: "Runtime-decode native/external payloads where Codegen cannot
 * guarantee." A malformed ramp must degrade to the brand palette, never throw
 * during theme construction and white-screen the app.
 */
export const decodeDynamicColorPayload = (
  value: unknown,
): DynamicColorPayload | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const ramps = ['accent1', 'accent2', 'accent3', 'neutral1', 'neutral2'] as const;
  if (!ramps.every(name => isTonalRamp(candidate[name]))) {
    return null;
  }
  return {
    accent1: candidate.accent1 as TonalRamp,
    accent2: candidate.accent2 as TonalRamp,
    accent3: candidate.accent3 as TonalRamp,
    neutral1: candidate.neutral1 as TonalRamp,
    neutral2: candidate.neutral2 as TonalRamp,
  };
};

/**
 * Map Android's tonal ramps onto our semantic roles.
 *
 * The stop choices follow the Material 3 dynamic-color specification: in a
 * light scheme `primary` is tone 600 of accent1 and its container is tone 100;
 * in a dark scheme those invert to 200 and 700 respectively.
 */
export const schemeFromDynamicColor = (
  payload: DynamicColorPayload,
  appearance: ThemeAppearance,
): ColorRoles => {
  const isDark = appearance === 'dark';
  const fallback = isDark ? darkScheme : lightScheme;
  const {accent1, accent2, neutral1, neutral2} = payload;

  const surface = isDark ? neutral1[900] : neutral1[10];
  const surfaceContainer = isDark ? neutral1[800] : neutral1[100];
  const onSurface = isDark ? neutral1[100] : neutral1[900];

  const primary = isDark ? accent1[200] : accent1[600];
  const secondary = isDark ? accent2[200] : accent2[600];

  const errorContainer = blend(surface, fallback.error, isDark ? 0.24 : 0.12);
  const successContainer = blend(surface, fallback.success, isDark ? 0.24 : 0.12);

  return {
    primary,
    onPrimary: isDark ? accent1[800] : accent1[0],
    primaryContainer: isDark ? accent1[700] : accent1[100],
    onPrimaryContainer: isDark ? accent1[100] : accent1[900],

    secondary,
    onSecondary: isDark ? accent2[800] : accent2[0],
    secondaryContainer: isDark ? accent2[700] : accent2[100],
    onSecondaryContainer: isDark ? accent2[100] : accent2[900],

    surface,
    surfaceContainer,
    surfaceContainerHigh: isDark ? neutral1[700] : neutral1[200],
    onSurface,
    onSurfaceVariant: isDark ? neutral2[200] : neutral2[700],
    onSurfaceDisabled: blend(surface, onSurface, 0.38),

    outline: isDark ? neutral2[400] : neutral2[500],
    outlineVariant: isDark ? neutral2[700] : neutral2[200],

    // Status colors stay on brand — see the module comment. Their containers
    // are still washed over the *dynamic* surface, so the `on*` partners must
    // be measured here too: a wallpaper-derived surface can push a pairing
    // under ACC-005 that passes against the brand surface.
    error: fallback.error,
    onError: fallback.onError,
    errorContainer,
    onErrorContainer: preferAccessible(errorContainer, fallback.error, onSurface),

    success: fallback.success,
    onSuccess: fallback.onSuccess,
    successContainer,
    onSuccessContainer: preferAccessible(successContainer, fallback.success, onSurface),

    scrim: withAlpha('#000000', isDark ? 0.64 : 0.48),

    inverseSurface: isDark ? neutral1[100] : neutral1[800],
    inverseOnSurface: isDark ? neutral1[800] : neutral1[50],

    // Guarantee the focus ring stays visible on the dynamic surface even if
    // the wallpaper accent is close to the background (MR-04 "States").
    focusRing: readableOn(surface, primary, onSurface),
  };
};

/**
 * `brandPalette` is re-exported so a consumer comparing dynamic vs. brand
 * output does not have to reach into the tokens folder directly.
 */
export {brandPalette};
