/* eslint-disable no-void -- UI event handlers intentionally launch async actions. */
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
import {useIsFocused, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useInfiniteQuery} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';

import {folderDestinations} from './folderDestinations';
import {LibraryGridBody} from './LibraryGridBody';
import {MediaDetailContent} from './MediaDetailContent';
import {MediaPreviewPlayer} from './MediaPreviewPlayer';
import {SelectionCheckboxOverlay} from './SelectionCheckboxOverlay';
import {useLibrarySelection} from './useLibrarySelection';
import {useAppContainer} from '../../app/di';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {queryKeys, unwrapResult} from '../../core/state';
import {
  AppBar,
  Button,
  Card,
  Chip,
  ChipRow,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  LoadingState,
  MediaCard,
  ProgressBar,
  Screen,
  Sheet,
  Stack,
  Text,
  TextField,
  VirtualizedList,
  useTheme,
  useFloatingAppBar,
  useResponsive,
} from '../../design-system';
import {
  importErrorCopy,
  importPhaseLabelKey,
  importProgressFraction,
  STORAGE_INSUFFICIENT_MIN_MB,
  useImportMedia,
} from '../../hooks';
import {
  formatEnglishUnit,
  useTranslation,
  type TranslationKey,
} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
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
  const isFocused = useIsFocused();
  const {mediaGridColumns, navigation: navTreatment} = useResponsive();
  const appBar = useFloatingAppBar();
  const theme = useTheme();
  const importMedia = useImportMedia();
  const {client, repositories} = useAppContainer();
  const isTwoPane = navTreatment === 'rail';

  const [search, setSearch] = useState('');
  const [activeKind, setActiveKind] = useState<KindFilter | null>(null);
  const [sort, setSort] = useState<NonNullable<MediaQuery['sort']>>('recent');
  const [previewItem, setPreviewItem] = useState<MediaSummary | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<UUID | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [libraryState, setLibraryState] = useState<{folders: Array<{id: string; name: string; parentId?: string | null; pinned?: boolean; mediaIds?: string[]; count?: number; directCount?: number}>; revision: number; unsorted?: number}>({folders: [], revision: 0});
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [folderLoadFailed, setFolderLoadFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [sheet, setSheet] = useState<'add' | 'create' | 'rename' | 'folderOptions' | 'move' | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<ReadonlySet<string>>(new Set());
  const [destination, setDestination] = useState<string | null>(null);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationChosen, setDestinationChosen] = useState(false);
  const [undoRevision, setUndoRevision] = useState<number | null>(null);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const locations = useRef(new Map<string, {search: string; kind: KindFilter | null; offset: number}>());
  const currentOffset = useRef(0);
  const [restoredOffset, setRestoredOffset] = useState(0);
  const refreshFolders = useCallback(async () => {
    const result = await client.libraryCommand({action: 'list'});
    setFolderLoadFailed(!result.ok || !result.value || typeof result.value !== 'object');
    if (result.ok && result.value && typeof result.value === 'object') {
      const value = result.value as {folders?: Array<{id: string; name: string; parentId?: string | null; pinned?: boolean; mediaIds?: string[]; count?: number; directCount?: number}>; revision?: number; unsorted?: number};
      setLibraryState({folders: value.folders ?? [], revision: value.revision ?? 0, unsorted: value.unsorted});
      setFoldersLoaded(true);
    }
  }, [client]);
  const createFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || busy) {return;}
    setBusy(true);
    setNotice(null);
    try {
    const commandId = `00000000-0000-4000-8000-${Date.now().toString().slice(-12).padStart(12, '0')}`;
    const result = await client.libraryCommand(sheet === 'rename'
      ? {action: 'rename', id: activeFolderId, name, revision: libraryState.revision, commandId}
      : {action: 'create', name, parentId: activeFolderId && activeFolderId !== 'unsorted' ? activeFolderId : null, revision: libraryState.revision, commandId});
    if (result.ok) { setNewFolderName(''); setSheet(null); await refreshFolders(); }
    else {setNotice(t('library.explorer.folderSaveFailed'));}
    } finally {setBusy(false);}
  }, [client, libraryState.revision, newFolderName, refreshFolders, activeFolderId, sheet, t, busy]);
  const {
    selectionMode,
    selectedIds,
    enterSelection,
    exitSelection,
    toggleSelected,
    handleBulkAction,
  } = useLibrarySelection();
  const leaveSelection = useCallback(() => { exitSelection(); setSelectedFolders(new Set()); }, [exitSelection]);
  const openFolder = useCallback((id: string | null) => {
    locations.current.set(activeFolderId ?? 'root', {search, kind: activeKind, offset: currentOffset.current});
    const saved = locations.current.get(id ?? 'root');
    currentOffset.current = saved?.offset ?? 0;
    setRestoredOffset(currentOffset.current);
    setActiveFolderId(id); setSearch(saved?.search ?? ''); setActiveKind(saved?.kind ?? null); leaveSelection();
  }, [activeFolderId, search, activeKind, leaveSelection]);
  const onExplorerScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    currentOffset.current = event.nativeEvent.contentOffset.y;
    appBar.onScroll(event);
  };
  const toggleFolder = (id: string) => setSelectedFolders(current => {
    const next = new Set(current);
    if (next.has(id)) {next.delete(id);} else {next.add(id);}
    return next;
  });
  const runMove = async () => {
    if (busy) {return;}
    if (selectedFolders.size && selectedIds.size) {
      setNotice(t('library.explorer.moveSeparate'));
      setSheet(null);
      return;
    }
    setBusy(true);
    let revision = libraryState.revision;
    try {
      for (const id of selectedFolders) {
        const result = await client.libraryCommand({action: 'reparent', id, parentId: destination,
          revision, commandId: `00000000-0000-4000-8000-${Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0')}`});
        if (!result.ok) { setNotice(t('library.explorer.moveFolderFailed')); return; }
        revision = (result.value as {revision: number}).revision;
        setSelectedFolders(current => new Set([...current].filter(selected => selected !== id)));
      }
      const chosen = visibleMedia.filter(item => selectedIds.has(item.id));
      if (chosen.length !== selectedIds.size) { setNotice(t('library.explorer.moveMediaChanged')); return; }
      if (chosen.length) {
        const details = await Promise.all(chosen.map(item => unwrapResult(() => repositories.media.get(item.id))));
        const result = await client.libraryCommand({action: 'move', destination,
          items: details.map(item => ({id: item.id, version: item.entityVersion})), revision,
          commandId: `00000000-0000-4000-8000-${Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0')}`});
        if (!result.ok) { setNotice(t('library.explorer.moveMediaFailed')); return; }
        setUndoRevision((result.value as {revision: number}).revision);
      }
      setSheet(null); leaveSelection(); await refreshFolders(); await mediaQuery.refetch();
    } catch { setNotice(t('library.explorer.moveFailed')); }
    finally { await refreshFolders(); setBusy(false); }
  };
  const runDelete = async () => {
    if (busy) {return;}
    setBusy(true);
    let revision = libraryState.revision;
    try {
      for (const id of selectedFolders) {
        const result = await client.libraryCommand({action: 'delete', id, revision,
          commandId: `00000000-0000-4000-8000-${Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0')}`});
        if (!result.ok) { setNotice(t('library.explorer.folderRemoveFailed')); return; }
        revision = (result.value as {revision: number}).revision;
      }
      if (selectedIds.size) {
        const deleted = await handleBulkAction('delete');
        if (!deleted) {await refreshFolders(); await mediaQuery.refetch(); return;}
        setSelectedFolders(new Set());
      } else {leaveSelection();}
      setDeletePrompt(false);
      if (activeFolderId && selectedFolders.has(activeFolderId)) {openFolder(null);}
      await refreshFolders(); await mediaQuery.refetch();
    } finally { setBusy(false); }
  };
  const importHere = async () => {
    setSheet(null);
    try {
      const outcome = await importMedia.importMediaAsync();
      if (outcome.status !== 'imported' || !outcome.media) {return;}
      if (activeFolderId && activeFolderId !== 'unsorted') {
        const fresh = await client.libraryCommand({action: 'list'});
        if (!fresh.ok) { setNotice(t('library.explorer.importedUnsorted')); return; }
        const revision = (fresh.value as {revision: number}).revision;
        const result = await client.libraryCommand({action: 'move', destination: activeFolderId,
          items: [{id: outcome.media.id, version: outcome.media.entityVersion}], revision,
          commandId: `00000000-0000-4000-8000-${Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0')}`});
        if (!result.ok) {setNotice(t('library.explorer.importedUnsorted'));}
      }
      await refreshFolders(); await mediaQuery.refetch();
    } catch { /* Existing import error dialog reports the failure. */ }
  };
  const renderFolder = (folder: (typeof libraryState.folders)[number]) => (
    <Card key={folder.id} selected={selectedFolders.has(folder.id)}
      accessibilityLabel={`${folder.parentId
        ? `${libraryState.folders.find(parent => parent.id === folder.parentId)?.name ?? t('library.title')} › `
        : ''}${folder.name}, ${t(folder.count === 1 ? 'library.explorer.item' : 'library.explorer.items', {count: folder.count ?? 0})}`}
      onPress={() => selectionMode ? toggleFolder(folder.id) : openFolder(folder.id)}
      onLongPress={() => { if (!selectionMode) {enterSelection();} toggleFolder(folder.id); }}>
      <Stack direction="row" gap="sm" align="center">
        <Icon name="folder" size="lg" color={theme.color.primary} />
        <Stack gap="xxs" style={styles.flexFill}>
          <Text variant="titleMedium">{folder.name}</Text>
          <Text variant="bodyMedium" tone="variant">{t(folder.count === 1 ? 'library.explorer.item' : 'library.explorer.items', {count: folder.count ?? 0})}</Text>
          {folder.pinned && <Text variant="labelMedium" tone="variant">{t('library.explorer.pinned')}</Text>}
          {folder.parentId && <Text variant="labelMedium" tone="variant">
            {libraryState.folders.find(parent => parent.id === folder.parentId)?.name ?? t('library.title')} › {folder.name}
          </Text>}
        </Stack>
      </Stack>
    </Card>
  );
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

  const activeFolder = libraryState.folders.find(folder => folder.id === activeFolderId);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) {return false;}
      if (selectionMode) {
        exitSelection(); setSelectedFolders(new Set());
        return true;
      }
      if (activeFolderId) {
        openFolder(activeFolder?.parentId ?? null);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [activeFolder?.parentId, activeFolderId, exitSelection, navigation, selectionMode, openFolder]);
  const query = useMemo<MediaQuery>(
    () => ({
      search: search.length > 0 ? search : undefined,
      location: activeFolderId === 'unsorted' ? 'unsorted' : activeFolderId ? 'folder' : 'all',
      folderId: activeFolderId && activeFolderId !== 'unsorted' ? activeFolderId as UUID : undefined,
      kinds: activeKind && activeKind !== 'missing' ? [activeKind] : undefined,
      onlyMissing: activeKind === 'missing' ? true : undefined,
      sort,
      offset: 0,
      limit: 50,
    }),
    [search, activeKind, sort, activeFolderId],
  );

  const mediaQuery = useInfiniteQuery({
    queryKey: [...queryKeys.media.all(), 'explorer', query, libraryState.revision], initialPageParam: 0,
    gcTime: 5 * 60 * 1000,
    queryFn: ({pageParam}) => unwrapResult(() => repositories.media.list({...query, offset: pageParam})),
    getNextPageParam: last => last.hasMore ? last.offset + last.items.length : undefined,
  });
  const refetchMedia = mediaQuery.refetch;
  useEffect(() => {
    if (!isFocused) {return;}
    void refreshFolders();
    void refetchMedia();
  }, [isFocused, refetchMedia, refreshFolders]);
  const visibleMedia = useMemo(() => mediaQuery.data?.pages.flatMap(page => page.items) ?? [], [mediaQuery.data]);
  const media = {...mediaQuery, data: mediaQuery.data ? {
    items: visibleMedia, total: mediaQuery.data.pages[0]?.total ?? 0, offset: 0,
    hasMore: Boolean(mediaQuery.hasNextPage),
  } : undefined} as unknown as Parameters<typeof LibraryGridBody>[0]['media'];

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
          selected={selectedIds.has(item.id)}
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
          onLongPress={() => { if (!selectionMode) {enterSelection();} toggleSelected(item.id); }}
          onPlayPress={
            !selectionMode && isPlayableKind(item.kind) ? () => setPreviewItem(item) : undefined
          }
          playLabel={t('library.player.play', {title: item.title})}
        />
        {selectionMode ? <SelectionCheckboxOverlay selected={selectedIds.has(item.id)} /> : null}
      </View>
    ),
    [enterSelection, openItem, selectedIds, selectionMode, t, toggleSelected],
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
        {activeFolderId ? <Stack direction="row" gap="xs" align="center" wrap>
          <Button label={t('library.title')} variant="text" onPress={() => openFolder(null)} />
          {activeFolder?.parentId && <Button variant="text"
            label={libraryState.folders.find(folder => folder.id === activeFolder.parentId)?.name ?? t('library.explorer.parent')}
            onPress={() => openFolder(activeFolder.parentId ?? null)} />}
          <Text variant="titleMedium">› {activeFolder?.name ?? t('library.explorer.unsorted')}</Text>
          {activeFolder && !selectionMode && <Button label={t('library.explorer.folderOptions')} variant="text"
            onPress={() => setSheet('folderOptions')} />}
        </Stack> : <Stack direction="row" gap="xs">
          <Button label={t('library.explorer.folders')} variant={showAll ? 'text' : 'tonal'}
            onPress={() => { setShowAll(false); leaveSelection(); }} />
          <Button label={t('library.explorer.allMedia')} variant={showAll ? 'tonal' : 'text'}
            onPress={() => { setShowAll(true); leaveSelection(); }} />
        </Stack>}
        {notice && <Text variant="bodyMedium" tone="error">{notice}</Text>}
        {folderLoadFailed && <Button variant="tonal" label={t('library.explorer.retryFolders')}
          onPress={() => void refreshFolders()} />}
        {!activeFolderId && !showAll && !search.trim() && importMedia.isImporting && <ProgressBar
          progress={importProgressFraction(importMedia.progress)}
          label={t(importPhaseLabelKey(importMedia.progress?.phase) ?? 'library.import.copying')} />}
        {undoRevision !== null && <Button label={t('library.explorer.undoMove')} variant="tonal"
          disabled={busy} onPress={() => void (async () => {
            setBusy(true);
            try {
              const result = await client.libraryCommand({action: 'undo', revision: undoRevision,
                commandId: `00000000-0000-4000-8000-${Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0')}`});
              setUndoRevision(null);
              if (!result.ok) {setNotice(t('library.explorer.undoUnavailable'));}
              await refreshFolders(); await mediaQuery.refetch();
            } finally {setBusy(false);}
          })()} />}
        <TextField
          label={activeFolderId
            ? t('library.explorer.searchPlace', {name: activeFolder?.name ?? t('library.explorer.unsorted')})
            : t('library.explorer.searchLibrary')}
          value={search}
          onChangeText={value => { setSearch(value); if (selectionMode) {leaveSelection();} }}
          testID={testIds.library.searchField}
        />

        {(showAll || activeFolderId) && <ChipRow>
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
        </ChipRow>}

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

      {!foldersLoaded && !folderLoadFailed ? <LoadingState label={t('loading.startingUp')} />
      : !activeFolderId && !showAll && !search.trim() ? <VirtualizedList
        contentOffset={{x: 0, y: restoredOffset}} onScroll={onExplorerScroll}
        data={libraryState.folders.filter(folder => !folder.parentId && folder.name.toLowerCase().includes(search.toLowerCase()))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name))}
        keyExtractor={folder => folder.id}
        renderItem={({item}) => <View style={styles.folderRow}>{renderFolder(item)}</View>}
        ListHeaderComponent={<View style={styles.folderRow}><Button label={`${t('library.explorer.unsorted')} · ${libraryState.unsorted ?? 0}`}
          variant="tonal" onPress={() => openFolder('unsorted')} /></View>}
        ListEmptyComponent={!folderLoadFailed ? <EmptyState icon="folder" title={t('library.explorer.emptyFoldersTitle')}
          body={t('library.explorer.emptyFoldersBody')}
          action={{label: t('library.explorer.newFolder'), onPress: () => {setNewFolderName(''); setSheet('create');}}} /> : null}
        showSeparators={false} /> : <Stack gap="xs" flex={1}>
      <LibraryGridBody
        media={media}
        locationKey={activeFolderId ?? 'root'} restoredOffset={restoredOffset}
        importMedia={importMedia}
        mediaGridColumns={mediaGridColumns}
        renderCard={renderCard}
        isFiltered={isFiltered}
        onClearFilters={clearFilters}
        onScroll={onExplorerScroll}
        onLoadMore={() => void mediaQuery.fetchNextPage()}
        loadingMore={mediaQuery.isFetchingNextPage}
        onImport={() => void importHere()}
        emptyTitle={activeFolderId ? t('library.explorer.emptyFolderTitle') : undefined}
        emptyBody={activeFolderId ? t('library.explorer.emptyFolderBody') : undefined}
        folders={libraryState.folders.filter(folder => (
          activeFolder ? folder.parentId === activeFolder.id : !activeFolderId && Boolean(search.trim())
        ) && folder.name.toLowerCase().includes(search.toLowerCase()))
          .map(folder => ({id: folder.id, content: renderFolder(folder)}))}
      />
      </Stack>}
    </>
  );

  return (
    <Screen
      edgeToEdge
      hasAppBar
      testID={testIds.library.screen}
      appBarSlot={
        <AppBar
          title={activeFolder?.name ?? (activeFolderId === 'unsorted' ? t('library.explorer.unsorted') : t('library.title'))}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
          trailing={
            <Stack direction="row" gap="xs">
              {!selectionMode && <IconButton name="add" label={t('library.explorer.add')} onPress={() => setSheet('add')} />}
              <Button variant="text" label={selectionMode ? t('action.cancel') : t('library.selection.select')}
                onPress={selectionMode ? leaveSelection : enterSelection} testID={testIds.library.selectButton} />
            </Stack>
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

      {selectionMode && <Stack direction="row" gap="xs" paddingHorizontal="md" paddingVertical="sm" align="center" wrap>
        <Text variant="labelLarge">{t('library.explorer.selected', {count: selectedIds.size + selectedFolders.size})}</Text>
        <Button label={t('library.explorer.move')} variant="tonal" disabled={selectedIds.size + selectedFolders.size === 0}
          onPress={() => { setDestination(null); setDestinationChosen(false); setDestinationSearch(''); setNotice(null); setSheet('move'); }} />
        <Button label={t('library.selection.delete')} variant="destructive" disabled={selectedIds.size + selectedFolders.size === 0}
          onPress={() => setDeletePrompt(true)} />
      </Stack>}
      <Sheet visible={sheet === 'add'} title={t('library.explorer.add')} closeLabel={t('library.explorer.close')} onDismiss={() => setSheet(null)}>
        <Button label={t(activeFolder ? 'library.explorer.newSubfolder' : 'library.explorer.newFolder')}
          disabled={Boolean(activeFolder?.parentId || activeFolderId === 'unsorted')}
          onPress={() => { setNewFolderName(''); setSheet('create'); }} />
        <Button label={t('library.explorer.importMedia')} variant="tonal" onPress={() => void importHere()} />
      </Sheet>
      <Sheet visible={sheet === 'folderOptions'} title={activeFolder?.name ?? t('library.explorer.folders')}
        closeLabel={t('library.explorer.close')} onDismiss={() => setSheet(null)}>
        <Button label={t('library.explorer.rename')} onPress={() => {
          setNewFolderName(activeFolder?.name ?? ''); setSheet('rename');
        }} />
        <Button label={t(activeFolder?.pinned ? 'library.explorer.unpin' : 'library.explorer.pin')} variant="tonal" onPress={() => void (async () => {
          if (!activeFolder) {return;}
          const result = await client.libraryCommand({action: 'pin', id: activeFolder.id,
            pinned: !activeFolder.pinned, revision: libraryState.revision,
            commandId: `00000000-0000-4000-8000-${Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0')}`});
          if (result.ok) {await refreshFolders(); setSheet(null);}
          else {setNotice(t('library.explorer.pinFailed'));}
        })()} />
        <Button label={t('library.explorer.moveFolder')} variant="tonal" onPress={() => {
          if (!activeFolder) {return;}
          enterSelection(); setSelectedFolders(new Set([activeFolder.id])); setDestination(null);
          setDestinationChosen(false); setDestinationSearch(''); setNotice(null); setSheet('move');
        }} />
        <Button label={t('library.explorer.removeFolder')} variant="destructive" onPress={() => {
          if (!activeFolder) {return;}
          enterSelection(); setSelectedFolders(new Set([activeFolder.id])); setSheet(null); setDeletePrompt(true);
        }} />
      </Sheet>
      <Sheet visible={sheet === 'create' || sheet === 'rename'}
        title={t(sheet === 'rename' ? 'library.explorer.rename' : 'library.explorer.newFolder')}
        closeLabel={t('library.explorer.close')} onDismiss={() => setSheet(null)}>
        <TextField label={t('library.explorer.folderName')} value={newFolderName} onChangeText={setNewFolderName} />
        <Button label={t(sheet === 'rename' ? 'library.explorer.save' : 'library.explorer.create')}
          disabled={!newFolderName.trim() || busy} onPress={() => void createFolder()} />
        {notice && <Text variant="bodyMedium" tone="error">{notice}</Text>}
      </Sheet>
      <Sheet visible={sheet === 'move'} title={t('library.explorer.moveTo')}
        scrollable={false}
        closeLabel={t('library.explorer.close')} onDismiss={() => setSheet(null)}>
        <TextField label={t('library.explorer.searchFolders')} value={destinationSearch} onChangeText={setDestinationSearch} />
        <Text variant="bodyMedium" tone="variant">{t('library.explorer.moveHint')}</Text>
        {notice && <Text variant="bodyMedium" tone="error">{notice}</Text>}
        <Button label={t(selectedFolders.size ? 'library.title' : 'library.explorer.unsorted')}
          variant={destinationChosen && destination === null ? 'tonal' : 'text'}
          onPress={() => {setDestination(null); setDestinationChosen(true);}} />
        <View style={styles.destinationList}><VirtualizedList
          data={folderDestinations(libraryState.folders, selectedFolders, destinationSearch)}
          keyExtractor={folder => folder.id} showSeparators={false}
          ListEmptyComponent={<Text variant="bodyMedium" tone="variant">{t('library.explorer.noFoldersFound')}</Text>}
          renderItem={({item: folder}) => <Button label={folder.path}
            variant={destinationChosen && destination === folder.id ? 'tonal' : 'text'}
            disabled={folder.disabled || busy}
            onPress={() => {setDestination(folder.id); setDestinationChosen(true);}} />} />
        </View>
        <Button label={t('library.explorer.moveHere')} disabled={busy || !destinationChosen} onPress={() => void runMove()} />
      </Sheet>
      <Dialog visible={deletePrompt} title={t('library.explorer.deleteTitle')}
        body={t('library.explorer.deleteBody')}
        impact={t('library.explorer.deleteImpact', {folders: selectedFolders.size, media: selectedIds.size})} destructive
        cancel={{label: t('action.cancel'), onPress: () => setDeletePrompt(false)}}
        confirm={{label: t('library.selection.delete'), onPress: () => void runDelete()}} />

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
  flexFill: {flex: 1},
  destinationList: {flex: 1, minHeight: 48},
  gridPane: {flex: 5},
  detailPane: {flex: 4},
  cardWrapper: {flex: 1},
  folderRow: {paddingVertical: 6},
});
