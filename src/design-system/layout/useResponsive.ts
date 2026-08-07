/**
 * The only place in the app that reads window dimensions.
 *
 * Centralizing it keeps MR-04's responsive table and MR-13's font-scale
 * reflow rules in one testable spot instead of scattered `Dimensions.get`
 * calls that each invent their own breakpoint.
 */
import {useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {
  fontScaleBreakpoints,
  inAppStripMaxHeight,
  mediaGridColumnsFor,
  navigationTreatmentFor,
  widthClassFor,
  type NavigationTreatment,
  type WidthClass,
} from '../tokens';

export interface ResponsiveInfo {
  readonly width: number;
  readonly height: number;
  readonly widthClass: WidthClass;
  readonly navigation: NavigationTreatment;
  readonly mediaGridColumns: number;
  readonly isLandscape: boolean;

  readonly fontScale: number;
  /** MR-13: bottom-nav labels and chip rows reflow above this. */
  readonly isLargeFontScale: boolean;
  /** MR-13: dialogs become full-screen sheets, strips become cards. */
  readonly isExtraLargeFontScale: boolean;

  /** Usable height after system insets, for the in-app due strip cap. */
  readonly usableHeight: number;
  /** `min(144dp, 20% of usable viewport)` (MR-04). */
  readonly dueStripMaxHeight: number;
}

export const useResponsive = (): ResponsiveInfo => {
  const {width, height, fontScale} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const widthClass = widthClassFor(width);
  const usableHeight = Math.max(0, height - insets.top - insets.bottom);

  return {
    width,
    height,
    widthClass,
    navigation: navigationTreatmentFor(widthClass),
    mediaGridColumns: mediaGridColumnsFor(widthClass),
    isLandscape: width > height,

    fontScale,
    isLargeFontScale: fontScale >= fontScaleBreakpoints.large,
    isExtraLargeFontScale: fontScale >= fontScaleBreakpoints.extraLarge,

    usableHeight,
    dueStripMaxHeight: inAppStripMaxHeight(usableHeight),
  };
};
