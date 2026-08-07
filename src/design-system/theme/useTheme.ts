/**
 * Theme access hooks.
 */
import {useContext, useMemo} from 'react';
import {StyleSheet, type PressableAndroidRippleConfig} from 'react-native';

import type {ElevationToken} from '../tokens';
import {applyTonalElevation, blend, withAlpha} from './colorUtils';
import type {Theme} from './Theme';
import {ThemeContext} from './ThemeContext';
import {stateLayerOpacity} from '../tokens/palette';

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (theme === undefined) {
    throw new Error(
      'useTheme() was called outside <ThemeProvider>. Wrap the tree in AppProviders, or use renderWithTheme() in tests.',
    );
  }
  return theme;
};

type NamedStyles = Record<string, object>;

/**
 * Build a themed StyleSheet, memoized on the theme identity.
 *
 * Because `buildTheme` returns a new object only when an input actually
 * changes, this recomputes on a real theme change and not on every render.
 *
 *     const styles = useThemedStyles(createStyles);
 *     const createStyles = (t: Theme) => StyleSheet.create({ ... });
 */
export const useThemedStyles = <T extends NamedStyles>(
  factory: (theme: Theme) => T,
): T => {
  const theme = useTheme();
  // The factory is expected to be a module-level constant. Depending on it
  // as well keeps the hook honest if a caller passes an inline closure.
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
};

/**
 * Surface styling that enforces the MR-04 dark-mode rule centrally:
 * "Do not use shadows as the only boundary in dark mode. Combine tonal
 * surface, outline and elevation as needed."
 *
 * A component asks for an elevation level and gets a correct fill plus, in
 * dark mode, the outline that keeps the boundary visible.
 */
export interface SurfaceStyle {
  readonly backgroundColor: string;
  readonly elevation: number;
  readonly borderWidth: number;
  readonly borderColor: string;
}

export const useSurfaceStyle = (level: ElevationToken = 'level1'): SurfaceStyle => {
  const theme = useTheme();

  return useMemo(() => {
    const dp = theme.elevation[level];
    const backgroundColor = applyTonalElevation(
      theme.color.surfaceContainer,
      theme.color.primary,
      dp,
    );
    const needsOutline = theme.appearance === 'dark' || theme.a11y.highContrast;

    return {
      backgroundColor,
      elevation: dp,
      borderWidth: needsOutline ? theme.layout.borderWidth : 0,
      borderColor: needsOutline ? theme.color.outlineVariant : 'transparent',
    };
  }, [theme, level]);
};

/**
 * Interaction state layer over a role color (MR-04 "States").
 *
 * Kept here so a pressed state can never be implemented as an ad hoc opacity
 * change that drops text contrast below the ACC-005 threshold.
 */
export type InteractionState = 'default' | 'hovered' | 'focused' | 'pressed' | 'disabled';

export const useStateLayer = () => {
  const theme = useTheme();

  return useMemo(
    () =>
      (base: string, state: InteractionState): string => {
        switch (state) {
          case 'hovered':
            return blend(base, theme.color.onSurface, stateLayerOpacity.hover);
          case 'focused':
            return blend(base, theme.color.onSurface, stateLayerOpacity.focus);
          case 'pressed':
            return blend(base, theme.color.onSurface, stateLayerOpacity.pressed);
          case 'disabled':
            return blend(
              theme.color.surface,
              theme.color.onSurface,
              stateLayerOpacity.disabledContainer,
            );
          case 'default':
            return base;
        }
      },
    [theme],
  );
};

/**
 * Android touch-feedback ripple (MR-04 "States"), built from the same
 * pressed-state opacity every static state-layer swap already uses — so the
 * animated ripple and a component's own pressed background never disagree
 * about how strong "pressed" reads.
 *
 * Android-only by construction (`android_ripple` is a no-op on any other
 * platform), matching the app's v1 scope. The system respects the device's
 * animator-duration accessibility setting on its own; there is nothing for
 * `theme.a11y.reduceMotion` to gate here.
 *
 * `contentColor` defaults to `onSurface` — the readable-content role for
 * whatever surface the control sits on — since a ripple over a filled/tonal
 * control should tint toward its own content color, not always the neutral
 * surface ink.
 */
export const useRippleConfig = (contentColor?: string): PressableAndroidRippleConfig => {
  const theme = useTheme();
  return useMemo(
    () => ({color: withAlpha(contentColor ?? theme.color.onSurface, stateLayerOpacity.pressed)}),
    [theme, contentColor],
  );
};
