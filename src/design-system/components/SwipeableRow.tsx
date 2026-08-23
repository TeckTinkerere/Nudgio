/**
 * Swipe-to-reveal-action row — the gesture native list apps (iOS Mail/
 * Reminders, Android's swipe-to-dismiss) use for a per-row destructive or
 * secondary action, instead of a persistent icon button competing with the
 * row's own content for space.
 *
 * Built on `react-native-gesture-handler` + Reanimated rather than a
 * `PanResponder`, so it composes with the row's own `AnimatedPressable`/
 * scroll-view ancestors instead of fighting them for the gesture.
 *
 * Direct manipulation: `translateX` tracks the pan 1:1 (fluid-interfaces
 * principle #2). Past the action's width, further drag is rubber-banded
 * (#9) rather than hard-stopped, so the row still "gives" instead of
 * feeling frozen. On release, commit vs. snap-back is decided from the
 * gesture's velocity/position together (a fast flick commits even from a
 * short drag) and the settle animation hands off the release velocity to a
 * spring (#5) rather than replaying a fixed-duration tween, so there is no
 * seam between the drag and the settle.
 *
 * MR-13 motor/switch access: a swipe gesture alone is not reachable by
 * TalkBack/VoiceOver or switch control, so the same action is also exposed
 * as a custom accessibility action on the row — the visible button is an
 * enhancement, not the only path to it (same rule `Sheet`'s backdrop-press
 * documents).
 */
import {useCallback} from 'react';
import {AccessibilityInfo, Pressable, StyleSheet} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {Icon, type IconName} from '../icons';
import {useTheme} from '../theme/useTheme';

const ACTION_WIDTH = 88;
const RUBBER_BAND_CONSTANT = 0.55;

function rubberband(overshoot: number): number {
  'worklet';
  return (overshoot * ACTION_WIDTH * RUBBER_BAND_CONSTANT) / (ACTION_WIDTH + RUBBER_BAND_CONSTANT * Math.abs(overshoot));
}

export interface SwipeableRowProps {
  readonly children: React.ReactNode;
  readonly actionLabel: string;
  readonly actionIcon: IconName;
  readonly onAction: () => void;
  readonly testID?: string;
}

export function SwipeableRow({children, actionLabel, actionIcon, onAction, testID}: SwipeableRowProps) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const reduceMotion = theme.a11y.reduceMotion;

  const announceRevealed = useCallback(() => {
    AccessibilityInfo.announceForAccessibility(actionLabel);
  }, [actionLabel]);

  const snapTo = useCallback(
    (open: boolean, velocity: number) => {
      'worklet';
      const target = open ? -ACTION_WIDTH : 0;
      // Reduced motion: settle to the target without carrying the release
      // velocity into a spring (no overshoot/bounce), matching every other
      // `theme.a11y.reduceMotion` branch in this design system.
      translateX.value = reduceMotion
        ? withTiming(target, {duration: 150})
        : withSpring(target, {damping: 22, stiffness: 260, velocity});
      if (open) {
        runOnJS(announceRevealed)();
      }
    },
    [announceRevealed, reduceMotion, translateX],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate(event => {
      const raw = translateX.value === -ACTION_WIDTH ? -ACTION_WIDTH + event.translationX : event.translationX;
      translateX.value = raw < -ACTION_WIDTH ? -ACTION_WIDTH + rubberband(raw + ACTION_WIDTH) : Math.min(0, raw);
    })
    .onEnd(event => {
      const pastHalfway = translateX.value < -ACTION_WIDTH / 2;
      const fastLeftFlick = event.velocityX < -400;
      const fastRightFlick = event.velocityX > 400;
      const open = fastRightFlick ? false : fastLeftFlick || pastHalfway;
      snapTo(open, event.velocityX);
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, -translateX.value / ACTION_WIDTH),
  }));

  const closeAndAct = useCallback(() => {
    translateX.value = reduceMotion ? withTiming(0, {duration: 150}) : withSpring(0, {damping: 22, stiffness: 260});
    onAction();
  }, [onAction, reduceMotion, translateX]);

  return (
    <Animated.View testID={testID} style={styles.container}>
      <Animated.View
        style={[
          styles.actionLayer,
          actionStyle,
          {backgroundColor: theme.color.error, borderRadius: theme.radius.card},
        ]}>
        <Pressable
          onPress={closeAndAct}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={styles.actionButton}>
          <Icon name={actionIcon} size="md" color={theme.color.onError} />
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={rowStyle}
          accessibilityActions={[{name: 'activate', label: actionLabel}]}
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === 'activate') {
              onAction();
            }
          }}>
          {children}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {position: 'relative'},
  actionLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
