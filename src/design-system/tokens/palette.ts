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
 * Ink & Apricot, shared with the approved iPhone brand direction (MR-04).
 * Apricot is a decorative fill, not light-theme text or a control outline.
 * Its explicit brown on-colors keep buttons readable. Warning is a separate
 * amber role so a capability limitation never relies on the pale accent.
 */
export const brandPalette = {
  light: {
    primary: '#2D4DB5',
    onPrimary: '#FFFFFF',
    primaryContainer: '#E7ECFB',
    onPrimaryContainer: '#2D4DB5',
    secondary: '#E9B58E',
    onSecondary: '#56321C',
    secondaryContainer: '#F8E9DC',
    onSecondaryContainer: '#70401F',
    surface: '#F7F4EE',
    surfaceContainer: '#FFFEFA',
    onSurface: '#202638',
    onSurfaceVariant: '#5F6675',
    outline: '#767E90',
    error: '#B42332',
    errorContainer: '#FCE8E9',
    onErrorContainer: '#B42332',
    warning: '#805600',
    warningContainer: '#FFF0CA',
    onWarningContainer: '#805600',
    success: '#2D4DB5',
  },
  dark: {
    primary: '#BAC8FF',
    onPrimary: '#172654',
    primaryContainer: '#26314E',
    onPrimaryContainer: '#BAC8FF',
    secondary: '#F1BE98',
    onSecondary: '#56321C',
    secondaryContainer: '#392A21',
    onSecondaryContainer: '#FFD2AF',
    surface: '#11141D',
    surfaceContainer: '#1D2230',
    onSurface: '#F3F1EC',
    onSurfaceVariant: '#BCC2D0',
    outline: '#858FA5',
    error: '#FFB5BE',
    errorContainer: '#421F29',
    onErrorContainer: '#FFB5BE',
    warning: '#FFE0A0',
    warningContainer: '#382B12',
    onWarningContainer: '#FFE0A0',
    success: '#BAC8FF',
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
