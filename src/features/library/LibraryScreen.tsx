/* eslint-disable no-void -- UI event handlers intentionally launch async actions. */
/**
 * Library: the user's own media, organized in albums (DL-081).
 *
 * Root shows two views behind a segmented control — **Albums**, a shelf of
 * cover tiles (Unsorted first, pinned albums next, a "New album" tile last),
 * and **All media**, the full grid. Opening an album shows its sub-albums as
 * a row of smaller covers above its media, with the album's name in the app
 * bar and ⋮ for its options; Android back walks up the same path.
 *
 * Storage is unchanged (`library_folders`, one home per item, one nested
 * level, revision-checked native commands); `useLibraryAlbums` owns that
 * protocol, `AlbumTile`/`AlbumPickerSheet` the presentation.
 *
 * At medium/expanded width (`useResponsive().navigation === 'rail'`) the
 * media grid keeps its two-pane layout with a persistent detail pane
 * (`specs/Markdown/04_Visual_Design_System.md` "Medium: ... two-pane
 * Library detail").
 */
import {useIsFocused, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useInfiniteQuery} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {AlbumPickerSheet} from './AlbumPickerSheet';
import {AlbumTile} from './AlbumTile';
import {subAlbumsOf, topLevelAlbums, type Album} from './libraryAlbums';
import {LibraryGridBody} from './LibraryGridBody';
import {MediaDetailContent} from './MediaDetailContent';
import {useAlbumDetail} from './useAlbumDetail';
import {useLibraryAlbums} from './useLibraryAlbums';
import {useLibrarySelection} from './useLibrarySelection';
import {useAppContainer} from '../../app/di';
import type {RootStackParamList} from '../../app/navigation/types';
import {useToast} from '../../app/toast/ToastProvider';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {queryKeys, unwrapResult} from '../../core/state';
import {
  AppBar,
  Button,
  Chip,
  ChipRow,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  LoadingState,
  MediaTile,
  ProgressBar,
  Screen,
  Sheet,
  Stack,
  Text,
  TextField,
  useFloatingAppBar,
  useResponsive,
  useTheme,
} from '../../design-system';
import {
  importErrorCopy,
  importPhaseLabelKey,
  importProgressFraction,
  STORAGE_INSUFFICIENT_MIN_MB,
  useImportMedia,
} from '../../hooks';
import {formatEnglishUnit, useTranslation, type TranslationKey} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaKind, MediaQuery, MediaSummary, UUID} from '../../native-client/types';
import {formatDurationAccessible, formatDurationCompact} from '../../utils';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type KindFilter = MediaKind | 'missing';
/** An album id, `UNSORTED`, or `null` for the Library root. */
type OpenPlace = string | null;
type NameSheet = {readonly mode: 'create'; readonly parentId: string | null} | {readonly mode: 'rename'; readonly id: string};

const UNSORTED = 'unsorted';
/** Scroll/search/filter memory key for the Library root. */
const ROOT = 'root';
/**
 * Album tiles are a strip above the media, not a second grid competing with
 * it. At 132 dp — the size they were when the root had a whole album screen
 * of its own — three of them plus their labels ate the top 420 px of the
 * Library, which is the problem the restructure was meant to fix.
 */
const ALBUM_TILE_WIDTH = 96;
const GALLERY_GAP = 3;
/** Items in view before the kind-filter row earns its space. */
const FILTERS_FROM = 12;

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

export function LibraryScreen() {
  const t = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const isFocused = useIsFocused();
  const {mediaGridColumns, navigation: navTreatment} = useResponsive();
  const appBar = useFloatingAppBar();
  const importMedia = useImportMedia();
  const {repositories} = useAppContainer();
  const {showToast} = useToast();
  const detailFor = useAlbumDetail();
  const isTwoPane = navTreatment === 'rail';
  // Gallery density: one more column than the card grid, like a phone's
  // photo app (3 on a phone, 4-5 on wider screens).
  const galleryColumns = mediaGridColumns + 1;

  const {library, status, refresh, run} = useLibraryAlbums();
  const [openPlace, setOpenPlace] = useState<OpenPlace>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<KindFilter | null>(null);
  const [sort, setSort] = useState<NonNullable<MediaQuery['sort']>>('recent');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<UUID | null>(null);
  const [selectedAlbums, setSelectedAlbums] = useState<ReadonlySet<string>>(new Set());
  const [sheet, setSheet] = useState<'add' | 'name' | 'options' | 'move' | null>(null);
  const [nameSheet, setNameSheet] = useState<NameSheet | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [optionsAlbumId, setOptionsAlbumId] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [lastMove, setLastMove] = useState<{readonly count: number; readonly place: string} | null>(null);
  const [busy, setBusy] = useState(false);

  const {selectionMode, selectedIds, enterSelection, exitSelection, toggleSelected, handleBulkAction} =
    useLibrarySelection();

  // --- Where we are ------------------------------------------------------------
  const albumsById = useMemo(() => new Map(library.albums.map(album => [album.id as string, album])), [library.albums]);
  const openAlbum: Album | undefined = openPlace && openPlace !== UNSORTED ? albumsById.get(openPlace) : undefined;
  const parentAlbum = openAlbum?.parentId ? albumsById.get(openAlbum.parentId) : undefined;
  const optionsAlbum = optionsAlbumId ? albumsById.get(optionsAlbumId) : undefined;
  const locationKey = openPlace ?? ROOT;

  // Each place remembers its own scroll position, search and filter.
  const locations = useRef(new Map<string, {search: string; kind: KindFilter | null; offset: number}>());
  const currentOffset = useRef(0);
  const [restoredOffset, setRestoredOffset] = useState(0);

  const leaveSelection = useCallback(() => {
    exitSelection();
    setSelectedAlbums(new Set());
  }, [exitSelection]);

  const goTo = useCallback(
    (place: OpenPlace) => {
      locations.current.set(locationKey, {search, kind: activeKind, offset: currentOffset.current});
      const saved = locations.current.get(place ?? ROOT);
      currentOffset.current = saved?.offset ?? 0;
      setRestoredOffset(currentOffset.current);
      setOpenPlace(place);
      setSearch(saved?.search ?? '');
      setSearchOpen(Boolean(saved?.search));
      setActiveKind(saved?.kind ?? null);
      setLastMove(null);
      leaveSelection();
    },
    [activeKind, leaveSelection, locationKey, search],
  );

  const goUp = useCallback(() => goTo(openAlbum?.parentId ?? null), [goTo, openAlbum?.parentId]);

  const onListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    currentOffset.current = event.nativeEvent.contentOffset.y;
    appBar.onScroll(event);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) {
        return false;
      }
      if (selectionMode) {
        leaveSelection();
        return true;
      }
      if (searchOpen) {
        setSearch('');
        setSearchOpen(false);
        return true;
      }
      if (openPlace) {
        goUp();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [goUp, leaveSelection, navigation, openPlace, searchOpen, selectionMode]);

  // --- Media ---------------------------------------------------------------------
  const query = useMemo<MediaQuery>(
    () => ({
      search: search.length > 0 ? search : undefined,
      location: openPlace === UNSORTED ? 'unsorted' : openPlace ? 'folder' : 'all',
      folderId: openPlace && openPlace !== UNSORTED ? (openPlace as UUID) : undefined,
      kinds: activeKind && activeKind !== 'missing' ? [activeKind] : undefined,
      onlyMissing: activeKind === 'missing' ? true : undefined,
      sort,
      offset: 0,
      limit: 50,
    }),
    [search, activeKind, sort, openPlace],
  );

  const mediaQuery = useInfiniteQuery({
    queryKey: [...queryKeys.media.all(), 'explorer', query, library.revision],
    initialPageParam: 0,
    gcTime: 5 * 60 * 1000,
    queryFn: ({pageParam}) => unwrapResult(() => repositories.media.list({...query, offset: pageParam})),
    getNextPageParam: last => (last.hasMore ? last.offset + last.items.length : undefined),
  });
  const refetchMedia = mediaQuery.refetch;
  useEffect(() => {
    if (!isFocused) {
      return;
    }
    void refresh();
    void refetchMedia();
  }, [isFocused, refetchMedia, refresh]);

  const visibleMedia = useMemo(() => mediaQuery.data?.pages.flatMap(page => page.items) ?? [], [mediaQuery.data]);
  const media = {
    ...mediaQuery,
    data: mediaQuery.data
      ? {items: visibleMedia, total: mediaQuery.data.pages[0]?.total ?? 0, offset: 0, hasMore: Boolean(mediaQuery.hasNextPage)}
      : undefined,
  } as unknown as Parameters<typeof LibraryGridBody>[0]['media'];

  const isFiltered = search.length > 0 || activeKind !== null;
  /** An empty album/place with nothing filtered: the chips would filter nothing. */
  const emptyPlace = !isFiltered && mediaQuery.data !== undefined && visibleMedia.length === 0;
  /**
   * Kind filters cost a whole row and only help once there is enough media
   * that scanning is work. Below that they are chrome above five tiles —
   * and they stay visible whenever one is actually applied, so a filter can
   * always be cleared.
   */
  const showFilters = !emptyPlace && (isFiltered || visibleMedia.length >= FILTERS_FROM);
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
    (item: MediaSummary) => {
      const duration = item.durationMs ? formatDurationCompact(item.durationMs) : undefined;
      const spoken = [
        t(KIND_LABEL_KEY[item.kind]),
        item.title,
        item.durationMs ? formatDurationAccessible(item.durationMs, formatEnglishUnit) : null,
        item.activeReminderCount > 0
          ? `${item.activeReminderCount} active reminder${item.activeReminderCount === 1 ? '' : 's'}`
          : null,
        item.integrity === 'missing' ? t('library.integrity.missing') : null,
      ].filter(Boolean).join('. ');
      return (
        <MediaTile
          title={item.title}
          kind={item.kind}
          thumbnailUri={thumbnailImageSource(item.thumbnailToken)?.uri}
          durationLabel={duration}
          activeReminderCount={item.activeReminderCount}
          isMissing={item.integrity === 'missing'}
          selectionMode={selectionMode}
          selected={selectedIds.has(item.id)}
          onPress={() => (selectionMode ? toggleSelected(item.id) : openItem(item))}
          onLongPress={() => {
            if (!selectionMode) {
              enterSelection();
            }
            toggleSelected(item.id);
          }}
          accessibilityLabel={spoken}
        />
      );
    },
    [enterSelection, openItem, selectedIds, selectionMode, t, toggleSelected],
  );

  // --- Album commands --------------------------------------------------------------
  const toggleAlbum = (id: string) =>
    setSelectedAlbums(current => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const selectAlbumByLongPress = (id: string) => {
    if (!selectionMode) {
      enterSelection();
    }
    toggleAlbum(id);
  };

  const startNaming = (next: NameSheet) => {
    setNameSheet(next);
    setNameDraft(next.mode === 'rename' ? albumsById.get(next.id)?.name ?? '' : '');
    setSheetError(null);
    setSheet('name');
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name || busy || !nameSheet) {
      return;
    }
    setBusy(true);
    try {
      const result = await run(
        nameSheet.mode === 'rename'
          ? {action: 'rename', id: nameSheet.id, name}
          : {action: 'create', name, parentId: nameSheet.parentId},
      );
      if (!result) {
        setSheetError(t('library.explorer.folderSaveFailed'));
        return;
      }
      setSheet(null);
      setNameSheet(null);
      if (nameSheet.mode === 'create') {
        showToast({message: t('library.albums.created', {name}), tone: 'success'});
      }
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (album: Album) => {
    setSheet(null);
    if (!(await run({action: 'pin', id: album.id, pinned: !album.pinned}))) {
      showToast({message: t('library.explorer.pinFailed'), tone: 'error'});
    }
  };

  const openMove = () => {
    setSheetError(null);
    setSheet('move');
  };

  const runMove = async (destination: string | null) => {
    if (busy) {
      return;
    }
    if (selectedAlbums.size > 0 && selectedIds.size > 0) {
      setSheetError(t('library.explorer.moveSeparate'));
      return;
    }
    setBusy(true);
    try {
      for (const id of selectedAlbums) {
        if (!(await run({action: 'reparent', id, parentId: destination}))) {
          setSheetError(t('library.explorer.moveFolderFailed'));
          return;
        }
      }
      const chosen = visibleMedia.filter(item => selectedIds.has(item.id));
      if (chosen.length !== selectedIds.size) {
        setSheetError(t('library.explorer.moveMediaChanged'));
        return;
      }
      if (chosen.length > 0) {
        // Native checks each item's version, so read the current one.
        const details = await Promise.all(chosen.map(item => unwrapResult(() => repositories.media.get(item.id))));
        const moved = await run({
          action: 'move',
          destination,
          items: details.map(item => ({id: item.id, version: item.entityVersion})),
        });
        if (!moved) {
          setSheetError(t('library.explorer.moveMediaFailed'));
          return;
        }
        setLastMove({
          count: chosen.length,
          place: destination ? albumsById.get(destination)?.name ?? '' : t('library.explorer.unsorted'),
        });
      }
      setSheet(null);
      leaveSelection();
      await mediaQuery.refetch();
    } catch {
      setSheetError(t('library.explorer.moveFailed'));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const undoMove = async () => {
    setBusy(true);
    try {
      if (!(await run({action: 'undo'}))) {
        showToast({message: t('library.explorer.undoUnavailable'), tone: 'error'});
      }
      setLastMove(null);
      await mediaQuery.refetch();
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      for (const id of selectedAlbums) {
        if (!(await run({action: 'delete', id}))) {
          showToast({message: t('library.explorer.folderRemoveFailed'), tone: 'error'});
          return;
        }
      }
      const leavingOpenAlbum = openPlace !== null && selectedAlbums.has(openPlace);
      if (selectedIds.size > 0) {
        await handleBulkAction('delete');
      }
      setDeletePrompt(false);
      leaveSelection();
      if (leavingOpenAlbum) {
        goTo(parentAlbum?.id ?? null);
      }
      await refresh();
      await mediaQuery.refetch();
    } finally {
      setBusy(false);
    }
  };

  /** Imports one file and, inside an album, files it there straight away. */
  const importHere = async (mimeTypes: readonly string[]) => {
    setSheet(null);
    try {
      const outcome = await importMedia.importMediaAsync(mimeTypes);
      if (outcome.status !== 'imported' || !outcome.media) {
        return;
      }
      if (openAlbum) {
        const moved = await run({
          action: 'move',
          destination: openAlbum.id,
          items: [{id: outcome.media.id, version: outcome.media.entityVersion}],
        });
        if (!moved) {
          showToast({message: t('library.explorer.importedUnsorted'), tone: 'error'});
        }
      }
      await refresh();
      await mediaQuery.refetch();
    } catch {
      // `importMedia.error` drives the dialog below.
    }
  };

  // --- Pieces ------------------------------------------------------------------------
  const canCreateHere = openPlace === null || (openAlbum !== undefined && openAlbum.parentId === null);
  const selectedCount = selectedIds.size + selectedAlbums.size;
  const subAlbums = openAlbum && !openAlbum.parentId ? subAlbumsOf(library.albums, openAlbum.id) : [];
  const needle = search.trim().toLocaleLowerCase();
  const searchingAlbums = openPlace === null && needle.length > 0
    ? library.albums.filter(album => album.name.toLocaleLowerCase().includes(needle))
    : [];

  /**
   * The album row that heads every grid, root included.
   *
   * The root used to be a *separate* full-screen album grid behind an
   * "Albums / All media" segmented control, which made the Library open on
   * a question nobody asked — "what folders do I have?" — rather than the
   * one it exists to answer, "what have I saved to remind myself with".
   * With a handful of clips the opening screen was an Unsorted pseudo-album,
   * one real album and a dashed New-album placeholder: two thirds of it not
   * content. Now there is one view everywhere — media, with its albums as a
   * shelf above — so the mode switch, the second scroll position and the
   * separate empty state all go away.
   *
   * `leadUnsorted` shows "Unsorted" first, and only where it means
   * something: at the root, once at least one album exists. Before anything
   * is filed, "unsorted" is just a second word for the grid underneath.
   */
  const albumRow = (albums: readonly Album[], allowNew: boolean, leadUnsorted = false) =>
    albums.length > 0 || allowNew || leadUnsorted ? (
      <Stack gap="xs">
        <Text variant="labelLarge" tone="variant" isHeading>{t('library.albums.tab').toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
          {leadUnsorted ? (
            <AlbumTile
              width={ALBUM_TILE_WIDTH}
              name={t('library.explorer.unsorted')}
              detail={detailFor(library.unsorted)}
              covers={library.unsortedCovers}
              onPress={() => goTo(UNSORTED)}
              accessibilityLabel={`${t('library.explorer.unsorted')}, ${detailFor(library.unsorted)}`}
              testID="album-unsorted"
            />
          ) : null}
          {albums.map(album => (
            <AlbumTile
              key={album.id}
              width={ALBUM_TILE_WIDTH}
              name={album.name}
              detail={detailFor(album.count)}
              covers={album.covers}
              pinned={album.pinned}
              selectionMode={selectionMode}
              selected={selectedAlbums.has(album.id)}
              onPress={() => (selectionMode ? toggleAlbum(album.id) : goTo(album.id))}
              onLongPress={() => selectAlbumByLongPress(album.id)}
              accessibilityLabel={`${album.name}, ${detailFor(album.count)}`}
            />
          ))}
          {allowNew && !selectionMode ? (
            <AlbumTile
              kind="new"
              width={ALBUM_TILE_WIDTH}
              name={t('library.albums.new')}
              onPress={() => startNaming({mode: 'create', parentId: openAlbum?.id ?? null})}
              accessibilityLabel={t('library.albums.newInside', {name: openAlbum?.name ?? ''})}
            />
          ) : null}
        </ScrollView>
      </Stack>
    ) : null;

  const controls = (
    <Stack gap="xs" paddingHorizontal="md" paddingVertical="xs">
      {searchOpen ? (
        <Stack direction="row" align="center" gap="xxs">
          <View style={styles.flex}>
            <TextField
              label={openAlbum || openPlace === UNSORTED
                ? t('library.explorer.searchPlace', {name: openAlbum?.name ?? t('library.explorer.unsorted')})
                : t('library.explorer.searchLibrary')}
              placeholder={t('library.albums.searchPlaceholder')}
              value={search}
              onChangeText={value => {
                setSearch(value);
                if (selectionMode) {
                  leaveSelection();
                }
              }}
              returnKeyType="search"
              testID={testIds.library.searchField}
            />
          </View>
          <IconButton name="close" label={t('library.albums.closeSearch')}
            onPress={() => {
              setSearch('');
              setSearchOpen(false);
            }} />
        </Stack>
      ) : null}
      {importMedia.isImporting ? (
        <ProgressBar
          progress={importProgressFraction(importMedia.progress)}
          label={t(importPhaseLabelKey(importMedia.progress?.phase) ?? 'library.import.copying')}
        />
      ) : null}
      {lastMove ? (
        <Stack direction="row" align="center" gap="xs"
          style={[styles.snack, {backgroundColor: theme.color.inverseSurface, borderRadius: theme.radius.field, paddingStart: theme.spacing.md}]}>
          <Text variant="bodyMedium" tone="inverse" style={styles.flex}>
            {t(lastMove.count === 1 ? 'library.albums.movedOne' : 'library.albums.moved', {count: lastMove.count, name: lastMove.place})}
          </Text>
          <Button label={t('library.albums.undo')} variant="text" disabled={busy} onPress={() => void undoMove()} />
        </Stack>
      ) : null}
      {showFilters ? (
        <ChipRow>
          {KIND_FILTERS.map(filter => (
            <Chip
              key={filter.value}
              label={t(filter.labelKey)}
              selected={activeKind === filter.value}
              onPress={() => setActiveKind(current => (current === filter.value ? null : filter.value))}
            />
          ))}
          <Chip
            label={t(filtersExpanded ? 'library.filters.fewer' : 'library.filters.more')}
            selected={filtersExpanded || sort !== 'recent'}
            icon={filtersExpanded ? 'chevronUp' : 'chevronDown'}
            onPress={() => setFiltersExpanded(current => !current)}
          />
        </ChipRow>
      ) : null}
      {filtersExpanded && showFilters ? (
        <ChipRow>
          {SORTS.map(option => (
            <Chip key={option.value} label={t(option.labelKey)} selected={sort === option.value} onPress={() => setSort(option.value)} />
          ))}
        </ChipRow>
      ) : null}
      {status === 'failed' ? (
        <Button variant="tonal" label={t('library.explorer.retryFolders')} onPress={() => void refresh()} />
      ) : null}
    </Stack>
  );

  const libraryIsEmpty = status === 'ready' && library.total === 0 && library.albums.length === 0;
  // Sub-albums appear only when there are some: an empty "Albums" row with a
  // big New-album tile pushed every album's photos down for nothing ("New
  // album in …" stays one tap away in ⋮ and Add).
  const gridHeader =
    openPlace === null
      ? albumRow(
          topLevelAlbums(library.albums),
          library.albums.length > 0 && !selectionMode,
          library.unsorted > 0 && library.albums.length > 0 && !selectionMode,
        )
      : openAlbum && !openAlbum.parentId && subAlbums.length > 0
        ? albumRow(subAlbums, true)
        : searchingAlbums.length > 0
          ? albumRow(searchingAlbums, false)
          : null;

  const body = status === 'loading' ? (
    <LoadingState label={t('loading.startingUp')} />
  ) : libraryIsEmpty && !importMedia.isImporting ? (
    <EmptyState
      icon="library"
      title={t('library.albums.emptyTitle')}
      body={t('library.albums.emptyBody')}
      action={{label: t('library.albums.import'), onPress: () => setSheet('add')}}
    />
    ) : (
    <LibraryGridBody
      media={media}
      locationKey={locationKey}
      restoredOffset={restoredOffset}
      importMedia={importMedia}
      mediaGridColumns={galleryColumns}
      renderCard={renderCard}
      gap={GALLERY_GAP}
      fillLastRow={false}
      isFiltered={isFiltered}
      onClearFilters={clearFilters}
      onScroll={onListScroll}
      onLoadMore={() => void mediaQuery.fetchNextPage()}
      loadingMore={mediaQuery.isFetchingNextPage}
      onImport={() => setSheet('add')}
      emptyTitle={openAlbum ? t('library.albums.emptyAlbumTitle', {name: openAlbum.name}) : undefined}
      emptyBody={openAlbum ? t('library.albums.emptyAlbumBody') : undefined}
      header={gridHeader ?? undefined}
    />
  );

  const title = selectionMode
    ? t('library.explorer.selected', {count: selectedCount})
    : openAlbum?.name ?? (openPlace === UNSORTED ? t('library.explorer.unsorted') : t('library.title'));
  const subtitle = !selectionMode && openAlbum
    ? [parentAlbum?.name, detailFor(openAlbum.count, openAlbum.subAlbumCount)].filter(Boolean).join(' · ')
    : !selectionMode && openPlace === UNSORTED ? detailFor(library.unsorted) : undefined;

  const appBarActions = selectionMode
    ? []
    : [
        {icon: 'search' as const, label: t('library.albums.search'), onPress: () => setSearchOpen(true)},
        ...(openAlbum
          ? [{
              icon: 'more' as const,
              label: t('library.albums.options', {name: openAlbum.name}),
              onPress: () => {
                setOptionsAlbumId(openAlbum.id);
                setSheet('options');
              },
            }]
          : []),
        {icon: 'add' as const, label: t('library.explorer.add'), onPress: () => setSheet('add')},
      ];

  return (
    <Screen
      edgeToEdge
      hasAppBar
      testID={testIds.library.screen}
      appBarSlot={
        <AppBar
          title={title}
          subtitle={subtitle}
          back={
            selectionMode
              ? {label: t('library.albums.exitSelection'), onPress: leaveSelection}
              : openPlace
                ? {label: t('action.back'), onPress: goUp}
                : undefined
          }
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
          actions={appBarActions}
          trailing={
            // Inside an album the bar is already full (back, title, search,
            // ⋮, add); "Select" lives in ⋮ there, and long-press works anywhere.
            selectionMode || openAlbum ? null : (
              <Button variant="text" label={t('library.selection.select')} onPress={enterSelection}
                testID={testIds.library.selectButton} />
            )
          }
        />
      }>
      <View style={{paddingTop: appBar.barHeight}} />
      {controls}
      {isTwoPane ? (
        <Stack direction="row" gap="sm" flex={1}>
          <View style={styles.gridPane}>{body}</View>
          <View style={styles.detailPane}>
            {selectedMediaId ? (
              <MediaDetailContent mediaId={selectedMediaId} onDeleted={() => setSelectedMediaId(null)} />
            ) : (
              <EmptyState icon="library" title={t('library.detail.emptySelectionTitle')} body={t('library.detail.emptySelectionBody')} />
            )}
          </View>
        </Stack>
      ) : (
        <View style={styles.flex}>{body}</View>
      )}

      {selectionMode ? (
        <Stack direction="row" gap="xs" paddingHorizontal="md" paddingVertical="sm" align="center" wrap
          style={{backgroundColor: theme.color.surfaceContainer, borderTopWidth: theme.layout.borderWidth, borderTopColor: theme.color.outlineVariant}}>
          <Button label={t('library.explorer.move')} variant="tonal" icon="folder" disabled={selectedCount === 0 || busy}
            onPress={openMove} style={styles.grow} />
          {selectedAlbums.size === 0 ? (
            <Button label={t('library.albums.export')} variant="tonal" icon="share" disabled={selectedIds.size === 0 || busy}
              onPress={() => void handleBulkAction('export')} style={styles.grow} />
          ) : null}
          <Button label={t('library.selection.delete')} variant="destructive" icon="delete" disabled={selectedCount === 0 || busy}
            onPress={() => setDeletePrompt(true)} style={styles.grow} />
        </Stack>
      ) : null}

      <Sheet visible={sheet === 'add'} title={t('library.explorer.add')} closeLabel={t('library.explorer.close')}
        onDismiss={() => setSheet(null)}>
        <ListRow
          title={t('library.albums.importPhotoVideo')}
          subtitle={openAlbum ? t('library.albums.importInto', {name: openAlbum.name}) : t('library.albums.importSubtitle')}
          leading={<Icon name="image" />}
          onPress={() => void importHere(['image/*', 'video/*'])}
        />
        <ListRow
          title={t('library.albums.importAudio')}
          subtitle={t('library.albums.importAudioSubtitle')}
          leading={<Icon name="audio" />}
          onPress={() => void importHere(['audio/*'])}
        />
        <ListRow
          title={openAlbum ? t('library.albums.newInside', {name: openAlbum.name}) : t('library.albums.new')}
          subtitle={canCreateHere ? t('library.albums.newSubtitle') : t('library.albums.newUnavailable')}
          leading={<Icon name="album" />}
          disabled={!canCreateHere}
          onPress={() => startNaming({mode: 'create', parentId: openAlbum?.id ?? null})}
        />
      </Sheet>

      <Sheet visible={sheet === 'options' && optionsAlbum !== undefined} title={optionsAlbum?.name ?? ''}
        closeLabel={t('library.explorer.close')} onDismiss={() => setSheet(null)}>
        {optionsAlbum ? (
          <>
            {optionsAlbum.id === openAlbum?.id ? (
              <ListRow title={t('library.albums.selectItems')} leading={<Icon name="check" />}
                onPress={() => {
                  setSheet(null);
                  enterSelection();
                }} />
            ) : null}
            <ListRow title={t('library.explorer.rename')} leading={<Icon name="edit" />}
              onPress={() => startNaming({mode: 'rename', id: optionsAlbum.id})} />
            <ListRow title={t(optionsAlbum.pinned ? 'library.explorer.unpin' : 'library.albums.pin')} leading={<Icon name="pin" />}
              onPress={() => void togglePin(optionsAlbum)} />
            {optionsAlbum.parentId === null ? (
              <ListRow title={t('library.albums.newInside', {name: optionsAlbum.name})} leading={<Icon name="add" />}
                onPress={() => startNaming({mode: 'create', parentId: optionsAlbum.id})} />
            ) : null}
            <ListRow title={t('library.albums.moveAlbum')} leading={<Icon name="folder" />}
              onPress={() => {
                enterSelection();
                setSelectedAlbums(new Set([optionsAlbum.id]));
                openMove();
              }} />
            <ListRow title={t('library.albums.delete')} leading={<Icon name="delete" color={theme.color.error} />}
              onPress={() => {
                setSheet(null);
                enterSelection();
                setSelectedAlbums(new Set([optionsAlbum.id]));
                setDeletePrompt(true);
              }} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'name'}
        title={nameSheet?.mode === 'rename' ? t('library.explorer.rename')
          : nameSheet?.parentId ? t('library.albums.newInside', {name: albumsById.get(nameSheet.parentId)?.name ?? ''})
          : t('library.albums.new')}
        closeLabel={t('library.explorer.close')} onDismiss={() => setSheet(null)}>
        <TextField label={t('library.albums.nameLabel')} placeholder={t('library.albums.namePlaceholder')}
          value={nameDraft} onChangeText={setNameDraft} maxLength={80} returnKeyType="done" testID="album-name" />
        {sheetError ? <Text variant="bodyMedium" tone="error">{sheetError}</Text> : null}
        <Button label={t(nameSheet?.mode === 'rename' ? 'library.explorer.save' : 'library.explorer.create')}
          disabled={!nameDraft.trim() || busy} loading={busy} onPress={() => void saveName()} fullWidth />
      </Sheet>

      <AlbumPickerSheet
        visible={sheet === 'move'}
        albums={library.albums}
        movingAlbumIds={selectedAlbums}
        busy={busy}
        error={sheetError}
        onDismiss={() => setSheet(null)}
        onConfirm={destination => void runMove(destination)}
      />

      <Dialog
        visible={deletePrompt}
        title={selectedIds.size === 0 && selectedAlbums.size === 1
          ? t('library.albums.deleteOneTitle', {name: albumsById.get([...selectedAlbums][0] ?? '')?.name ?? ''})
          : t('library.explorer.deleteTitle')}
        body={selectedIds.size === 0 ? t('library.albums.deleteAlbumBody') : t('library.explorer.deleteBody')}
        impact={selectedIds.size > 0 ? t('library.explorer.deleteImpact', {folders: selectedAlbums.size, media: selectedIds.size}) : undefined}
        destructive
        cancel={{label: t('action.cancel'), onPress: () => setDeletePrompt(false)}}
        confirm={{label: t('library.selection.delete'), onPress: () => void runDelete()}}
      />

      {importMedia.error && importMedia.error.field !== 'cancelled' ? (
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  grow: {flexGrow: 1, flexBasis: 88, paddingHorizontal: 12},
  gridPane: {flex: 5},
  detailPane: {flex: 4},
  subRow: {gap: 12, paddingBottom: 8},
  snack: {minHeight: 48},
});
