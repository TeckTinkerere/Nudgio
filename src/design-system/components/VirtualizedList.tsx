/**
 * Themed virtualized list.
 *
 * A screen that renders a collection of unknown/unbounded size (reminders,
 * media, occurrences — MR-09 anticipates up to 10,000 reminders and 50,000
 * retained occurrences) must never eagerly map an array into JSX. That both
 * defeats React Native's view recycling and, inside a non-`scrollable`
 * `Screen`, silently clips content with no way to reach it. This wraps
 * `FlatList` so every list in the app gets the same safe-area handling,
 * separator and empty/footer conventions instead of each screen
 * reinventing them — and so "virtualized" is the only option, not an
 * opt-in a screen author has to remember.
 */
import {useCallback} from 'react';
import {FlatList, type FlatListProps, type ListRenderItem} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Divider} from '../layout/Divider';
import {useTheme} from '../theme/useTheme';
import {layout, resolveSpace, type SpacingToken} from '../tokens';


export interface VirtualizedListProps<T>
  extends Omit<
    FlatListProps<T>,
    'renderItem' | 'ItemSeparatorComponent' | 'contentContainerStyle'
  > {
  readonly renderItem: ListRenderItem<T>;
  /** Renders a hairline between rows. Off for card grids, which own their own gaps. */
  readonly showSeparators?: boolean;
  readonly horizontalPadding?: SpacingToken | number;
  /** Extra bottom padding so the last row clears a tab-hosted FAB. */
  readonly clearsFab?: boolean;
  readonly testID?: string;
}

export function VirtualizedList<T>({
  renderItem,
  showSeparators = true,
  horizontalPadding = 'md',
  clearsFab = false,
  data,
  testID,
  ...flatListProps
}: VirtualizedListProps<T>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const renderSeparator = useCallback(
    () => <Divider emphasis="low" inset={resolveSpace(horizontalPadding)} />,
    [horizontalPadding],
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      ItemSeparatorComponent={showSeparators ? renderSeparator : undefined}
      contentContainerStyle={{
        paddingHorizontal: resolveSpace(horizontalPadding),
        // Bottom inset lives on the content, matching `Screen`'s scrollable
        // variant, so the list's own scroll track still reaches the physical
        // edge (MR-04 "Insets and system UI").
        paddingBottom: insets.bottom + theme.spacing.xl + (clearsFab ? layout.fabClearance : 0),
      }}
      // MR-13 ACC-003: content must stay reachable at large font scale, which
      // means real rows, not a fixed-height virtualization estimate.
      showsVerticalScrollIndicator
      // Android-specific perf win: detached rows release their native view.
      removeClippedSubviews
      testID={testID}
      {...flatListProps}
    />
  );
}
