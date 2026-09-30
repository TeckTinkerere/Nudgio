/**
 * Library screen (MR-03 "Library").
 *
 * Two-column adaptive grid (MR-03: "two-column grid on typical phones and
 * adaptive columns on wider displays" — `useResponsive().mediaGridColumns`
 * already encodes 2/3/4 by width class), search, kind/missing filter chips,
 * category chips and sort, all driving `useMediaList`'s `MediaQuery` so
 * filtering happens once, in the query layer, not scattered across render.
 *
 * At medium/expanded width (`useResponsive().navigation === 'rail'`) this
 * renders a true two-pane layout — grid on the left, a persistent detail
 * pane (`MediaDetailContent`, embedded rather than pushed) on the right —
 * per `specs/Markdown/04_Visual_Design_System.md` "Responsive behavior":
 * "Medium: Navigation rail, two-pane Library detail." At compact width,
 * tapping a card still pushes `MediaDetailScreen` as its own screen.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {LibraryGridBody} from './LibraryGridBody';
import {LibrarySelectionHeader} from './LibrarySelectionHeader';
import {MediaDetailContent} from './MediaDetailContent';
import {MediaPreviewPlayer} from './MediaPreviewPlayer';
import {SelectionCheckboxOverlay} from './SelectionCheckboxOverlay';
import {useLibrarySelection} from './useLibrarySelection';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
  AppBar,
  Button,
  Chip,
  ChipRow,
  Dialog,
  EmptyState,
  MediaCard,
  Screen,
  Stack,
  Text,
  TextField,
  useFloatingAppBar,
  useResponsive,
} from '../../design-system';
import {
  importErrorCopy,
  STORAGE_INSUFFICIENT_MIN_MB,
  useImportMedia,
  useMediaList,
} from '../../hooks';
import {
  formatEnglishUnit,
  useTranslation,
  type TranslationKey,
} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import {useAppContainer} from '../../app/di';
import type {MediaKind, MediaQuery, MediaSummary, UUID} from '../../native-client/types';
import {formatDurationAccessible, formatDurationCompact} from '../../utils';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type KindFilter = MediaKind | 'missing';

const KIND_FILTERS: readonly {value: KindFilter; labelKey: TranslationKey}[] = [
  {value: 'video', labelKey: 'library.filter.videos'},
  {value: 'audio', labelKey: 'library.filter.audio'},
  {value: 'image', labelKey: 'library.filter.images'},
  {value: 'text', labelKey: 'library.filter.text'},
  {value: 'missing', labelKey: 'library.filter.missing'},
];

const SORTS: readonly {value: NonNullable<MediaQuery['sort']>; labelKey: TranslationKey}[] = [
  {value: 'recent', labelKey: 'library.sort.recentlyAdded'},
  {value: 'name', labelKey: 'library.sort.name'},
  {value: 'mostScheduled', labelKey: 'library.sort.mostScheduled'},
  {value: 'size', labelKey: 'library.sort.fileSize'},
];

const KIND_LABEL_KEY: Record<MediaKind, TranslationKey> = {
  video: 'library.kind.video',
  audio: 'library.kind.audio',
  image: 'library.kind.image',
  text: 'library.kind.text',
};

/** Only these two kinds have anything `MediaPreviewPlayer` can play. */
const isPlayableKind = (kind: MediaKind): kind is 'video' | 'audio' =>
  kind === 'video' || kind === 'audio';

export function LibraryScreen() {
  const t = useTranslation();
  const navigation = useNavigation<Navigation>();
  const {mediaGridColumns, navigation: navTreatment} = useResponsive();
  const appBar = useFloatingAppBar();
  const importMedia = useImportMedia();
  const {client} = useAppContainer();
  const isTwoPane = navTreatment === 'rail';

  const [search, setSearch] = useState('');
  const [activeKind, setActiveKind] = useState<KindFilter | null>(null);
  const [sort, setSort] = useState<NonNullable<MediaQuery['sort']>>('recent');
  const [previewItem, setPreviewItem] = useState<MediaSummary | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<UUID | null>(null);
  const [folderSearch, setFolderSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [libraryState, setLibraryState] = useState<{folders: Array<{id: string; name: string; parentId?: string | null; pinned?: boolean; mediaIds?: string[]}>; revision: number; unsorted?: number}>({folders: [], revision: 0});
  const refreshFolders = useCallback(async () => {
    const result = await client.libraryCommand({action: 'list'});
    if (result.ok && result.value && typeof result.value === 'object') {
      const value = result.value as {folders?: typeof libraryState.folders; revision?: number; unsorted?: number};
      setLibraryState({folders: value.folders ?? [], revision: value.revision ?? 0, unsorted: value.unsorted});
    }
  }, [client]);
  useEffect(() => { void refreshFolders(); }, [refreshFolders]);
  const createFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const commandId = `00000000-0000-4000-8000-${Date.now().toString().slice(-12).padStart(12, '0')}`;
    const result = await client.libraryCommand({action: 'create', name, revision: libraryState.revision, commandId});
    if (result.ok) { setNewFolderName(''); await refreshFolders(); }
  }, [client, libraryState.revision, newFolderName, refreshFolders]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const {
    selectionMode,
    selectedIds,
    enterSelection,
    exitSelection,
    toggleSelected,
    handleBulkAction,
  } = useLibrarySelection();
  // Sort is a secondary refinement collapsed by default — kept visible, it
  // added another chip row on top of search and the kind filters, pushing
  // the actual media grid below the fold on every phone
  // (docs/decision-log.md). The kind filter row stays always visible since
  // it is the filter people reach for constantly. Category filtering was
  // removed outright, not just collapsed: `categoryId` has no backing
  // Room table at all (no category-assignment UI exists anywhere either),
  // so the chips only ever filtered against ids nothing could ever match.
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const hasSecondaryFilter = sort !== 'recent';

  const query = useMemo<MediaQuery>(
    () => ({
      search: search.length > 0 ? search : undefined,
      kinds: activeKind && activeKind !== 'missing' ? [activeKind] : undefined,
      onlyMissing: activeKind === 'missing' ? true : undefined,
      sort,
      offset: 0,
      limit: 100,
    }),
    [search, activeKind, sort],
  );

  const media = useMediaList(query);
  const activeFolder = libraryState.folders.find(folder => folder.id === activeFolderId);
  const visibleMedia = useMemo(() => {
    if (!activeFolderId) return media.data?.items ?? [];
    const ids = new Set(activeFolder?.mediaIds ?? []);
    const childIds = libraryState.folders.filter(folder => folder.parentId === activeFolderId).flatMap(folder => folder.mediaIds ?? []);
    childIds.forEach(id => ids.add(id));
    return (media.data?.items ?? []).filter(item => ids.has(item.id));
  }, [activeFolder, activeFolderId, libraryState.folders, media.data?.items]);

  /**
   * An empty result set has two causes and the user can only act on one of
   * them. Sort is excluded deliberately: it reorders, it never excludes, so
   * it is not something "Clear filters" should reset.
   */
  const isFiltered = search.length > 0 || activeKind !== null;

  const clearFilters = useCallback(() => {
    setSearch('');
    setActiveKind(null);
  }, []);

  const openItem = useCallback(
    (item: MediaSummary) => {
      if (isTwoPane) {
        setSelectedMediaId(item.id);
      } else {
        navigation.navigate(rootRoutes.mediaDetail, {mediaId: item.id});
      }
    },
    [isTwoPane, navigation],
  );

  const renderCard = useCallback(
    (item: MediaSummary) => (
      <View style={styles.cardWrapper}>
        <MediaCard
          title={item.title}
          kind={item.kind}
          kindLabel={t(KIND_LABEL_KEY[item.kind])}
          thumbnailUri={thumbnailImageSource(item.thumbnailToken)?.uri}
          aspectRatio={
            item.widthPx && item.heightPx ? item.widthPx / item.heightPx : undefined
          }
          durationLabel={item.durationMs ? formatDurationCompact(item.durationMs) : undefined}
          durationAccessibleLabel={
            item.durationMs ? formatDurationAccessible(item.durationMs, formatEnglishUnit) : undefined
          }
          activeReminderCount={item.activeReminderCount}
          activeReminderCountLabel={
            item.activeReminderCount > 0
              ? `${item.activeReminderCount} active reminder${item.activeReminderCount === 1 ? '' : 's'}`
              : undefined
          }
          isMissing={item.integrity === 'missing'}
          missingLabel={t('library.integrity.missing')}
          onPress={() => (selectionMode ? toggleSelected(item.id) : openItem(item))}
          onPlayPress={
            !selectionMode && isPlayableKind(item.kind) ? () => setPreviewItem(item) : undefined
          }
          playLabel={t('library.player.play', {title: item.title})}
        />
        {selectionMode ? <SelectionCheckboxOverlay selected={selectedIds.has(item.id)} /> : null}
      </View>
    ),
    [openItem, selectedIds, selectionMode, t, toggleSelected],
  );

  const gridPane = (
    <>
      {/* The title and the normal-mode "Select" affordance now live in this
      screen's floating `AppBar` (see `appBarSlot` below), so all four tab
      roots share the same compact bar. `LibrarySelectionHeader` stays for
      selection mode only, where it is a contextual action bar (black Back +
      Export/Delete) rather than a title row — its `title` is unused on that
      branch. */}
      <Stack gap="xs" paddingHorizontal="md" paddingVertical="sm">
        <Stack gap="xxs">
          <TextField label="Search folders" value={folderSearch} onChangeText={setFolderSearch} />
          <ChipRow>
            {libraryState.folders.filter(folder => folder.name.toLowerCase().includes(folderSearch.toLowerCase())).map(folder => (
              <Chip key={folder.id} label={`${folder.parentId ? '↳ ' : ''}${folder.name}`} selected={activeFolderId === folder.id} onPress={() => setActiveFolderId(folder.id)} />
            ))}
          </ChipRow>
          <Stack direction="row" gap="xs" align="center">
            <TextField label="New folder" value={newFolderName} onChangeText={setNewFolderName} />
            <Button label="Create" variant="tonal" onPress={() => void createFolder()} />
          </Stack>
        </Stack>
        {selectionMode ? (
          <LibrarySelectionHeader
            title={t('library.title')}
            selectionMode
            backLabel={t('library.selection.back')}
            selectLabel={t('library.selection.select')}
            exportLabel={t('library.selection.export')}
            deleteLabel={t('library.selection.delete')}
            onSelect={enterSelection}
            onBack={exitSelection}
            onExport={() => handleBulkAction('export')}
            onDelete={() => handleBulkAction('delete')}
            selectTestID={testIds.library.selectButton}
            backTestID={testIds.library.backButton}
            exportTestID={testIds.library.exportButton}
            deleteTestID={testIds.library.deleteButton}
          />
        ) : null}

        <TextField
          label={t('library.search.placeholder')}
          value={search}
          onChangeText={setSearch}
          testID={testIds.library.searchField}
        />

        <ChipRow>
          {KIND_FILTERS.map(filter => (
            <Chip
              key={filter.value}
              label={t(filter.labelKey)}
              selected={activeKind === filter.value}
              onPress={() =>
                setActiveKind(current => (current === filter.value ? null : filter.value))
              }
            />
          ))}
          <Chip
            label={t(filtersExpanded ? 'library.filters.fewer' : 'library.filters.more')}
            selected={filtersExpanded || hasSecondaryFilter}
            icon={filtersExpanded ? 'chevronUp' : 'chevronDown'}
            onPress={() => setFiltersExpanded(current => !current)}
          />
        </ChipRow>

        {filtersExpanded ? (
          <Stack gap="xxs">
            <ChipRow>
              {SORTS.map(option => (
                <Chip
                  key={option.value}
                  label={t(option.labelKey)}
                  selected={sort === option.value}
                  onPress={() => setSort(option.value)}
                />
              ))}
            </ChipRow>
          </Stack>
        ) : null}
      </Stack>

      <Stack gap="xs">
        {activeFolderId ? <Button label="Library" variant="text" onPress={() => setActiveFolderId(null)} /> : null}
      {activeFolder ? <Text variant="titleMedium">{activeFolder.name}</Text> : null}
      <LibraryGridBody
        media={{...media, data: media.data ? {...media.data, items: visibleMedia, total: visibleMedia.length, hasMore: false} : undefined} as ReturnType<typeof useMediaList>}
        importMedia={importMedia}
        mediaGridColumns={mediaGridColumns}
        renderCard={renderCard}
        isFiltered={isFiltered}
        onClearFilters={clearFilters}
        onScroll={appBar.onScroll}
      />
      </Stack>
    </>
  );

  return (
    <Screen
      edgeToEdge
      hasAppBar
      testID={testIds.library.screen}
      appBarSlot={
        <AppBar
          title={t('library.title')}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
          trailing={
            selectionMode ? undefined : (
              <Button
                variant="text"
                label={t('library.selection.select')}
                onPress={enterSelection}
                testID={testIds.library.selectButton}
              />
            )
          }
        />
      }>
      <View style={{paddingTop: appBar.barHeight}} />
      {isTwoPane ? (
        <Stack direction="row" gap="sm" flex={1}>
          <View style={styles.gridPane}>{gridPane}</View>
          <View style={styles.detailPane}>
            {selectedMediaId ? (
              <MediaDetailContent
                mediaId={selectedMediaId}
                onDeleted={() => setSelectedMediaId(null)}
              />
            ) : (
              <EmptyState
                icon="library"
                title={t('library.detail.emptySelectionTitle')}
                body={t('library.detail.emptySelectionBody')}
              />
            )}
          </View>
        </Stack>
      ) : (
        gridPane
      )}

      {importMedia.error ? (
        <Dialog
          visible
          title={t(importErrorCopy(importMedia.error).titleKey)}
          body={t(
            importErrorCopy(importMedia.error).bodyKey,
            importErrorCopy(importMedia.error).bodyKey === 'library.import.errorInsufficientSpace'
              ? {megabytes: STORAGE_INSUFFICIENT_MIN_MB}
              : undefined,
          )}
          cancel={{label: t('action.close'), onPress: () => importMedia.reset()}}
        />
      ) : null}
      {previewItem && isPlayableKind(previewItem.kind) ? (
        <MediaPreviewPlayer
          visible
          onDismiss={() => setPreviewItem(null)}
          title={previewItem.title}
          sourceToken={previewItem.sourceToken}
          kind={previewItem.kind}
          closeLabel={t('library.player.close')}
          loadErrorLabel={t('library.player.loadError')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gridPane: {flex: 5},
  detailPane: {flex: 4},
  cardWrapper: {flex: 1},
});
