/**
 * Pure theme construction.
 *
 * Separated from the provider so tests can build any theme variant in one call
 * and so the alarm surface — which is rendered natively and never sees React
 * context — can be generated from the same code path.
 */
import type {WidthClass} from '../tokens';
import type {DynamicColorPayload} from './materialYou';
import {schemeFromDynamicColor} from './materialYou';
import {alarmScheme, darkScheme, lightScheme, statusRolesFor} from './schemes';
import type {ThemeAppearance} from './schemes';
import type {ColorSource, Theme} from './Theme';
import {themeConstants} from './Theme';

export interface BuildThemeInput {
  readonly appearance: ThemeAppearance;
  /** Null when Material You is off or the platform reported no palette. */
  readonly dynamicColor: DynamicColorPayload | null;
  readonly useMaterialYou: boolean;
  readonly reduceMotion: boolean;
  readonly highContrast: boolean;
  readonly fontScale: number;
  readonly widthClass: WidthClass;
  readonly isRtl: boolean;
}

/**
 * MR-13: high contrast "may increase outlines and remove translucent
 * surfaces". Applied as a post-pass so it composes with either color source.
 */
const applyHighContrast = (theme: Theme): Theme => ({
  ...theme,
  color: {
    ...theme.color,
    // Promote decorative separators to full-strength outlines.
    outlineVariant: theme.color.outline,
    // Secondary content moves toward primary content contrast.
    onSurfaceVariant: theme.color.onSurface,
  },
});

export const buildTheme = (input: BuildThemeInput): Theme => {
  const {appearance, dynamicColor, useMaterialYou} = input;

  const canUseDynamic = useMaterialYou && dynamicColor !== null;
  const colorSource: ColorSource = canUseDynamic ? 'materialYou' : 'brand';
  const color = canUseDynamic
    ? schemeFromDynamicColor(dynamicColor, appearance)
    : appearance === 'dark'
      ? darkScheme
      : lightScheme;

  const theme: Theme = {
    appearance,
    colorSource,
    color,
    status: statusRolesFor(color),
    ...themeConstants,
    a11y: {
      reduceMotion: input.reduceMotion,
      highContrast: input.highContrast,
      // Clamp so a hostile or unusual system value cannot break layout math.
      // The 2.0 ceiling matches MR-13 ACC-003.
      fontScale: Math.max(0.85, Math.min(input.fontScale, 2.0)),
    },
    widthClass: input.widthClass,
    isRtl: input.isRtl,
  };

  return input.highContrast ? applyHighContrast(theme) : theme;
};

/**
 * The alarm theme (MR-04: dark tonal surfaces regardless of app theme).
 *
 * Material You never applies here: alarm recognition at 3am must not depend on
 * the current wallpaper, and MR-04 gives alarm recognition as the explicit
 * reason the brand palette is the default.
 */
export const buildAlarmTheme = (
  input: Omit<BuildThemeInput, 'appearance' | 'dynamicColor' | 'useMaterialYou'>,
): Theme => ({
  appearance: 'dark',
  colorSource: 'brand',
  color: alarmScheme,
  status: statusRolesFor(alarmScheme),
  ...themeConstants,
  a11y: {
    reduceMotion: input.reduceMotion,
    highContrast: input.highContrast,
    fontScale: Math.max(0.85, Math.min(input.fontScale, 2.0)),
  },
  widthClass: input.widthClass,
  isRtl: input.isRtl,
});
