/**
 * Directional stack.
 *
 * `row` maps to `flexDirection: 'row'`, which React Native already mirrors
 * under RTL, so callers get MR-13's start/end behavior without thinking about
 * it. There is deliberately no `left`/`right` prop.
 */
import {View, type StyleProp, type ViewStyle} from 'react-native';

import {resolveSpace, type SpacingToken} from '../tokens';

export interface StackProps {
  readonly direction?: 'row' | 'column';
  readonly gap?: SpacingToken | number;
  readonly align?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  readonly justify?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around';
  readonly wrap?: boolean;
  readonly flex?: number;
  readonly padding?: SpacingToken | number;
  readonly paddingHorizontal?: SpacingToken | number;
  readonly paddingVertical?: SpacingToken | number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
  readonly testID?: string;
  /**
   * Groups children into one TalkBack announcement. MR-13 requires this for
   * composite rows such as the reminder card summary.
   */
  readonly groupAccessibility?: boolean;
  readonly accessibilityLabel?: string;
}

export function Stack({
  direction = 'column',
  gap = 'none',
  align,
  justify,
  wrap = false,
  flex,
  padding,
  paddingHorizontal,
  paddingVertical,
  style,
  children,
  testID,
  groupAccessibility = false,
  accessibilityLabel,
}: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: resolveSpace(gap),
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          flex,
          padding: padding === undefined ? undefined : resolveSpace(padding),
          paddingHorizontal:
            paddingHorizontal === undefined ? undefined : resolveSpace(paddingHorizontal),
          paddingVertical:
            paddingVertical === undefined ? undefined : resolveSpace(paddingVertical),
        },
        style,
      ]}
      accessible={groupAccessibility || undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}>
      {children}
    </View>
  );
}
