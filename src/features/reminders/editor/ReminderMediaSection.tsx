/**
 * The editor's media stage — the first thing in the form, and the largest.
 *
 * It used to be a `titleLarge` heading, an explanatory paragraph, and three
 * equal chunky buttons, sitting *below* two boxed text fields. That reads as
 * a toolbar attached to a form: the one thing that makes this app not a
 * clock was an attachment row. Now the media is a stage with real area —
 * empty, it is a single large tappable frame offering the three sources;
 * filled, it is the picture itself, with Preview and Change as small pills
 * on the image rather than two full-width buttons stacked underneath.
 *
 * The common case — "this photo from my phone" — stays one tap: "Photo or
 * video" opens the system Photo Picker and "Audio" the document picker, the
 * file is imported and attached here directly. The library is the third
 * option, not the only one.
 *
 * Both pickers allow several files (DL-109). A reminder plays one item, so
 * the first one picked is attached and the rest land in the Library, with a
 * caption under the stage saying so — importing a handful of clips while
 * setting up the first reminder should not mean a trip to the Library first.
 */
import {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {EditorSectionHeading} from './EditorSectionHeading';
import {
  Banner,
  Button,
  Icon,
  LoadingState,
  Stack,
  Text,
  neutral,
  useTheme,
  type IconName,
} from '../../../design-system';
import {withAlpha} from '../../../design-system/theme/colorUtils';
import {importErrorCopy, useImportMedia} from '../../../hooks';
import {useTranslation, type TranslationKey} from '../../../localization';
import type {MediaKind, MediaSummary, UUID} from '../../../native-client/types';
import {formatDurationCompact} from '../../../utils';
import {ImportProgress, ImportPrompts} from '../../library/ImportProgress';
import {MediaHero} from '../MediaHero';
import {MediaSelectionPreviewModal} from '../MediaSelectionPreviewModal';

const KIND_ICON: Record<MediaKind, IconName> = {video: 'video', audio: 'audio', image: 'image', text: 'text'};

/** Tall enough to read as a stage rather than a banner, short enough to leave the form visible. */
const STAGE_HEIGHT = 240;

interface SourceOption {
  readonly key: string;
  readonly icon: IconName;
  readonly labelKey: TranslationKey;
  readonly mimeTypes?: readonly string[];
}

const SOURCES: readonly SourceOption[] = [
  {key: 'visual', icon: 'image', labelKey: 'reminders.editor.source.photoVideo', mimeTypes: ['image/*', 'video/*']},
  {key: 'audio', icon: 'audio', labelKey: 'reminders.editor.source.audio', mimeTypes: ['audio/*']},
  {key: 'library', icon: 'library', labelKey: 'reminders.editor.source.library'},
];

export interface ReminderMediaSectionProps {
  readonly media: MediaSummary | undefined;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly onRetry: () => void;
  readonly onPicked: (id: UUID) => void;
  readonly onChooseFromLibrary: () => void;
  /** Shown after a Save attempt with nothing chosen. */
  readonly error?: string;
  /** DL-110: where playback starts, in ms; null is the beginning. Video/audio only. */
  readonly startMs?: number | null;
  readonly onStartChange?: (startMs: number | null) => void;
}

export function ReminderMediaSection({
  media,
  loading,
  failed,
  onRetry,
  onPicked,
  onChooseFromLibrary,
  error,
  startMs = null,
  onStartChange,
}: ReminderMediaSectionProps) {
  const t = useTranslation();
  const theme = useTheme();
  const importMedia = useImportMedia();
  const [previewing, setPreviewing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  // How many of the last batch went to the Library rather than onto this reminder.
  const [alsoInLibrary, setAlsoInLibrary] = useState(0);

  const pick = (option: SourceOption) => {
    setChoosing(false);
    setAlsoInLibrary(0);
    if (!option.mimeTypes) {
      onChooseFromLibrary();
      return;
    }
    importMedia.reset();
    importMedia
      .importMediaAsync(option.mimeTypes)
      .then(outcome => {
        if (outcome.status === 'imported' && outcome.media) {
          onPicked(outcome.media.id);
          setAlsoInLibrary(outcome.items.length - 1);
        }
      })
      // The failure is already on `importMedia.error`, rendered below.
      .catch(() => undefined);
  };

  const styles = StyleSheet.create({
    empty: {
      height: STAGE_HEIGHT,
      borderRadius: theme.radius.card,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: error ? theme.color.error : theme.color.outlineVariant,
      backgroundColor: theme.color.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    sources: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.xs},
    source: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.secondaryContainer,
    },
    stage: {borderRadius: theme.radius.card, overflow: 'hidden'},
    pill: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: withAlpha(neutral.black, 0.6),
    },
    onScrim: {color: neutral.white},
    caption: {paddingTop: theme.spacing.xs},
    flex: {flex: 1},
  });

  const sourceButtons = (
    <View style={styles.sources}>
      {SOURCES.map(option => (
        <Pressable
          key={option.key}
          onPress={() => pick(option)}
          accessibilityRole="button"
          accessibilityLabel={t(option.labelKey)}
          testID={`media-source-${option.key}`}
          style={({pressed}) => [styles.source, {opacity: pressed ? 0.85 : 1}]}>
          <Icon name={option.icon} size="sm" color={theme.color.onSecondaryContainer} />
          <Text variant="labelLarge" style={{color: theme.color.onSecondaryContainer}}>
            {t(option.labelKey)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const importError = importMedia.error ? importErrorCopy(importMedia.error) : null;

  return (
    <Stack gap="sm">
      <EditorSectionHeading label={t('reminders.editor.mediaSection')} />

      {importMedia.isImporting ? (
        <ImportProgress importMedia={importMedia} />
      ) : loading ? (
        <LoadingState label={t('loading.startingUp')} />
      ) : failed ? (
        <Button label={t('action.retry')} variant="tonal" onPress={onRetry} />
      ) : media && !choosing ? (
        <View testID="reminder-media-selected">
          <View style={styles.stage}>
            <MediaHero thumbnailToken={media.thumbnailToken} kind={media.kind} height={STAGE_HEIGHT} />

            {media.kind !== 'text' ? (
              <Pressable
                onPress={() => setPreviewing(true)}
                accessibilityRole="button"
                accessibilityLabel={t('reminders.editor.previewMedia')}
                style={({pressed}) => [styles.pill, {left: theme.spacing.sm, bottom: theme.spacing.sm, opacity: pressed ? 0.8 : 1}]}>
                <Icon name="play" size="xs" color={neutral.white} />
                <Text variant="labelMedium" style={styles.onScrim}>
                  {t('reminders.editor.previewMedia')}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                setAlsoInLibrary(0);
                setChoosing(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('reminders.editor.changeMedia')}
              testID="reminder-media-change"
              style={({pressed}) => [styles.pill, {right: theme.spacing.sm, bottom: theme.spacing.sm, opacity: pressed ? 0.8 : 1}]}>
              <Text variant="labelMedium" style={styles.onScrim}>
                {t('reminders.editor.changeMedia')}
              </Text>
            </Pressable>
          </View>

          <Stack direction="row" align="center" gap="xxs" style={styles.caption}>
            <Icon name={KIND_ICON[media.kind]} size="xs" color={theme.color.onSurfaceVariant} />
            <Text variant="bodyMedium" tone="variant" numberOfLines={1} style={styles.flex}>
              {media.title}
            </Text>
          </Stack>
          {/* DL-110: set in the preview, at the playhead. */}
          {onStartChange && (media.kind === 'video' || media.kind === 'audio') ? (
            <Stack direction="row" align="center" gap="xs" style={styles.caption}>
              <Text variant="bodyMedium" tone="variant" style={styles.flex} testID="reminder-media-start">
                {startMs
                  ? t('reminders.editor.startsAt', {time: formatDurationCompact(startMs)})
                  : t('reminders.editor.startsAtBeginning')}
              </Text>
              {startMs ? (
                <Button label={t('reminders.editor.startReset')} variant="text" onPress={() => onStartChange(null)} />
              ) : (
                <Button label={t('reminders.editor.startChoose')} variant="text" onPress={() => setPreviewing(true)} />
              )}
            </Stack>
          ) : null}
          {alsoInLibrary > 0 ? (
            <Text variant="bodyMedium" tone="variant" testID="reminder-media-also-in-library">
              {alsoInLibrary === 1
                ? t('reminders.editor.alsoInLibraryOne')
                : t('reminders.editor.alsoInLibrary', {count: alsoInLibrary})}
            </Text>
          ) : null}
        </View>
      ) : (
        <Stack gap="xs">
          <View style={styles.empty}>
            <Icon name="image" size="xl" color={theme.color.onSurfaceVariant} />
            <Text variant="titleMedium" align="center">
              {t('reminders.editor.mediaEmptyTitle')}
            </Text>
            {sourceButtons}
          </View>
          {media ? <Button label={t('action.cancel')} variant="text" onPress={() => setChoosing(false)} /> : null}
        </Stack>
      )}

      {error && !media ? <Text variant="bodyMedium" tone="error">{error}</Text> : null}
      {importError && importMedia.error?.field !== 'cancelled' ? (
        <Banner kind="actionNeeded" title={t(importError.titleKey)} effect={t(importError.bodyKey)} />
      ) : null}

      <ImportPrompts importMedia={importMedia} />
      <MediaSelectionPreviewModal
        item={previewing && media ? media : null}
        onDismiss={() => setPreviewing(false)}
        closeLabel={t('library.player.close')}
        loadErrorLabel={t('library.player.loadError')}
        startPoint={onStartChange
          ? {
            startMs,
            label: positionMs => t('reminders.editor.startHere', {time: formatDurationCompact(positionMs)}),
            onChoose: positionMs => {
              onStartChange(positionMs >= 1000 ? positionMs : null);
              setPreviewing(false);
            },
          }
          : undefined}
      />
    </Stack>
  );
}
