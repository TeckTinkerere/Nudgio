/**
 * The Library grid's loading/error/importing/empty/populated state machine,
 * extracted out of `LibraryScreen` so that screen's own two-pane branching
 * (added for the medium/expanded responsive layout) doesn't push it over the
 * cognitive-complexity budget every screen in this codebase is held to.
 *
 * Renders pre-chunked rows, not a flat item list with `numColumns`: each
 * card keeps its own real aspect ratio (never forced into a uniform 16:9/
 * square crop), so `FlatList`'s built-in column mode — which assumes every
 * cell in a "column" is the same height — cannot express it. A row is a
 * plain flex row of `flex: 1` cards instead; that same `flex: 1` is what
 * makes a trailing, less-than-full row's card(s) stretch to fill the space
 * a missing sibling would have taken, with no special-casing needed for
 * "the last odd item spans the full width."
 */
import {StyleSheet, View} from 'react-native';

import {testIds} from '../../constants';
import {EmptyState, ErrorState, LoadingState, ProgressBar, VirtualizedList} from '../../design-system';
import type {useImportMedia, useMediaList} from '../../hooks';
import {importPhaseLabelKey, importProgressFraction} from '../../hooks';
import {useTranslation} from '../../localization';
import type {MediaSummary} from '../../native-client/types';

export interface LibraryGridBodyProps {
  readonly media: ReturnType<typeof useMediaList>;
  readonly importMedia: ReturnType<typeof useImportMedia>;
  readonly mediaGridColumns: number;
  readonly renderCard: (item: MediaSummary) => React.ReactNode;
}

const chunk = <T,>(items: readonly T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
};

export function LibraryGridBody({media, importMedia, mediaGridColumns, renderCard}: LibraryGridBodyProps) {
  const t = useTranslation();

  // `isPending`, not `isLoading` — see TodayScreen for why.
  if (media.isPending) {
    return <LoadingState label={t('loading.startingUp')} />;
  }
  if (media.isError) {
    return (
      <ErrorState
        title={t('error.unexpected.title')}
        effect={t('error.unexpected.effect')}
        recoveryAction={{label: t('action.retry'), onPress: () => media.refetch()}}
        diagnosticCode={media.error.correlationId}
      />
    );
  }
  if (importMedia.isImporting) {
    return (
      <ProgressBar
        progress={importProgressFraction(importMedia.progress)}
        label={t(importPhaseLabelKey(importMedia.progress?.phase) ?? 'library.import.copying')}
      />
    );
  }
  if (media.data.items.length === 0) {
    return (
      <EmptyState
        icon="library"
        title={t('today.empty.title')}
        body={t('today.empty.body')}
        action={{label: t('today.empty.importMedia'), onPress: () => importMedia.importMedia()}}
      />
    );
  }

  const rows = chunk(media.data.items, mediaGridColumns);

  return (
    <VirtualizedList
      key={mediaGridColumns}
      testID={testIds.library.grid}
      data={rows}
      keyExtractor={row => row.map(item => item.id).join(':')}
      renderItem={({item: row}) => (
        <View style={styles.row}>
          {row.map(item => (
            <View key={item.id} style={styles.cell}>
              {renderCard(item)}
            </View>
          ))}
        </View>
      )}
      showSeparators={false}
      horizontalPadding="xs"
    />
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', gap: 8, marginBottom: 8},
  cell: {flex: 1},
});
