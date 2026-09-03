/**
 * Scrollable "wheel" column — the drag/momentum/snap picker native alarm
 * clocks are built around (Android's `NumberPicker`, iOS `UIPickerView`).
 * The centred item is the selected one; its neighbours fade and shrink with
 * distance, which is what makes a wheel read as a wheel.
 *
 * The gesture is a `react-native-gesture-handler` `Pan`, deliberately NOT a
 * `ScrollView`. An earlier wheel here was a nested `ScrollView` and could
 * only ever be tapped: the reminder editor's own vertical `ScrollView` sits
 * directly above it and claimed every vertical drag, because two native
 * scroll views on the same axis have no arbitration beyond "the parent
 * intercepts first". A gesture handler does have that arbitration — when it
 * activates it tells its ancestors to stop intercepting the touch — and
 * `activeOffsetY` below is tightened to ±4 dp so the wheel wins that race
 * against the parent's own ~8 dp scroll slop rather than losing it.
 *
 * `onInteractionChange` is the second half of the same guarantee: the
 * ancestor scroll view is told to hold still for the duration of a wheel
 * drag, so even a touch the handler has not activated on yet cannot end up
 * scrolling the page instead of the wheel. Belt and braces on purpose —
 * this control existing but not being draggable is the exact bug being fixed.
 *
 * Scroll physics are hand-rolled because they have to be: velocity at
 * release is projected forward (`PROJECTION_SECONDS`), snapped to the
 * nearest item, and handed to a spring that carries the release velocity, so
 * a fling and its settle are one continuous motion. Past either end the drag
 * rubber-bands instead of hard-stopping, so the wheel "gives" the way every
 * platform scroller does.
 *
 * Item emphasis is driven off the scroll offset on the UI thread, not off
 * React state, so the fade tracks the finger frame-for-frame and a drag
 * across sixty minutes costs zero re-renders. Under `reduceMotion` the
 * per-frame scale/opacity ramp is dropped for a static selected/unselected
 * split and the settle becomes a short tween (MR-13 ACC-006) — the wheel
 * still drags and still snaps.
 *
 * Exposed to assistive tech as one `adjustable` control with increment/
 * decrement actions (the contract `UIPickerView` gives VoiceOver), not as a
 * list of sixty focusable values: scrubbing through sixty individually
 * focusable minutes is not a usable screen-reader interaction. Every item is
 * still a tap target for sighted users who prefer not to drag.
 */
import {useCallback, useEffect, useRef} from 'react';
import {AccessibilityInfo, Pressable, StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {Text} from './Text';
import {useTheme} from '../theme/useTheme';
import {layout, type TypographyToken} from '../tokens';

/** Row height at font scale 1. Grows with the user's font scale, never shrinks. */
const BASE_ITEM_HEIGHT = 48;
/** Rows visible at once. Odd, so exactly one row is the centre. */
const VISIBLE_COUNT = 5;
const CENTER_INDEX = (VISIBLE_COUNT - 1) / 2;

/**
 * How far a release velocity is projected before snapping. 0.15 s is the
 * usual UIKit-style figure: long enough that a flick travels several rows,
 * short enough that the wheel never feels like it has slipped its leash.
 */
const PROJECTION_SECONDS = 0.15;

/** How much of an overscroll drag actually moves the wheel, at the limit. */
const RUBBER_BAND_RESISTANCE = 0.3;

const REDUCED_MOTION_SETTLE_MS = 120;

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
  /** Type scale for the item labels. Defaults to `headlineMedium`. */
  readonly labelVariant?: TypographyToken;
  /**
   * Called with `true` while a drag is in flight. An ancestor scroll view
   * should stop scrolling for that window — see the note above.
   */
  readonly onInteractionChange?: (active: boolean) => void;
  /** Fired each time the wheel crosses into a new item mid-drag (selection tick). */
  readonly onTick?: () => void;
  readonly testID?: string;
}

const clamp = (value: number, min: number, max: number): number => {
  'worklet';
  return Math.min(max, Math.max(min, value));
};

/**
 * Past either end the wheel keeps moving, but only fractionally, and less
 * the further it is pulled — the standard scroll-view "give".
 */
const withRubberBand = (offset: number, maxOffset: number, itemHeight: number): number => {
  'worklet';
  const limit = itemHeight * RUBBER_BAND_RESISTANCE;
  if (offset < 0) {
    return -limit * (1 - limit / (limit + -offset));
  }
  if (offset > maxOffset) {
    const overshoot = offset - maxOffset;
    return maxOffset + limit * (1 - limit / (limit + overshoot));
  }
  return offset;
};

function WheelItem({
  index,
  label,
  offset,
  itemHeight,
  labelVariant,
  reduceMotion,
  selected,
  onPress,
}: {
  readonly index: number;
  readonly label: string;
  readonly offset: SharedValue<number>;
  readonly itemHeight: number;
  readonly labelVariant: TypographyToken;
  readonly reduceMotion: boolean;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {opacity: selected ? 1 : 0.45, transform: [{scale: 1}]};
    }
    const distance = Math.abs(offset.value / itemHeight - index);
    return {
      opacity: interpolate(distance, [0, 1, 2], [1, 0.42, 0.18], Extrapolation.CLAMP),
      transform: [
        {scale: interpolate(distance, [0, 1, 2], [1, 0.82, 0.7], Extrapolation.CLAMP)},
      ],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      // The column as a whole is the accessible control (`adjustable`);
      // sixty focus stops inside it would be worse than none.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.item, {height: itemHeight}]}>
      <Animated.View style={animatedStyle}>
        <Text variant={labelVariant} tabularNumbers>
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
  labelVariant = 'headlineMedium',
  onInteractionChange,
  onTick,
  testID,
}: WheelPickerProps<T>) {
  const theme = useTheme();
  const reduceMotion = theme.a11y.reduceMotion;

  // Rows grow with the OS font scale so a 200 % setting cannot clip the
  // numbers (MR-13 ACC-003); they never shrink below the base height.
  const itemHeight = Math.round(BASE_ITEM_HEIGHT * clamp(theme.a11y.fontScale, 1, 2));
  const lastIndex = Math.max(0, options.length - 1);
  const maxOffset = lastIndex * itemHeight;

  const foundIndex = options.findIndex(option => option.value === value);
  const selectedIndex = foundIndex >= 0 ? foundIndex : 0;

  const offset = useSharedValue(selectedIndex * itemHeight);
  const dragOrigin = useSharedValue(0);
  const tickIndex = useSharedValue(selectedIndex);
  /** The index this component itself last reported — see the sync effect. */
  const committedIndex = useRef(selectedIndex);
  /** Last row height the offset was measured against — see the sync effect. */
  const measuredItemHeight = useRef(itemHeight);

  const commit = useCallback(
    (index: number) => {
      committedIndex.current = index;
      const next = options[index];
      if (next && next.value !== value) {
        onChange(next.value);
      }
    },
    [onChange, options, value],
  );

  const setInteracting = useCallback(
    (active: boolean) => {
      onInteractionChange?.(active);
    },
    [onInteractionChange],
  );

  const tick = useCallback(() => {
    onTick?.();
  }, [onTick]);

  /**
   * Follow the value when it changes from the outside (a reset, a loaded
   * reminder, the AM/PM column flipping the hour). Skipped for the wheel's
   * own commits: those already animated the offset to the target, and
   * re-animating from here would cut the settle spring short.
   */
  useEffect(() => {
    const target = selectedIndex * itemHeight;
    // The offset is in pixels, so a font-scale change (which changes the row
    // height) invalidates it. That is a re-layout, not a value change: jump,
    // do not animate.
    if (itemHeight !== measuredItemHeight.current) {
      measuredItemHeight.current = itemHeight;
      committedIndex.current = selectedIndex;
      offset.value = target;
      tickIndex.value = selectedIndex;
      return;
    }
    if (selectedIndex === committedIndex.current) {
      return;
    }
    committedIndex.current = selectedIndex;
    offset.value = reduceMotion
      ? withTiming(target, {duration: REDUCED_MOTION_SETTLE_MS})
      : withSpring(target, {damping: 26, stiffness: 220});
    tickIndex.value = selectedIndex;
  }, [itemHeight, offset, reduceMotion, selectedIndex, tickIndex]);

  const settle = useCallback(
    (index: number, velocity: number) => {
      'worklet';
      const target = index * itemHeight;
      offset.value = reduceMotion
        ? withTiming(target, {duration: REDUCED_MOTION_SETTLE_MS})
        : withSpring(target, {damping: 26, stiffness: 220, velocity});
      tickIndex.value = index;
      runOnJS(commit)(index);
    },
    [commit, itemHeight, offset, reduceMotion, tickIndex],
  );

  const pan = Gesture.Pan()
    // Named so the drag itself — not just the tap fallback — is reachable
    // from a test via `getByGestureTestId`.
    .withTestId(`${testID ?? accessibilityLabel}.pan`)
    // Tighter than a scroll view's own slop on purpose: whichever recogniser
    // claims the drag first keeps it, and this one has to be the wheel.
    .activeOffsetY([-4, 4])
    .onBegin(() => {
      cancelAnimation(offset);
      dragOrigin.value = offset.value;
      runOnJS(setInteracting)(true);
    })
    .onUpdate(event => {
      // Dragging up (negative translation) moves to later values, exactly
      // like scrolling a list.
      offset.value = withRubberBand(dragOrigin.value - event.translationY, maxOffset, itemHeight);
      const index = clamp(Math.round(offset.value / itemHeight), 0, lastIndex);
      if (index !== tickIndex.value) {
        tickIndex.value = index;
        runOnJS(tick)();
      }
    })
    .onEnd(event => {
      const projected = offset.value - event.velocityY * PROJECTION_SECONDS;
      settle(clamp(Math.round(projected / itemHeight), 0, lastIndex), -event.velocityY);
    })
    // Runs for a cancelled or never-activated touch too, so the ancestor
    // scroll view is always handed back.
    .onFinalize(() => {
      runOnJS(setInteracting)(false);
    });

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{translateY: CENTER_INDEX * itemHeight - offset.value}],
  }));

  const announce = useCallback((label: string) => {
    AccessibilityInfo.announceForAccessibility(label);
  }, []);

  const selectIndex = useCallback(
    (index: number, spoken: boolean) => {
      const clamped = Math.min(lastIndex, Math.max(0, index));
      const target = clamped * itemHeight;
      offset.value = reduceMotion
        ? withTiming(target, {duration: REDUCED_MOTION_SETTLE_MS})
        : withSpring(target, {damping: 26, stiffness: 220});
      tickIndex.value = clamped;
      commit(clamped);
      const option = options[clamped];
      if (spoken && option) {
        announce(option.label);
      }
    },
    [announce, commit, itemHeight, lastIndex, offset, options, reduceMotion, tickIndex],
  );

  const onAccessibilityAction = useCallback(
    (event: {nativeEvent: {actionName: string}}) => {
      if (event.nativeEvent.actionName === 'increment') {
        selectIndex(selectedIndex + 1, false);
      } else if (event.nativeEvent.actionName === 'decrement') {
        selectIndex(selectedIndex - 1, false);
      }
    },
    [selectIndex, selectedIndex],
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        testID={testID}
        style={[styles.container, {height: itemHeight * VISIBLE_COUNT}]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{text: options[selectedIndex]?.label}}
        accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
        onAccessibilityAction={onAccessibilityAction}>
        <Animated.View style={stripStyle}>
          {options.map((option, index) => (
            <WheelItem
              key={String(option.value)}
              index={index}
              label={option.label}
              offset={offset}
              itemHeight={itemHeight}
              labelVariant={labelVariant}
              reduceMotion={reduceMotion}
              selected={index === selectedIndex}
              onPress={() => selectIndex(index, true)}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {overflow: 'hidden', justifyContent: 'flex-start'},
  // `minWidth` keeps a one-glyph row (a "1", an "AM") a full touch target
  // wide (MR-13 ACC-002) and keeps the column's width from twitching as the
  // widest visible label changes.
  item: {alignItems: 'center', justifyContent: 'center', minWidth: layout.minTouchTarget},
});
