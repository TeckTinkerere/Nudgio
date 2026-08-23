/**
 * Shared wiring for a `floating` `AppBar`: the bar reports its own measured
 * height (`onHeightChange`), and the content beneath reports whether it has
 * scrolled past the top (`onScroll`) so the bar can grow its edge hairline.
 * Every screen needs the same three pieces of state to compose the two —
 * this is that composition, written once, so "every AppBar floats and
 * behaves identically" is a fact about this hook, not a convention screens
 * have to each remember to follow.
 */
import {useCallback, useState} from 'react';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';

export interface FloatingAppBar {
  /** Pass straight through to `AppBar`'s `onHeightChange`. */
  readonly onHeightChange: (height: number) => void;
  /** Pass straight through to `AppBar`'s `scrolled`. */
  readonly scrolled: boolean;
  /** Pass straight through to the scroll container's `onScroll`. */
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Apply as top padding/spacer to whatever scrolls beneath the bar. */
  readonly barHeight: number;
}

/** Past this offset, the content is considered "scrolled" for the hairline. */
const SCROLL_THRESHOLD = 4;

export function useFloatingAppBar(): FloatingAppBar {
  const [barHeight, setBarHeight] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrolled(event.nativeEvent.contentOffset.y > SCROLL_THRESHOLD);
  }, []);

  return {onHeightChange: setBarHeight, scrolled, onScroll, barHeight};
}
