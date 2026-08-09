/**
 * Full-screen "flush" transition shown after a confirmed media delete
 * actually succeeds natively (see `useDeleteMedia`/`MediaDetailContent`) —
 * water floods up from the bottom with rising bubbles while the item's icon
 * sinks, rotates and fades, then `onFinished` fires so the caller can
 * navigate back to the grid. Purely decorative: by the time this plays, the
 * native delete has already completed, so there is nothing left to wait on
 * but the animation itself.
 *
 * `theme.a11y.reduceMotion` skips the transform-driven sink/rotate/bubbles
 * (the same contract every other motion in this app documents) and instead
 * does a quick opacity-only cross-fade, calling `onFinished` sooner rather
 * than making a user who asked for less motion sit through the full effect.
 */
import {useEffect} from 'react';
import {Modal, StyleSheet, View} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type {IconName} from '../../design-system';
import {Icon} from '../../design-system';
import {useTheme} from '../../design-system/theme/useTheme';

export interface DeleteFlushOverlayProps {
  readonly visible: boolean;
  readonly icon: IconName;
  readonly onFinished: () => void;
  readonly testID?: string;
}

const FULL_DURATION_MS = 1400;
const REDUCED_DURATION_MS = 320;
const BUBBLE_COUNT = 7;

export function DeleteFlushOverlay({visible, icon, onFinished, testID}: DeleteFlushOverlayProps) {
  const theme = useTheme();
  const reduceMotion = theme.a11y.reduceMotion;

  const waterLevel = useSharedValue(0);
  const itemSink = useSharedValue(0);
  const itemRotate = useSharedValue(0);
  const itemOpacity = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (reduceMotion) {
      itemOpacity.value = withTiming(0, {duration: REDUCED_DURATION_MS});
      waterLevel.value = withTiming(
        1,
        {duration: REDUCED_DURATION_MS, easing: Easing.out(Easing.quad)},
        finished => {
          if (finished) {
            runOnJS(onFinished)();
          }
        },
      );
      return;
    }

    itemSink.value = withTiming(1, {duration: FULL_DURATION_MS, easing: Easing.in(Easing.quad)});
    itemRotate.value = withTiming(1, {duration: FULL_DURATION_MS, easing: Easing.inOut(Easing.quad)});
    itemOpacity.value = withDelay(
      FULL_DURATION_MS * 0.55,
      withTiming(0, {duration: FULL_DURATION_MS * 0.45}),
    );
    waterLevel.value = withTiming(
      1,
      {duration: FULL_DURATION_MS, easing: Easing.out(Easing.cubic)},
      finished => {
        if (finished) {
          runOnJS(onFinished)();
        }
      },
    );
    // Intentionally re-runs only on visibility/motion-preference changes —
    // the shared values are stable refs, not reactive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion]);

  const waterStyle = useAnimatedStyle(() => ({height: `${waterLevel.value * 100}%`}));

  const itemStyle = useAnimatedStyle(() => ({
    opacity: itemOpacity.value,
    transform: [
      {translateY: itemSink.value * 240},
      {rotate: `${itemRotate.value * 50}deg`},
      {scale: 1 - itemSink.value * 0.35},
    ],
  }));

  const styles = StyleSheet.create({
    root: {flex: 1, backgroundColor: theme.color.scrim},
    itemWrap: {position: 'absolute', top: '36%', alignSelf: 'center'},
    itemCircle: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    water: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.color.primary,
      opacity: 0.5,
    },
  });

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent testID={testID}>
      <View
        style={styles.root}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.itemWrap, itemStyle]}>
          <View style={styles.itemCircle}>
            <Icon name={icon} size="lg" color={theme.color.onSurfaceVariant} />
          </View>
        </Animated.View>

        {reduceMotion
          ? null
          : Array.from({length: BUBBLE_COUNT}, (_, index) => (
              <Bubble key={index} index={index} primaryColor={theme.color.onPrimary} />
            ))}

        <Animated.View style={[styles.water, waterStyle]} />
      </View>
    </Modal>
  );
}

interface BubbleProps {
  readonly index: number;
  readonly primaryColor: string;
}

function Bubble({index, primaryColor}: BubbleProps) {
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.value = withDelay(
      index * 110,
      withRepeat(withTiming(1, {duration: 850, easing: Easing.out(Easing.quad)}), -1, false),
    );
    // `rise` is a stable shared-value ref; only `index` should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const size = 8 + (index % 3) * 6;
  const leftPercent = 10 + ((index * 12.5) % 80);

  const bubbleBaseStyle = StyleSheet.create({
    bubble: {
      position: 'absolute',
      bottom: 32,
      left: `${leftPercent}%`,
      width: size,
      height: size,
      borderRadius: size,
      backgroundColor: primaryColor,
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: (1 - rise.value) * 0.75,
    transform: [{translateY: -rise.value * 280}],
  }));

  return <Animated.View style={[bubbleBaseStyle.bubble, animatedStyle]} />;
}
