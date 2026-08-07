import {View} from 'react-native';

import {useTheme} from '../theme/useTheme';
import {resolveSpace, type SpacingToken} from '../tokens';

export interface DividerProps {
  readonly inset?: SpacingToken | number;
  /** Use the stronger `outline` role instead of `outlineVariant`. */
  readonly emphasis?: 'low' | 'high';
  readonly spacing?: SpacingToken | number;
}

/**
 * A divider is decorative. It is hidden from assistive technology so TalkBack
 * does not announce a separator between every list row (MR-13).
 */
export function Divider({inset = 'none', emphasis = 'low', spacing = 'none'}: DividerProps) {
  const theme = useTheme();
  const vertical = resolveSpace(spacing);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: theme.layout.borderWidth,
        backgroundColor:
          emphasis === 'high' ? theme.color.outline : theme.color.outlineVariant,
        // `marginStart` rather than `marginLeft` so the inset mirrors in RTL.
        marginStart: resolveSpace(inset),
        marginTop: vertical,
        marginBottom: vertical,
      }}
    />
  );
}
