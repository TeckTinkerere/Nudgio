/**
 * The theme object handed to every component through context.
 *
 * It is intentionally a plain, serializable-ish value with no methods that
 * close over React state, so it can be snapshot-tested and so a screenshot
 * fixture can be rendered under an arbitrary theme without a provider tree.
 */
import type {
  ElevationToken,
  MotionToken,
  RadiusToken,
  SpacingToken,
  TypeStyle,
  TypographyToken,
  WidthClass,
} from '../tokens';
import {
  componentShape,
  elevation,
  layout,
  motion,
  radius,
  spacing,
  typography,
} from '../tokens';
import type {ColorRoles, StatusRoles} from './colorRoles';
import type {ThemeAppearance} from './schemes';

/** Where the current color scheme came from. Surfaced in Settings and About. */
export type ColorSource = 'brand' | 'materialYou';

/** User-selectable appearance. `system` follows the OS setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  readonly appearance: ThemeAppearance;
  readonly colorSource: ColorSource;
  readonly color: ColorRoles;
  readonly status: StatusRoles;
  readonly spacing: Record<SpacingToken, number>;
  readonly layout: typeof layout;
  // Explicit `TypeStyle`, not `(typeof typography)[TypographyToken]`: indexing
  // a const-narrowed object with a *union* of keys distributes over each
  // literal member instead of merging optional fields like `letterSpacing`,
  // which then reads as missing rather than optional at every call site.
  readonly typography: Record<TypographyToken, TypeStyle>;
  readonly radius: Record<RadiusToken, number>;
  readonly elevation: Record<ElevationToken, number>;
  readonly shape: typeof componentShape;
  readonly motion: Record<MotionToken, (typeof motion)[MotionToken]>;
  /** Live accessibility environment, so components can react without hooks. */
  readonly a11y: {
    /** MR-13 ACC-006. */
    readonly reduceMotion: boolean;
    /** MR-13: system contrast preference where the platform exposes it. */
    readonly highContrast: boolean;
    /** Current system font scale, clamped for layout decisions. */
    readonly fontScale: number;
  };
  readonly widthClass: WidthClass;
  /** True when the layout must mirror (MR-13 "RTL support"). */
  readonly isRtl: boolean;
}

/** The invariant parts of the theme, shared by every variant. */
export const themeConstants = {
  spacing,
  layout,
  typography,
  radius,
  elevation,
  shape: componentShape,
  motion,
} as const;
