/**
 * Scrollable "wheel" column — the drag/momentum/snap picker native alarm
 * clocks are built around (iOS `UIPickerView`, Android's `NumberPicker`),
 * replacing a tap-only stepper for values with an obvious linear order
 * (hour, minute, AM/PM).
 *
 * Momentum and snap come from the platform `ScrollView` itself
 * (`snapToInterval` + `decelerationRate`) rather than a hand-rolled
 * gesture-handler pan responder: the platform's own scroll physics already
 * are the "1:1 tracking + momentum projection + spring settle" behavior the
 * fluid-interfaces model asks for, so leaning on them is both less code and
 * more correct than reimplementing scroll physics on top of it.
 *
 * Center-distance opacity/scale on each item is the "hint in the direction
 * of the gesture" layer — driven straight off scroll position via
 * `useAnimatedScrollHandler`, so it stays glued to the finger while dragging
 * (Apple's "feedback continuous during the interaction, not just at the
 * end"). Dropped under `reduceMotion`, per MR-13 ACC-006 — the wheel still
 * scrolls and still snaps, only the per-frame scale/opacity flourish is off.
 *
 * Exposed to assistive tech as `adjustable` with increment/decrement actions
 * (the same contract `UIPickerView` gives VoiceOver) rather than as a
 * scrollable list of items — scrubbing through 60 individually-focusable
 * minute values is not a usable screen-reader interaction.
 */
import {useCallback, useMemo, useRef} from 'react';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import {AccessibilityInfo, Pressable, StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import {Text} from './Text';
import {useTheme} from '../theme/useTheme';

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;
const CENTER_INDEX = Math.floor(VISIBLE_COUNT / 2);

export interface WheelPickerOption<T> {
  readonly value: T;
  readonly label: string;
}

export interface WheelPickerProps<T> {
  readonly options: readonly WheelPickerOption<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  /** Accessible name for the whole column, e.g. "Hour". */
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

function WheelItem({
  index,
  label,
  scrollY,
  reduceMotion,
  selected,
  onPress,
}: {
  readonly index: number;
  readonly label: string;
  readonly scrollY: ReturnType<typeof useSharedValue<number>>;
  readonly reduceMotion: boolean;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {opacity: selected ? 1 : 0.45, transform: [{scale: 1}]};
    }
    const distance = Math.abs(scrollY.value / ITEM_HEIGHT - index);
    return {
      opacity: interpolate(distance, [0, 1, 2], [1, 0.5, 0.25], Extrapolation.CLAMP),
      transform: [{scale: interpolate(distance, [0, 1, 2], [1, 0.92, 0.85], Extrapolation.CLAMP)}],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.item}>
      <Animated.View style={animatedStyle}>
        <Text variant="titleLarge" tabularNumbers>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function WheelPicker<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: WheelPickerProps<T>) {
  const theme = useTheme();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollY = useSharedValue(0);
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.value === value),
  );

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const commitIndex = useCallback(
    (rawIndex: number) => {
      const clamped = Math.min(options.length - 1, Math.max(0, rawIndex));
      const next = options[clamped];
      if (next && next.value !== value) {
        onChange(next.value);
      }
      return clamped;
    },
    [onChange, options, value],
  );

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({y: index * ITEM_HEIGHT, animated});
  }, []);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      commitIndex(index);
    },
    [commitIndex],
  );

  const step = useCallback(
    (delta: number) => {
      const next = commitIndex(selectedIndex + delta);
      scrollToIndex(next, true);
    },
    [commitIndex, scrollToIndex, selectedIndex],
  );

  const onAccessibilityAction = useCallback(
    (event: {nativeEvent: {actionName: string}}) => {
      if (event.nativeEvent.actionName === 'increment') {
        step(1);
      } else if (event.nativeEvent.actionName === 'decrement') {
        step(-1);
      }
    },
    [step],
  );

  const paddingVertical = ITEM_HEIGHT * CENTER_INDEX;
  const containerStyle = useMemo(
    () => ({height: ITEM_HEIGHT * VISIBLE_COUNT}),
    [],
  );

  const announce = useCallback((label: string) => {
    AccessibilityInfo.announceForAccessibility(label);
  }, []);

  return (
    <View
      testID={testID}
      style={containerStyle}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{text: options[selectedIndex]?.label}}
      accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
      onAccessibilityAction={onAccessibilityAction}>
      <View
        pointerEvents="none"
        style={[
          styles.highlight,
          {
            top: paddingVertical,
            height: ITEM_HEIGHT,
            borderColor: theme.color.outlineVariant,
          },
        ]}
      />
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={event => {
          // Only fires on drag-end without momentum (a slow, deliberate
          // drag); the fling case is `onMomentumScrollEnd` above.
          if (event.nativeEvent.velocity && Math.abs(event.nativeEvent.velocity.y) < 0.05) {
            onMomentumEnd(event);
          }
        }}
        contentContainerStyle={{paddingVertical}}
        contentOffset={{x: 0, y: selectedIndex * ITEM_HEIGHT}}>
        {options.map((option, index) => (
          <WheelItem
            key={String(option.value)}
            index={index}
            label={option.label}
            scrollY={scrollY}
            reduceMotion={theme.a11y.reduceMotion}
            selected={index === selectedIndex}
            onPress={() => {
              commitIndex(index);
              scrollToIndex(index, true);
              announce(option.label);
            }}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: -1,
  },
});
