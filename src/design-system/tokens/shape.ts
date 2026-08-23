/**
 * Corner radius and elevation (MR-04 "Shape and elevation").
 *
 * MR-04: "Do not use shadows as the only boundary in dark mode." Every
 * elevated surface therefore also carries a tonal fill and, in dark mode, an
 * outline. `useSurfaceStyle` in the theme layer applies that rule centrally so
 * a component author cannot forget it.
 */

export const radius = {
  none: 0,
  chip: 9999,
  field: 12,
  card: 16,
  alarmAction: 20,
  dueStrip: 20,
  dialog: 24,
  sheet: 28,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;

/**
 * Elevation levels. The number is the Android `elevation` dp value; the theme
 * maps each level to a tonal surface tint as well.
 */
export const elevation = {
  level0: 0,
  level1: 1,
  level2: 2,
  level3: 3,
  level4: 4,
} as const;

export type ElevationToken = keyof typeof elevation;

/** Component defaults, straight from the MR-04 shape table. */
export const componentShape = {
  chip: {radius: radius.chip, elevation: elevation.level0},
  textField: {radius: radius.field, elevation: elevation.level0},
  card: {radius: radius.card, elevation: elevation.level1},
  dialog: {radius: radius.dialog, elevation: elevation.level3},
  sheet: {radius: radius.sheet, elevation: elevation.level3},
  dueStrip: {radius: radius.dueStrip, elevation: elevation.level4},
  alarmAction: {radius: radius.alarmAction, elevation: elevation.level1},
} as const;
