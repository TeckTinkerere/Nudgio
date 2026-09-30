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
  const successContainer = blend(base.surface, base.success, isDark ? 0.24 : 0.12);

  return {
    primary: base.primary,
    onPrimary: base.onPrimary,
    primaryContainer: base.primaryContainer,
    onPrimaryContainer: base.onPrimaryContainer,

    secondary: base.secondary,
    onSecondary: base.onSecondary,
    secondaryContainer: base.secondaryContainer,
    onSecondaryContainer: base.onSecondaryContainer,

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
    errorContainer: base.errorContainer,
    onErrorContainer: base.onErrorContainer,

    warning: base.warning,
    warningContainer: base.warningContainer,
    onWarningContainer: base.onWarningContainer,

    success: base.success,
    onSuccess: readableOn(base.success, white, black),
    successContainer,
    // Blue status content is always contrast-checked against its tinted fill.
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
};

export const statusRolesFor = (scheme: ColorRoles): StatusRoles => ({
  ready: {
    color: scheme.success,
    container: scheme.successContainer,
    onContainer: scheme.onSuccessContainer,
  },
  // A pale decorative apricot cannot provide a legible warning border.
  // Limited capabilities use a dedicated amber role, separate from Snooze.
  limited: {
    color: scheme.warning,
    container: scheme.warningContainer,
    onContainer: scheme.onWarningContainer,
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
