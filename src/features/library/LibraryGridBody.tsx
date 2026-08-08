/**
 * The Library grid's loading/error/importing/empty/populated state machine,
 * extracted out of `LibraryScreen` so that screen's own two-pane branching
 * (added for the medium/expanded responsive layout) doesn't push it over the
 * cognitive-complexity budget every screen in this codebase is held to.
 */
import type {ListRenderItem} from 'react-native';

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
  readonly renderItem: ListRenderItem<MediaSummary>;
  /** Whether search/kind/category narrowed the query — decides which empty copy applies. */
  readonly isFiltered: boolean;
  readonly onClearFilters: () => void;
}

export function LibraryGridBody({
  media,
  importMedia,
  mediaGridColumns,
  renderItem,
  isFiltered,
  onClearFilters,
}: LibraryGridBodyProps) {
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
        title={t('library.empty.title')}
        body={t('library.empty.body')}
        action={{label: t('today.empty.importMedia'), onPress: () => importMedia.importMedia()}}
      />
    );
  }

  return (
    <VirtualizedList
      key={mediaGridColumns}
      testID={testIds.library.grid}
      data={media.data.items}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      numColumns={mediaGridColumns}
      showSeparators={false}
      horizontalPadding="xs"
    />
  );
}
