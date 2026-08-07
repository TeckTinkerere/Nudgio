/**
 * Spacing scale (MR-04 "Spacing and grid").
 *
 * Base unit is 4 dp. Product code uses the named scale, never a raw number,
 * so a density change is a one-file edit. `eslint react-native/no-inline-styles`
 * plus review keeps stray numbers out.
 */

export const SPACING_BASE_UNIT = 4;

/** The permitted increments. Values outside this set need a design decision. */
export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export type SpacingToken = keyof typeof spacing;

/**
 * Layout constants that are not free-floating spacing but fixed product
 * protections. Several are accessibility floors (MR-13 ACC-002) and MUST NOT
 * be lowered to make a layout fit.
 */
export const layout = {
  /** Phone screen side padding. */
  screenPaddingHorizontal: spacing.md,
  /** Compact dialog padding. */
  dialogPadding: spacing.xl,
  /** Card internal padding. */
  cardPadding: spacing.md,
  /** Gap between major sections. */
  sectionGap: spacing.xl,
  /** Centered content max width on expanded layouts. */
  contentMaxWidth: 840,

  /** ACC-002 floor. Applies to every interactive element. */
  minTouchTarget: 48,
  /** ACC-002: full-screen alarm actions are at least 56 dp high. */
  alarmActionMinHeight: 56,
  /** MR-04 preferred alarm action height. */
  alarmActionPreferredHeight: 64,
  /** List row minimum; grows with font scale rather than clipping. */
  listRowMinHeight: 64,
  /** Reminder card thumbnail (MR-04 "Reminder card"). */
  reminderThumbnailSize: 64,
  /** Focus ring thickness (MR-04 "States"). */
  focusRingWidth: 2,
  /** Default hairline/divider and outlined-control border. */
  borderWidth: 1,
} as const;

/**
 * Maximum height of the in-app due strip: `min(144dp, 20% of usable viewport)`
 * (MR-04 / MR-03). Expressed as a function because it depends on the measured
 * viewport, and MR-03 explicitly forbids promising a fixed fraction.
 */
export const inAppStripMaxHeight = (usableViewportHeight: number): number =>
  Math.min(144, usableViewportHeight * 0.2);

/** Resolve a spacing token or a raw dp number to dp. */
export const resolveSpace = (value: SpacingToken | number): number =>
  typeof value === 'number' ? value : spacing[value];
