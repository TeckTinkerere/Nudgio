/**
 * Horizontally-scrolling row for a group of `Chip`s.
 *
 * MR-13 offers wrap-or-scroll as the two accessible shapes for a chip group
 * ("chip rows wrap/scroll with clear focus"). A `Stack wrap` group grows
 * unpredictably tall — 1 row on a wide phone, 2-3 once large font scale or a
 * narrow width kicks in, and that growth stacks across every filter group on
 * a screen, pushing real content below the fold (see Library/Settings,
 * docs/decision-log.md). Scrolling keeps every group a fixed single-row
 * height regardless of label count, width class or font scale.
 */
import {ScrollView} from 'react-native';

import {spacing} from '../tokens';

export interface ChipRowProps {
  readonly children: React.ReactNode;
  readonly testID?: string;
}

export function ChipRow({children, testID}: ChipRowProps) {
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{gap: spacing.xxs, paddingRight: spacing.md}}>
      {children}
    </ScrollView>
  );
}
