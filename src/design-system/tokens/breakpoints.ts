/**
 * Responsive width classes (MR-04 "Responsive behavior").
 *
 * These are the Material window size classes. MR-04 maps each to a navigation
 * and layout treatment; `useResponsive()` in the layout folder is the only
 * place that reads window dimensions.
 */

export const breakpoints = {
  /** Phone portrait. Bottom navigation, single-column editors. */
  compactMaxWidth: 600,
  /** Large phone landscape / small tablet. Navigation rail, two-pane library. */
  mediumMaxWidth: 840,
} as const;

export type WidthClass = 'compact' | 'medium' | 'expanded';

export const widthClassFor = (width: number): WidthClass => {
  if (width < breakpoints.compactMaxWidth) {
    return 'compact';
  }
  if (width < breakpoints.mediumMaxWidth) {
    return 'medium';
  }
  return 'expanded';
};

/** Navigation treatment per MR-04's responsive table. */
export type NavigationTreatment = 'bottomBar' | 'rail';

export const navigationTreatmentFor = (widthClass: WidthClass): NavigationTreatment =>
  widthClass === 'compact' ? 'bottomBar' : 'rail';

/** Media grid columns. MR-03: two-column grid on typical phones. */
export const mediaGridColumnsFor = (widthClass: WidthClass): number => {
  switch (widthClass) {
    case 'compact':
      return 2;
    case 'medium':
      return 3;
    case 'expanded':
      return 4;
  }
};
