/**
 * Screen container.
 *
 * Applies MR-04's inset and max-width rules once, so no individual screen has
 * to remember them:
 *  - honors status, navigation, cutout and gesture insets;
 *  - 16 dp side padding on phones;
 *  - centered 840 dp max-width content on expanded layouts.
 *
 * Inset ownership follows one rule in both directions: whichever piece of
 * chrome sits against a system bar consumes that edge's inset, and the screen
 * consumes it otherwise. `hasAppBar` expresses that for the top; for the
 * bottom, `TabNavigator` zeroes the inset it hands to tab screens because
 * `AppTabBar` already consumed it. So a screen never has to ask "am I inside
 * a tab?" — it always applies `insets.bottom`, and the value is already
 * correct for its context.
 *
 * `appBarSlot` (typically a `<AppBar floating .../>`, wired via
 * `useFloatingAppBar`) renders as a sibling of the scroll region, not inside
 * it — an absolutely-positioned `floating` `AppBar` placed in `children`
 * would sit inside the `ScrollView`'s own content and scroll away with it
 * instead of staying fixed above it. Plain, non-floating `AppBar` usage is
 * unaffected: it can stay in `children` as before.
 */
import {
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useTheme} from '../theme/useTheme';
import {layout, spacing} from '../tokens';
import {useResponsive} from './useResponsive';

export interface ScreenProps {
  readonly children: React.ReactNode;
  /** Wraps content in a ScrollView. Off for screens that own a list. */
  readonly scrollable?: boolean;
  /** Disable the 16 dp side padding for edge-to-edge lists and grids. */
  readonly edgeToEdge?: boolean;
  /**
   * The screen sits below a top app bar that already consumed the top inset.
   */
  readonly hasAppBar?: boolean;
  readonly backgroundColor?: string;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  /** Forwarded to the internal `ScrollView` — used by a `floating` `AppBar` to track scroll position. Only applies when `scrollable`. */
  readonly onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly scrollEventThrottle?: number;
  /** A `floating` `AppBar` — rendered outside the scroll region, see the doc comment above. */
  readonly appBarSlot?: React.ReactNode;
  readonly testID?: string;
}

export function Screen({
  children,
  scrollable = false,
  edgeToEdge = false,
  hasAppBar = false,
  backgroundColor,
  contentContainerStyle,
  onScroll,
  scrollEventThrottle,
  appBarSlot,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {widthClass} = useResponsive();

  const horizontalPadding = edgeToEdge ? 0 : layout.screenPaddingHorizontal;

  const constrained: ViewStyle =
    widthClass === 'expanded'
      ? {maxWidth: layout.contentMaxWidth, width: '100%', alignSelf: 'center'}
      : {width: '100%'};

  const body = (
    <View style={[{flex: scrollable ? undefined : 1}, constrained]}>{children}</View>
  );

  const outerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: backgroundColor ?? theme.color.surface,
    // The app bar owns the top inset when present; otherwise the screen does
    // — and in that case it adds the same `md` of breathing room `AppBar`
    // applies above its own title, so a screen without a bar (Onboarding)
    // does not start flush against the status bar while every barred screen
    // has a comfortable gap.
    paddingTop: hasAppBar ? 0 : insets.top + spacing.md,
    // Left/right insets cover display cutouts in landscape.
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  if (!scrollable) {
    return (
      <View style={outerStyle} testID={testID}>
        {appBarSlot}
        <View
          style={[
            {
              flex: 1,
              paddingHorizontal: horizontalPadding,
              // Same rule as the scrollable branch below: the bottom inset
              // lives on the content, not the outer view, so the background
              // still paints to the physical edge. This branch previously
              // applied no bottom inset at all — and because `scrollable`
              // defaults to false, that meant every screen owning a list or
              // a fixed layout put its last row and its action buttons under
              // the gesture/navigation bar. targetSdk 36 forces edge-to-edge,
              // so there is no system-drawn letterbox to hide the mistake.
              //
              // Tab screens must NOT double-count this: `AppTabBar` already
              // consumes the real bottom inset, so `TabNavigator` hands its
              // screens an inset with `bottom: 0` via `screenLayout`. That
              // keeps the rule here unconditional and correct in both places.
              paddingBottom: insets.bottom,
            },
          ]}>
          {body}
        </View>
      </View>
    );
  }

  return (
    <View style={outerStyle} testID={testID}>
      {appBarSlot}
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={[
          {
            paddingHorizontal: horizontalPadding,
            // Bottom inset lives on the content so the scroll track still
            // reaches the physical edge (MR-04 "Insets and system UI").
            paddingBottom: insets.bottom + layout.sectionGap,
          },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        // MR-13: content must stay reachable at large font scale.
        showsVerticalScrollIndicator>
        {body}
      </ScrollView>
    </View>
  );
}
