/**
 * Placeholder block for content that is still loading.
 *
 * Deliberately static. MR-04: "No looping decorative animations", and MR-13
 * ACC-006 would have to strip a shimmer under reduced motion anyway — so the
 * component does not have one to strip.
 *
 * Always hidden from assistive technology: the surrounding `LoadingState` or
 * screen-level label is what announces that content is loading.
 */
import {View, type DimensionValue} from 'react-native';

import {useTheme} from '../theme/useTheme';
import type {RadiusToken} from '../tokens';

export interface SkeletonProps {
  readonly width?: DimensionValue;
  readonly height?: number;
  readonly radius?: RadiusToken;
  readonly testID?: string;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'chip',
  testID,
}: SkeletonProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius: theme.radius[radius],
        backgroundColor: theme.color.surfaceContainerHigh,
      }}
    />
  );
}
