/**
 * Dedicated full-screen media picker for the reminder editor's "What"
 * section (spec: "replace the media-selection dropdown with a dedicated
 * Media Library page... browse assets visually through thumbnails and
 * preview or play all supported media types before making a selection").
 *
 * Reuses Library's own thumbnail grid (`LibraryGridBody`/`MediaCard`) so
 * browsing here looks and behaves identically to Library itself — real
 * aspect-ratio-preserving thumbnails, the same loading/empty states, even
 * the same "Import media" empty-state affordance. The only differences from
 * Library proper: tapping a card opens `MediaSelectionPreviewModal` instead
 * of navigating to Media Detail (this is "a view-and-select experience
 * only," never an editing one), and confirming a selection from that
 * preview returns to the reminder editor automatically —
 * `navigation.navigate(..., {merge: true})` pops this screen and merges the
 * chosen id into `ReminderEditor`'s existing route params, which
 * `ReminderEditorForm` picks up via its own `prefillMediaId` effect — rather
 * than leaving the user to back out of a "Select" screen by hand.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useCallback, useMemo, useState} from 'react';

import {MediaSelectionPreviewModal} from './MediaSelectionPreviewModal';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {AppBar, Chip, ChipRow, MediaCard, Screen, Stack, TextField, useResponsive} from '../../design-system';
import {useImportMedia, useMediaList} from '../../hooks';
import {formatEnglishUnit, useTranslation, type TranslationKey} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaKind, MediaQuery, MediaSummary} from '../../native-client/types';
import {formatDurationAccessible, formatDurationCompact} from '../../utils';
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

export function SelectMediaScreen({navigation, route}: Props) {
  const t = useTranslation();
  const {mediaGridColumns} = useResponsive();
  const importMedia = useImportMedia();
  const selectedMediaId = route.params?.selectedMediaId;

  const [search, setSearch] = useState('');
  const [activeKind, setActiveKind] = useState<MediaKind | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaSummary | null>(null);

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

  const confirmSelection = useCallback(
    (id: MediaSummary['id']) => {
      setPreviewItem(null);
      navigation.navigate({
        name: rootRoutes.reminderEditor,
        params: {reminderId: undefined, mediaId: id},
        merge: true,
      });
    },
    [navigation],
  );

  const renderCard = useCallback(
    (item: MediaSummary) => (
      <MediaCard
        title={item.title}
        kind={item.kind}
        kindLabel={t(KIND_LABEL_KEY[item.kind])}
        thumbnailUri={thumbnailImageSource(item.thumbnailToken)?.uri}
        aspectRatio={item.widthPx && item.heightPx ? item.widthPx / item.heightPx : undefined}
        durationLabel={item.durationMs ? formatDurationCompact(item.durationMs) : undefined}
        durationAccessibleLabel={
          item.durationMs ? formatDurationAccessible(item.durationMs, formatEnglishUnit) : undefined
        }
        isMissing={item.integrity === 'missing'}
        missingLabel={t('library.integrity.missing')}
        selected={item.id === selectedMediaId}
        onPress={() => setPreviewItem(item)}
      />
    ),
    [selectedMediaId, t],
  );

  return (
    <Screen hasAppBar edgeToEdge testID={testIds.reminders.selectMediaScreen}>
      <AppBar
        title={t('reminders.selectMedia.title')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <Stack gap="xs" paddingHorizontal="md" paddingVertical="sm">
        <TextField
          label={t('library.search.placeholder')}
          value={search}
          onChangeText={setSearch}
          testID={testIds.reminders.selectMediaSearchField}
        />
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
        mediaGridColumns={mediaGridColumns}
        renderCard={renderCard}
      />

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
