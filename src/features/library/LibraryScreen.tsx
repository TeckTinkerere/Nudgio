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
import {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {LibraryGridBody} from './LibraryGridBody';
import {MediaDetailContent} from './MediaDetailContent';
import {MediaPreviewPlayer} from './MediaPreviewPlayer';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
  Chip,
  Dialog,
  EmptyState,
  MediaCard,
  Screen,
  Stack,
  Text,
  TextField,
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
import {mockCategories} from '../../mocks/fixtures';
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
  const {mediaGridColumns, navigation: navTreatment} = useResponsive();
  const importMedia = useImportMedia();
  const isTwoPane = navTreatment === 'rail';

  const [search, setSearch] = useState('');
  const [activeKind, setActiveKind] = useState<KindFilter | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<UUID | null>(null);
  const [sort, setSort] = useState<NonNullable<MediaQuery['sort']>>('recent');
  const [previewItem, setPreviewItem] = useState<MediaSummary | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<UUID | null>(null);

  const query = useMemo<MediaQuery>(
    () => ({
      search: search.length > 0 ? search : undefined,
      kinds: activeKind && activeKind !== 'missing' ? [activeKind] : undefined,
      onlyMissing: activeKind === 'missing' ? true : undefined,
      categoryId: activeCategoryId ?? undefined,
      sort,
      offset: 0,
      limit: 100,
    }),
    [search, activeKind, activeCategoryId, sort],
  );

  const media = useMediaList(query);

  /**
   * An empty result set has two causes and the user can only act on one of
   * them. Sort is excluded deliberately: it reorders, it never excludes, so
   * it is not something "Clear filters" should reset.
   */
  const isFiltered = search.length > 0 || activeKind !== null || activeCategoryId !== null;

  const clearFilters = useCallback(() => {
    setSearch('');
    setActiveKind(null);
    setActiveCategoryId(null);
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

  const renderItem = useCallback(
    ({item}: {item: MediaSummary}) => (
      <View style={styles.gridCell}>
        <MediaCard
          title={item.title}
          kind={item.kind}
          kindLabel={t(KIND_LABEL_KEY[item.kind])}
          thumbnailUri={thumbnailImageSource(item.thumbnailToken)?.uri}
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
          onPress={() => openItem(item)}
          onPlayPress={isPlayableKind(item.kind) ? () => setPreviewItem(item) : undefined}
          playLabel={t('library.player.play', {title: item.title})}
        />
      </View>
    ),
    [openItem, t],
  );

  const gridPane = (
    <>
      {/* No `hasAppBar` below: that prop means "an AppBar already consumed
      the top inset", and this screen deliberately has no AppBar — its title
      is an inline large heading that scrolls with the content, the same
      pattern TodayScreen uses. Passing it set `paddingTop: 0`, so nothing
      consumed `insets.top` and the heading drew underneath the status bar
      and camera cutout (confirmed on a 720x1600 device: the title
      overlapped the clock). */}
      <Stack gap="xs" paddingHorizontal="md" paddingVertical="sm">
        <Text variant="headlineMedium" isHeading>
          {t('library.title')}
        </Text>

        <TextField
          label={t('library.search.placeholder')}
          value={search}
          onChangeText={setSearch}
          testID={testIds.library.searchField}
        />

        <Stack direction="row" gap="xxs" wrap>
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
        </Stack>

        {mockCategories.length > 0 ? (
          <Stack direction="row" gap="xxs" wrap>
            {mockCategories.map(category => (
              <Chip
                key={category.id}
                label={category.name}
                selected={activeCategoryId === category.id}
                onPress={() =>
                  setActiveCategoryId(current => (current === category.id ? null : category.id))
                }
              />
            ))}
          </Stack>
        ) : null}

        <Stack direction="row" gap="xxs" wrap>
          {SORTS.map(option => (
            <Chip
              key={option.value}
              label={t(option.labelKey)}
              selected={sort === option.value}
              onPress={() => setSort(option.value)}
            />
          ))}
        </Stack>
      </Stack>

      <LibraryGridBody
        media={media}
        importMedia={importMedia}
        mediaGridColumns={mediaGridColumns}
        renderItem={renderItem}
        isFiltered={isFiltered}
        onClearFilters={clearFilters}
      />
    </>
  );

  return (
    <Screen edgeToEdge testID={testIds.library.screen}>
      {isTwoPane ? (
        <Stack direction="row" gap="sm" flex={1}>
          <View style={styles.gridPane}>{gridPane}</View>
          <View style={styles.detailPane}>
            {selectedMediaId ? (
              <MediaDetailContent mediaId={selectedMediaId} />
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
  gridCell: {flex: 1, padding: 4},
  gridPane: {flex: 5},
  detailPane: {flex: 4},
});
