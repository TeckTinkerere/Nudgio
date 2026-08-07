/**
 * Raw brand palette (MR-04 "Color system").
 *
 * These are the only literal colors in the application. Nothing outside the
 * design system may read this file: product code consumes semantic *roles*
 * (`theme.color.primary`), never a raw ramp value. That indirection is what
 * lets Material You swap the source of a role without touching a screen.
 *
 * @see specs/Markdown/04_Visual_Design_System.md
 */

/**
 * Fixed brand values, verbatim from the MR-04 token table.
 *
 * Known constraint, measured rather than assumed: the light `secondary`
 * (#D97706) reaches only **3.04:1** against the light `surface` (#F8FAF9).
 * That clears the 3:1 UI-component threshold but fails ACC-005's 4.5:1 for
 * normal text. It is therefore usable as a fill, a border and an accent, but
 * never as a text or icon color on the light surface. `Text` deliberately
 * exposes no `secondary` tone, and status components take their icon color
 * from `onContainer`. Recorded as DL-003 in docs/decision-log.md.
 */
export const brandPalette = {
  light: {
    primary: '#006A60',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D7F5EE',
    onPrimaryContainer: '#00201C',
    secondary: '#D97706',
    surface: '#F8FAF9',
    surfaceContainer: '#EEF2F0',
    onSurface: '#171D1B',
    onSurfaceVariant: '#3F4946',
    outline: '#6F7975',
    error: '#B42318',
    success: '#15803D',
  },
  dark: {
    primary: '#5EDBC8',
    onPrimary: '#003732',
    primaryContainer: '#005047',
    onPrimaryContainer: '#D7F5EE',
    secondary: '#FFB951',
    surface: '#0E1513',
    surfaceContainer: '#17201D',
    onSurface: '#DEE4E1',
    onSurfaceVariant: '#BEC9C5',
    outline: '#89938F',
    error: '#FFB4AB',
    success: '#68D391',
  },
} as const;

/**
 * Scrim opacities (MR-04): black at 48% in light, 64% in dark. Kept separate
 * from the ramp because they are alpha values applied over arbitrary content.
 */
export const scrimOpacity = {
  light: 0.48,
  dark: 0.64,
} as const;

/**
 * Neutral anchors used to derive on-color pairs and state layers. Not brand
 * colors; they exist so contrast math has fixed endpoints.
 */
export const neutral = {
  black: '#000000',
  white: '#FFFFFF',
} as const;

/**
 * The one non-color "color": no fill. Routed through a named export, not a
 * `'transparent'` string literal, so `eslint-plugin-react-native`'s
 * `no-color-literals` rule — which cannot tell "no fill" from a stray magic
 * hex value — does not flag every conditional background in the codebase.
 */
export const transparent = 'transparent';

/**
 * Material state-layer opacities. Applied over a role color to express
 * interaction state without introducing a new hue (MR-04 "States").
 */
export const stateLayerOpacity = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
  /**
   * Disabled content keeps a readable label (MR-04 "Primary button"), so this
   * is deliberately higher than Material's 0.38 default for *content* and is
   * only ever applied to container fills.
   */
  disabledContainer: 0.12,
  disabledContent: 0.38,
} as const;

export type BrandScheme = typeof brandPalette.light;
export type BrandColorName = keyof BrandScheme;
