/**
 * Type scale (MR-04 "Typography").
 *
 * Sizes are in sp and MUST scale with the system font setting: MR-04 says
 * "Do not disable system font scaling" and MR-13 ACC-003 requires 200% without
 * loss of critical content. Nothing here sets `allowFontScaling={false}`.
 *
 * The family is the platform sans by default so no font binary ships in the
 * APK and Arabic/Tamil glyph coverage is inherited from the device (MR-13).
 */
import {Platform} from 'react-native';

export const fontFamily = {
  /** Platform default sans. `undefined` lets Android pick Roboto/Noto. */
  sans: Platform.select({android: undefined, default: undefined}),
  /**
   * Times use tabular figures where available so a ticking clock does not
   * shift horizontally (MR-04: "Use tabular figures for times").
   */
  tabular: Platform.select({android: 'monospace', default: undefined}),
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const;

export type FontWeightToken = keyof typeof fontWeight;

export interface TypeStyle {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: (typeof fontWeight)[FontWeightToken];
  readonly letterSpacing?: number;
}

/** Role names match the MR-04 table one-for-one. */
export const typography = {
  displaySmall: {fontSize: 36, lineHeight: 44, fontWeight: fontWeight.medium},
  headlineLarge: {fontSize: 32, lineHeight: 40, fontWeight: fontWeight.medium},
  headlineMedium: {fontSize: 28, lineHeight: 36, fontWeight: fontWeight.medium},
  titleLarge: {fontSize: 22, lineHeight: 28, fontWeight: fontWeight.semibold},
  titleMedium: {fontSize: 16, lineHeight: 24, fontWeight: fontWeight.semibold},
  bodyLarge: {fontSize: 16, lineHeight: 24, fontWeight: fontWeight.regular},
  bodyMedium: {fontSize: 14, lineHeight: 20, fontWeight: fontWeight.regular},
  labelLarge: {fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold},
  labelMedium: {fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold},
} as const satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;

/**
 * Roles that carry a control label. MR-04: "critical controls MUST not
 * truncate to ambiguous text" and MR-13: "action labels never reduce below
 * body-readable size to fit". Components use this set to refuse shrink-to-fit.
 */
export const nonShrinkableRoles: ReadonlySet<TypographyToken> = new Set([
  'labelLarge',
  'bodyLarge',
  'titleMedium',
  'titleLarge',
]);

/**
 * Font-scale thresholds from the MR-13 test matrix. Layouts consult these to
 * switch to a stacked or compact presentation rather than clipping.
 */
export const fontScaleBreakpoints = {
  /** Above this, bottom-nav labels and chip rows reflow. */
  large: 1.3,
  /** Above this, dialogs become full-screen sheets and strips become cards. */
  extraLarge: 1.6,
  /** MR-13 ACC-003 ceiling that must still be fully operable. */
  maximum: 2.0,
} as const;
