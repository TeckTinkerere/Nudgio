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
import {StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';

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
  /** Whether search/kind/category narrowed the query — decides which empty copy applies. */
  readonly isFiltered: boolean;
  readonly onClearFilters: () => void;
  /** Forwarded to the grid list, so a floating `AppBar` above it can track scroll position. */
  readonly onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly onLoadMore?: () => void;
  readonly loadingMore?: boolean;
  readonly header?: React.ReactElement;
  readonly locationKey?: string;
  readonly restoredOffset?: number;
  readonly folders?: readonly {id: string; content: React.ReactNode}[];
  readonly onImport?: () => void;
  readonly emptyTitle?: string;
  readonly emptyBody?: string;
}

const chunk = <T,>(items: readonly T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
};

export function LibraryGridBody({
  media,
  importMedia,
  mediaGridColumns,
  renderCard,
  isFiltered,
  onClearFilters,
  onScroll,
  onLoadMore,
  loadingMore = false,
  header,
  locationKey = 'library',
  restoredOffset = 0,
  folders = [],
  onImport,
  emptyTitle,
  emptyBody,
}: LibraryGridBodyProps) {
  const t = useTranslation();

  // `isPending`, not `isLoading` — see UpcomingScreen for why.
  if (media.isPending) {
    return <LoadingState label={t('loading.startingUp')} />;
  }
  if (media.isError && !media.data) {
    return (
      <ErrorState
        title={t('error.unexpected.title')}
        effect={t('error.unexpected.effect')}
        recoveryAction={{label: t('action.retry'), onPress: () => media.refetch()}}
        diagnosticCode={media.error.correlationId}
      />
    );
  }
  if (!media.data) {return <LoadingState label={t('loading.startingUp')} />;}
  if (media.data.items.length === 0 && folders.length === 0 && !header && !importMedia.isImporting) {
    /*
     * An empty result set has two distinct causes: a genuinely empty
     * library (first-run — the real fix is to import something) versus a
     * search/kind/category filter that matched nothing (recoverable by
     * clearing the filter, not by importing more media).
     */
    return isFiltered ? (
      <EmptyState
        testID={testIds.library.emptyState}
        icon="library"
        title={t('library.empty.filtered.title')}
        body={t('library.empty.filtered.body')}
        action={{label: t('library.empty.filtered.clearFilters'), onPress: onClearFilters}}
      />
    ) : (
      <EmptyState
        testID={testIds.library.emptyState}
        icon="library"
        title={emptyTitle ?? t('library.empty.title')}
        body={emptyBody ?? t('library.empty.body')}
        action={{label: t('today.empty.importMedia'), onPress: onImport ?? (() => importMedia.importMedia())}}
      />
    );
  }

  const rows = chunk(media.data.items, mediaGridColumns);
  const entries: Array<{key: string; folder?: React.ReactNode; media?: MediaSummary[]}> = [
    ...folders.map(folder => ({key: `folder:${folder.id}`, folder: folder.content})),
    ...rows.map(row => ({key: row.map(item => item.id).join(':'), media: row})),
  ];

  return (
    <VirtualizedList
      key={`${locationKey}:${mediaGridColumns}`}
      contentOffset={{x: 0, y: restoredOffset}}
      testID={testIds.library.grid}
      data={entries}
      ListHeaderComponent={<View>
        {importMedia.isImporting && <ProgressBar
          progress={importProgressFraction(importMedia.progress)}
          label={t(importPhaseLabelKey(importMedia.progress?.phase) ?? 'library.import.copying')}
        />}
        {header}
      </View>}
      ListFooterComponent={media.isError ? <ErrorState
        title={t('error.unexpected.title')}
        effect={t('error.unexpected.effect')}
        recoveryAction={{label: t('action.retry'), onPress: () => media.refetch()}}
        diagnosticCode={media.error?.correlationId}
      /> : loadingMore ? <LoadingState label={t('loading.startingUp')} /> : null}
      keyExtractor={entry => entry.key}
      renderItem={({item: entry}) => entry.folder ? <View style={styles.folder}>{entry.folder}</View> : (
        <View style={styles.row}>
          {entry.media?.map(item => (
            <View key={item.id} style={styles.cell}>
              {renderCard(item)}
            </View>
          ))}
        </View>
      )}
      onScroll={onScroll}
      onEndReached={media.data.hasMore && !loadingMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.4}
      scrollEventThrottle={16}
      showSeparators={false}
      // `md`, matching `layout.screenPaddingHorizontal` and the title row
      // above this grid (`LibraryScreen`/`SelectMediaScreen` both wrap their
      // header in `paddingHorizontal="md"`). This was `xs`, which left the
      // cards sitting 8 dp closer to the screen edge than the "Library"
      // heading directly above them — the grid read as having no margin at
      // all next to every other screen in the app. The 8 dp inter-card gap
      // below is deliberately *not* the same value: gutter and outer margin
      // are different things.
      horizontalPadding="md"
    />
  );
}

const styles = StyleSheet.create({
  folder: {marginBottom: 8},
  row: {flexDirection: 'row', gap: 8, marginBottom: 8},
  cell: {flex: 1},
});
