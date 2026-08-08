/**
 * `Pressable` with a reanimated press-in scale-down / spring-release, layered
 * on top of (not instead of) the platform ripple every other Pressable-based
 * component here already uses — this is the extra tactile feedback layer,
 * not a replacement for `android_ripple`.
 *
 * Deliberately narrow: plain `style` only (no pressed-state callback form),
 * since it is a purpose-built primitive for the handful of cards/rows this
 * redesign opts in explicitly, not a universal `Pressable` replacement for
 * every existing component in the design system.
 *
 * `theme.a11y.reduceMotion` skips the scale transform entirely (ripple alone
 * still provides feedback) — the same reduced-motion contract every
 * `tokens/motion.ts` entry already documents.
 */
import type {ReactNode} from 'react';
import {Pressable, type AccessibilityRole, type GestureResponderEvent, type StyleProp, type ViewStyle} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withSpring, withTiming} from 'react-native-reanimated';

import {useRippleConfig, useTheme} from '../theme/useTheme';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps {
  readonly children: ReactNode;
  readonly onPress?: (event: GestureResponderEvent) => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly scaleTo?: number;
  readonly disabled?: boolean;
  readonly accessibilityRole?: AccessibilityRole;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function AnimatedPressable({
  children,
  onPress,
  style,
  scaleTo = 0.96,
  disabled = false,
  accessibilityRole,
  accessibilityLabel,
  testID,
}: AnimatedPressableProps) {
  const theme = useTheme();
  const ripple = useRippleConfig();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  return (
    <ReanimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled}}
      testID={testID}
      android_ripple={disabled ? undefined : ripple}
      onPressIn={() => {
        if (!theme.a11y.reduceMotion) {
          scale.value = withTiming(scaleTo, {duration: 100});
        }
      }}
      onPressOut={() => {
        if (!theme.a11y.reduceMotion) {
          scale.value = withSpring(1, {damping: 16, stiffness: 220});
        }
      }}
      style={[style, theme.a11y.reduceMotion ? null : animatedStyle]}>
      {children}
    </ReanimatedPressable>
  );
}
