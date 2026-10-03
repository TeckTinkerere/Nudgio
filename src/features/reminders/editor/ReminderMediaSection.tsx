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
 */
import {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {EditorSectionHeading} from './EditorSectionHeading';
import {
  Banner,
  Button,
  Icon,
  LoadingState,
  ProgressBar,
  Stack,
  Text,
  neutral,
  useTheme,
  type IconName,
} from '../../../design-system';
import {withAlpha} from '../../../design-system/theme/colorUtils';
import {importErrorCopy, importPhaseLabelKey, importProgressFraction, useImportMedia} from '../../../hooks';
import {useTranslation, type TranslationKey} from '../../../localization';
import type {MediaKind, MediaSummary, UUID} from '../../../native-client/types';
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
}

export function ReminderMediaSection({
  media,
  loading,
  failed,
  onRetry,
  onPicked,
  onChooseFromLibrary,
  error,
}: ReminderMediaSectionProps) {
  const t = useTranslation();
  const theme = useTheme();
  const importMedia = useImportMedia();
  const [previewing, setPreviewing] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const pick = (option: SourceOption) => {
    setChoosing(false);
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
        <ProgressBar
          progress={importProgressFraction(importMedia.progress)}
          label={t(importPhaseLabelKey(importMedia.progress?.phase) ?? 'library.import.copying')}
        />
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
              onPress={() => setChoosing(true)}
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
        <Banner kind="actionNeeded" title={t(importError.titleKey)} effect={t(importError.bodyKey, {megabytes: 250})} />
      ) : null}

      <MediaSelectionPreviewModal
        item={previewing && media ? media : null}
        onDismiss={() => setPreviewing(false)}
        closeLabel={t('library.player.close')}
        loadErrorLabel={t('library.player.loadError')}
      />
    </Stack>
  );
}
