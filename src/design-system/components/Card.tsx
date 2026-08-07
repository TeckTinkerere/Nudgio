/**
 * Card surface.
 *
 * Uses `useSurfaceStyle`, which applies the MR-04 dark-mode rule (tonal fill
 * plus outline, never shadow alone). A card is 16 dp radius with 16 dp
 * internal padding by default.
 */
import {Pressable, View, type StyleProp, type ViewStyle} from 'react-native';

import {useRippleConfig, useSurfaceStyle, useTheme} from '../theme/useTheme';
import {resolveSpace, type ElevationToken, type SpacingToken} from '../tokens';

export interface CardProps {
  readonly children: React.ReactNode;
  readonly onPress?: () => void;
  readonly padding?: SpacingToken | number;
  readonly elevation?: ElevationToken;
  /** Low-emphasis selected state uses the primary container role (MR-04). */
  readonly selected?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  /**
   * Announced as one node. MR-13 requires composite rows to be a single
   * TalkBack group with separate actions rather than a pile of leaves.
   */
  readonly accessibilityLabel?: string;
}

export function Card({
  children,
  onPress,
  padding = 'md',
  elevation = 'level1',
  selected = false,
  style,
  testID,
  accessibilityLabel,
}: CardProps) {
  const theme = useTheme();
  const surface = useSurfaceStyle(elevation);
  const ripple = useRippleConfig();

  const base: ViewStyle = {
    ...surface,
    backgroundColor: selected ? theme.color.primaryContainer : surface.backgroundColor,
    borderRadius: theme.radius.card,
    padding: resolveSpace(padding),
  };

  if (!onPress) {
    return (
      <View
        style={[base, style]}
        testID={testID}
        accessible={accessibilityLabel !== undefined}
        accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected}}
      testID={testID}
      android_ripple={ripple}
      style={({pressed}) => [
        base,
        pressed && {backgroundColor: theme.color.surfaceContainerHigh},
        style,
      ]}>
      {children}
    </Pressable>
  );
}
