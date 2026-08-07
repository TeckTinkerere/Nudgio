/**
 * Screen container.
 *
 * Applies MR-04's inset and max-width rules once, so no individual screen has
 * to remember them:
 *  - honors status, navigation, cutout and gesture insets;
 *  - 16 dp side padding on phones;
 *  - centered 840 dp max-width content on expanded layouts.
 */
import {ScrollView, View, type StyleProp, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useTheme} from '../theme/useTheme';
import {layout} from '../tokens';
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
  readonly testID?: string;
}

export function Screen({
  children,
  scrollable = false,
  edgeToEdge = false,
  hasAppBar = false,
  backgroundColor,
  contentContainerStyle,
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
    // The app bar owns the top inset when present; otherwise the screen does.
    paddingTop: hasAppBar ? 0 : insets.top,
    // Left/right insets cover display cutouts in landscape.
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  if (!scrollable) {
    return (
      <View style={outerStyle} testID={testID}>
        <View style={[{flex: 1, paddingHorizontal: horizontalPadding}]}>{body}</View>
      </View>
    );
  }

  return (
    <View style={outerStyle} testID={testID}>
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
        // MR-13: content must stay reachable at large font scale.
        showsVerticalScrollIndicator>
        {body}
      </ScrollView>
    </View>
  );
}
