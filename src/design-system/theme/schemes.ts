/**
 * Brand color schemes (MR-04 default).
 *
 * Values named in the MR-04 table are used verbatim. Every other role is
 * derived here with an explicit, reviewable rule so that a designer changing
 * one ramp value does not have to hand-edit twenty dependent colors.
 */
import type {ColorRoles, StatusRoles} from './colorRoles';
import {blend, preferAccessible, readableOn, withAlpha} from './colorUtils';
import {brandPalette, neutral, scrimOpacity, stateLayerOpacity} from '../tokens/palette';


export type ThemeAppearance = 'light' | 'dark';

const buildScheme = (appearance: ThemeAppearance): ColorRoles => {
  const base = brandPalette[appearance];
  const isDark = appearance === 'dark';
  const {black, white} = neutral;

  // Tinted containers, derived before the role map so their `on*` partners can
  // be measured against them.
  const secondaryContainer = blend(base.surface, base.secondary, isDark ? 0.24 : 0.16);
  const errorContainer = blend(base.surface, base.error, isDark ? 0.24 : 0.12);
  const successContainer = blend(base.surface, base.success, isDark ? 0.24 : 0.12);

  return {
    primary: base.primary,
    onPrimary: base.onPrimary,
    primaryContainer: base.primaryContainer,
    onPrimaryContainer: base.onPrimaryContainer,

    secondary: base.secondary,
    // Derived: MR-04 fixes only `secondary`. Pick the readable pair rather than
    // assuming white, because amber-on-white fails ACC-005 in light mode.
    onSecondary: readableOn(base.secondary, white, black),
    // Derived: a 16%/24% wash of the accent over the app surface keeps the
    // container tinted without inventing a second hue.
    secondaryContainer,
    onSecondaryContainer: preferAccessible(
      secondaryContainer,
      base.secondary,
      base.onSurface,
    ),

    surface: base.surface,
    surfaceContainer: base.surfaceContainer,
    // Derived: one further step in the same direction as surface -> container.
    surfaceContainerHigh: blend(base.surfaceContainer, isDark ? white : black, 0.04),

    onSurface: base.onSurface,
    onSurfaceVariant: base.onSurfaceVariant,
    // Derived: Material's 38% disabled content opacity over the surface.
    onSurfaceDisabled: blend(
      base.surface,
      base.onSurface,
      stateLayerOpacity.disabledContent,
    ),

    outline: base.outline,
    // Derived: half-strength outline for decorative separators.
    outlineVariant: blend(base.surface, base.outline, 0.45),

    error: base.error,
    onError: readableOn(base.error, white, black),
    errorContainer,
    onErrorContainer: preferAccessible(errorContainer, base.error, base.onSurface),

    success: base.success,
    onSuccess: readableOn(base.success, white, black),
    successContainer,
    // The light success green measures 4.07:1 on its own container, so this
    // resolves to `onSurface` in light and stays green in dark. See
    // docs/decision-log.md DL-003.
    onSuccessContainer: preferAccessible(successContainer, base.success, base.onSurface),

    scrim: withAlpha(black, scrimOpacity[appearance]),

    // Derived: inverse pair for snackbars, taken from the opposite scheme so
    // the two themes stay mutually consistent.
    inverseSurface: brandPalette[isDark ? 'light' : 'dark'].surfaceContainer,
    inverseOnSurface: brandPalette[isDark ? 'light' : 'dark'].onSurface,

    focusRing: base.primary,
  };
};

export const lightScheme: ColorRoles = buildScheme('light');
export const darkScheme: ColorRoles = buildScheme('dark');

/**
 * Alarm surface scheme.
 *
 * MR-04: "The alarm surface uses dark tonal surfaces even when the app theme is
 * light, reducing glare on a woken screen. Controls retain full contrast."
 * This is why the alarm scheme is a constant rather than a function of
 * appearance — it is dark in both themes, by design, and is exported so the
 * native alarm activity's XML colors can be generated from the same source.
 */
export const alarmScheme: ColorRoles = {
  ...darkScheme,
  surface: '#07100E',
  surfaceContainer: '#101A17',
  onSurface: '#F2F6F4',
  onSurfaceVariant: '#C8D2CE',
};

export const statusRolesFor = (scheme: ColorRoles): StatusRoles => ({
  ready: {
    color: scheme.success,
    container: scheme.successContainer,
    onContainer: scheme.onSuccessContainer,
  },
  // MR-04: red is reserved for destructive action or blocking fault, so a
  // "Limited" capability uses the warm secondary, not error red.
  limited: {
    color: scheme.secondary,
    container: scheme.secondaryContainer,
    onContainer: scheme.onSecondaryContainer,
  },
  actionNeeded: {
    color: scheme.error,
    container: scheme.errorContainer,
    onContainer: scheme.onErrorContainer,
  },
  neutral: {
    color: scheme.onSurfaceVariant,
    container: scheme.surfaceContainerHigh,
    onContainer: scheme.onSurface,
  },
});
