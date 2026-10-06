/**
 * Full-screen media picker for the reminder editor's media stage: browse
 * what has already been imported, preview it, choose it.
 *
 * Renders the *same* square `MediaTile` gallery as the Library tab, at the
 * same column count and gutter. It used to pass `MediaCard` to the shared
 * `LibraryGridBody` instead — real-aspect-ratio cards in a ragged masonry —
 * which was deliberate back when Library's own grid looked like that too.
 * Library became a square album gallery and this screen did not follow, so
 * the same media appeared in two different visual languages depending on how
 * you arrived, and an audio file (no artwork, nothing to size) was stretched
 * into a thousand-pixel empty box beside whatever tall photo happened to sit
 * next to it. Shared grid, shared card, one language.
 *
 * Tapping a tile opens `MediaSelectionPreviewModal` rather than navigating to
 * Media Detail — this is a view-and-select surface, never an editing one —
 * and confirming there returns to the editor automatically:
 * `navigation.popTo(..., {merge: true})` pops this screen and merges the
 * chosen id into `ReminderEditor`'s existing route params, which the editor
 * picks up via its own prefill effect.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {MediaSelectionPreviewModal} from './MediaSelectionPreviewModal';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
  AppBar,
  Chip,
  ChipRow,
  IconButton,
  MediaTile,
  Screen,
  Stack,
  TextField,
  useFloatingAppBar,
  useResponsive,
} from '../../design-system';
import {useImportMedia, useMediaList} from '../../hooks';
import {formatEnglishUnit, useTranslation, type TranslationKey} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaKind, MediaQuery, MediaSummary} from '../../native-client/types';
import {formatDurationAccessible, formatDurationCompact} from '../../utils';
import {ImportPrompts} from '../library/ImportProgress';
import {LibraryGridBody} from '../library/LibraryGridBody';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectMedia'>;

const KIND_FILTERS: readonly {value: MediaKind; labelKey: TranslationKey}[] = [
  {value: 'video', labelKey: 'library.filter.videos'},
  {value: 'audio', labelKey: 'library.filter.audio'},
  {value: 'image', labelKey: 'library.filter.images'},
  {value: 'text', labelKey: 'library.filter.text'},
];

const KIND_LABEL_KEY: Record<MediaKind, TranslationKey> = {
  video: 'library.kind.video',
  audio: 'library.kind.audio',
  image: 'library.kind.image',
  text: 'library.kind.text',
};

/** Matches `LibraryScreen`'s gallery exactly — same gutter, same column bump. */
const GALLERY_GAP = 3;

export function SelectMediaScreen({navigation, route}: Props) {
  const t = useTranslation();
  const {mediaGridColumns} = useResponsive();
  const importMedia = useImportMedia();
  const selectedMediaId = route.params?.selectedMediaId;

  const [search, setSearch] = useState('');
  // Hidden until asked for, exactly as Library does it: a browse screen's
  // top belongs to the media, not to a field most visits never use.
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<MediaKind | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaSummary | null>(null);
  const appBar = useFloatingAppBar();

  // Same two empty-result causes as Library's own grid (DL-059): browsing
  // here can filter down to nothing just as easily, and the recovery is to
  // clear the filter rather than to import more media.
  const isFiltered = search.length > 0 || activeKind !== null;

  const clearFilters = useCallback(() => {
    setSearch('');
    setActiveKind(null);
  }, []);

  const closeSearch = useCallback(() => {
    setSearch('');
    setSearchOpen(false);
  }, []);

  const query = useMemo<MediaQuery>(
    () => ({
      search: search.length > 0 ? search : undefined,
      kinds: activeKind ? [activeKind] : undefined,
      sort: 'recent',
      offset: 0,
      limit: 100,
    }),
    [search, activeKind],
  );

  const media = useMediaList(query);

  /**
   * `popTo`, not `navigate`. React Navigation 7 changed `navigate` so that it
   * pushes a new screen rather than returning to an existing one — `popTo` is
   * now the API for "go back to that screen and merge these params". With
   * `navigate` this screen stayed on the stack under a *second*, freshly
   * mounted editor: Back from the editor landed on the picker instead of
   * where the user started, that second editor was the one holding the
   * media while the original underneath still showed none, and saving popped
   * into the picker rather than Home.
   */
  const confirmSelection = useCallback(
    (id: MediaSummary['id']) => {
      setPreviewItem(null);
      navigation.popTo(rootRoutes.reminderEditor, {reminderId: undefined, mediaId: id}, {merge: true});
    },
    [navigation],
  );

  const renderCard = useCallback(
    (item: MediaSummary) => {
      const spoken = [
        t(KIND_LABEL_KEY[item.kind]),
        item.title,
        item.durationMs ? formatDurationAccessible(item.durationMs, formatEnglishUnit) : null,
        item.integrity === 'missing' ? t('library.integrity.missing') : null,
      ]
        .filter(Boolean)
        .join('. ');
      return (
        <MediaTile
          title={item.title}
          kind={item.kind}
          thumbnailUri={thumbnailImageSource(item.thumbnailToken)?.uri}
          durationLabel={item.durationMs ? formatDurationCompact(item.durationMs) : undefined}
          isMissing={item.integrity === 'missing'}
          // The already-attached item reads as checked, so returning here to
          // swap media shows which one is currently in use.
          selectionMode={item.id === selectedMediaId}
          selected={item.id === selectedMediaId}
          onPress={() => setPreviewItem(item)}
          accessibilityLabel={spoken}
        />
      );
    },
    [selectedMediaId, t],
  );

  return (
    <Screen
      hasAppBar
      edgeToEdge
      testID={testIds.reminders.selectMediaScreen}
      appBarSlot={
        <AppBar
          title={t('reminders.selectMedia.title')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
          actions={[
            {
              icon: 'search',
              label: t('library.explorer.searchLibrary'),
              onPress: () => (searchOpen ? closeSearch() : setSearchOpen(true)),
            },
          ]}
          floating
          onHeightChange={appBar.onHeightChange}
        />
      }>
      <Stack gap="xs" paddingHorizontal="md" paddingVertical="sm" style={{paddingTop: appBar.barHeight}}>
        {searchOpen ? (
          <Stack direction="row" align="center" gap="xxs">
            <View style={styles.flex}>
              <TextField
                label={t('library.explorer.searchLibrary')}
                placeholder={t('library.albums.searchPlaceholder')}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                testID={testIds.reminders.selectMediaSearchField}
              />
            </View>
            <IconButton name="close" label={t('library.albums.closeSearch')} onPress={closeSearch} />
          </Stack>
        ) : null}
        <ChipRow>
          {KIND_FILTERS.map(filter => (
            <Chip
              key={filter.value}
              label={t(filter.labelKey)}
              selected={activeKind === filter.value}
              onPress={() => setActiveKind(current => (current === filter.value ? null : filter.value))}
            />
          ))}
        </ChipRow>
      </Stack>

      <LibraryGridBody
        media={media}
        importMedia={importMedia}
        mediaGridColumns={mediaGridColumns + 1}
        renderCard={renderCard}
        gap={GALLERY_GAP}
        fillLastRow={false}
        isFiltered={isFiltered}
        onClearFilters={clearFilters}
      />
      <ImportPrompts importMedia={importMedia} />

      <MediaSelectionPreviewModal
        item={previewItem}
        onDismiss={() => setPreviewItem(null)}
        onSelect={confirmSelection}
        closeLabel={t('library.player.close')}
        selectLabel={t('reminders.selectMedia.useThis')}
        loadErrorLabel={t('library.player.loadError')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
});
