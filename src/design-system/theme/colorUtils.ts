/**
 * Color math used to derive roles and to assert MR-13 contrast requirements.
 *
 * Kept dependency-free and pure so it can be unit-tested on the JVM-equivalent
 * (plain Jest) without a renderer, and so the same ratios can be asserted in
 * component tests rather than eyeballed.
 *
 * @see specs/Markdown/13_Accessibility_Localization_and_Inclusive_Design.md ACC-005
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

/** Parse `#RRGGBB` (with or without `#`) into 0-255 channels. */
export const parseHex = (hex: string): Rgb => {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match?.[1]) {
    throw new Error(`Expected a #RRGGBB color, received "${hex}"`);
  }
  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
};

const clampChannel = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

export const toHex = ({r, g, b}: Rgb): string => {
  const channel = (value: number): string =>
    clampChannel(value).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
};

/**
 * Composite `foreground` over `background` at `alpha`. Used for state layers
 * and tonal elevation, where React Native cannot blend an `rgba()` fill against
 * an arbitrary parent for us at token-definition time.
 */
export const blend = (background: string, foreground: string, alpha: number): string => {
  const ratio = Math.max(0, Math.min(1, alpha));
  const bg = parseHex(background);
  const fg = parseHex(foreground);
  return toHex({
    r: bg.r + (fg.r - bg.r) * ratio,
    g: bg.g + (fg.g - bg.g) * ratio,
    b: bg.b + (fg.b - bg.b) * ratio,
  });
};

/** `#RRGGBBAA`. React Native on Android accepts 8-digit hex. */
export const withAlpha = (hex: string, alpha: number): string => {
  const ratio = Math.max(0, Math.min(1, alpha));
  const suffix = clampChannel(ratio * 255)
    .toString(16)
    .padStart(2, '0');
  return `${toHex(parseHex(hex))}${suffix.toUpperCase()}`;
};

const linearize = (channel8Bit: number): number => {
  const channel = channel8Bit / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export const relativeLuminance = (hex: string): number => {
  const {r, g, b} = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
};

/** WCAG contrast ratio between two opaque colors, 1:1 to 21:1. */
export const contrastRatio = (a: string, b: string): number => {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
};

/** MR-13 ACC-005 thresholds. */
export const CONTRAST_MINIMUM = {
  /** Normal body text. */
  normalText: 4.5,
  /** Text at >=18.66px bold or >=24px regular. */
  largeText: 3,
  /** Non-text UI boundaries and control affordances. */
  uiComponent: 3,
} as const;

export const meetsContrast = (
  foreground: string,
  background: string,
  minimum: number = CONTRAST_MINIMUM.normalText,
): boolean => contrastRatio(foreground, background) >= minimum;

/**
 * Pick whichever of `light`/`dark` reads better on `background`.
 *
 * Used when deriving an `on*` role for a dynamic (Material You) color, where
 * the pairing is not fixed by the brand table.
 */
export const readableOn = (background: string, light: string, dark: string): string =>
  contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;

/**
 * Keep the designer's intended color when it is accessible, otherwise fall back.
 *
 * Tinted containers are the case that motivates this. A vivid role color on its
 * own tonal container reads well for most hues but not all: the MR-04 light
 * success green on a 12% green wash measures 4.07:1, under the ACC-005 4.5
 * threshold. Rather than hand-picking a darker green and desynchronising it
 * from the brand token, the scheme asks for the vivid color and silently takes
 * `fallback` when it would not pass.
 *
 * This is why role derivation is code and not a static table.
 */
export const preferAccessible = (
  background: string,
  preferred: string,
  fallback: string,
  minimum: number = CONTRAST_MINIMUM.normalText,
): string => (contrastRatio(preferred, background) >= minimum ? preferred : fallback);

/**
 * Material 3 tonal elevation: an elevated surface is tinted toward the primary
 * hue rather than relying on a shadow. MR-04 requires this in dark mode, where
 * "shadows as the only boundary" is forbidden.
 */
const TONAL_OVERLAY_ALPHA: Readonly<Record<number, number>> = {
  0: 0,
  1: 0.05,
  2: 0.08,
  3: 0.11,
  4: 0.12,
};

export const applyTonalElevation = (
  surface: string,
  tint: string,
  level: number,
): string => blend(surface, tint, TONAL_OVERLAY_ALPHA[level] ?? 0.12);
