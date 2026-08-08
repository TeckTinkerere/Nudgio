/**
 * Media detail content (MR-03 "Media detail"), extracted from
 * `MediaDetailScreen` so the same content can render two ways: as a full
 * pushed screen (`MediaDetailScreen`, phone/compact width) and embedded as
 * the right-hand pane of `LibraryScreen`'s two-pane layout at medium/expanded
 * width (`specs/Markdown/04_Visual_Design_System.md` "Responsive behavior":
 * "Medium: ... two-pane Library detail"). `onBack` being present or absent is
 * what tells this component which mode it's in — an embedded pane has no
 * back button of its own, since the grid beside it is the "back" affordance.
 *
 * "The detail screen includes preview, title, type/duration/size, category,
 * tags, notes, attached reminders and file integrity status. Primary action
 * is Add reminder. Secondary actions: Play preview, Edit details, Export this
 * item, Delete." Deleting shows dependency-aware copy with the destructive
 * button last (MR-03 "Error and recovery pattern" / Dialog conventions).
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useState} from 'react';
import {Image, Pressable, StyleSheet} from 'react-native';

import {MediaPreviewPlayer} from './MediaPreviewPlayer';
import {RenameMediaDialog} from './RenameMediaDialog';
import {useMediaDetail} from './useMediaDetail';
import type {RootStackParamList} from '../../app/navigation/types';
import {rootRoutes} from '../../constants/routes';
import {
  AppBar,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  LoadingState,
  Stack,
  StatusPill,
  Text,
} from '../../design-system';
import type {StatusKind} from '../../design-system';
import {useHaptics, useReminderList} from '../../hooks';
import {useTranslation, type TranslationKey} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {IntegrityState, MediaKind, UUID} from '../../native-client/types';
import {formatBytes, formatDurationCompact} from '../../utils';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export interface MediaDetailContentProps {
  readonly mediaId: UUID;
  /** Present only when rendered as a standalone pushed screen. */
  readonly onBack?: () => void;
}

const KIND_LABEL_KEY: Record<MediaKind, TranslationKey> = {
  video: 'library.kind.video',
  audio: 'library.kind.audio',
  image: 'library.kind.image',
  text: 'library.kind.text',
};

const INTEGRITY_STATUS: Record<IntegrityState, StatusKind> = {
  healthy: 'ready',
  unchecked: 'neutral',
  missing: 'actionNeeded',
  changed: 'limited',
  unsupported: 'actionNeeded',
};

const isPlayableKind = (kind: MediaKind): kind is 'video' | 'audio' =>
  kind === 'video' || kind === 'audio';

export function MediaDetailContent({mediaId, onBack}: MediaDetailContentProps) {
  const t = useTranslation();
  const haptics = useHaptics();
  const navigation = useNavigation<Navigation>();
  const media = useMediaDetail(mediaId);
  const reminders = useReminderList();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const backAction = onBack ? {label: t('action.back'), onPress: onBack} : undefined;

  if (media.isPending) {
    return (
      <>
        {backAction ? <AppBar title={t('library.title')} back={backAction} /> : null}
        <LoadingState label={t('loading.startingUp')} />
      </>
    );
  }

  if (media.isError || !media.data) {
    return (
      <>
        {backAction ? <AppBar title={t('library.title')} back={backAction} /> : null}
        <EmptyState
          icon="mediaMissing"
          title={t('library.detail.notFound.title')}
          body={t('library.detail.notFound.effect')}
        />
      </>
    );
  }

  const item = media.data;
  const attachedReminders = reminders.data?.items.filter(reminder => reminder.mediaId === item.id) ?? [];
  const thumbnail = thumbnailImageSource(item.thumbnailToken);
  const canPlay = isPlayableKind(item.kind) && item.integrity !== 'missing';

  return (
    <>
      {backAction ? <AppBar title={item.title} back={backAction} /> : null}

      <Stack gap="lg" paddingVertical="md">
        <Card padding="none" elevation="level1">
          <Pressable
            onPress={canPlay ? () => setPreviewOpen(true) : undefined}
            accessibilityRole={canPlay ? 'button' : undefined}
            accessibilityLabel={canPlay ? t('library.player.play', {title: item.title}) : undefined}
            style={item.kind === 'video' ? styles.previewWide : styles.previewSquare}>
            {thumbnail ? (
              <Image
                source={thumbnail}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            ) : null}
            <Stack style={styles.previewOverlay} align="center" justify="center">
              <StatusPill
                kind={INTEGRITY_STATUS[item.integrity]}
                label={
                  item.integrity === 'missing'
                    ? t('library.integrity.missing')
                    : t(KIND_LABEL_KEY[item.kind])
                }
              />
            </Stack>
          </Pressable>
        </Card>

        <Stack gap="xs">
          <Text variant="headlineMedium" isHeading>
            {item.title}
          </Text>
          <Stack direction="row" gap="xs" wrap>
            <Chip label={t(KIND_LABEL_KEY[item.kind])} />
            {item.durationMs ? <Chip label={formatDurationCompact(item.durationMs)} /> : null}
            <Chip label={formatBytes(item.sizeBytes)} />
            {item.category ? <Chip label={item.category.name} /> : null}
          </Stack>
          {item.tags.length > 0 ? (
            <Stack direction="row" gap="xxs" wrap>
              {item.tags.map(tag => (
                <Chip key={tag.id} label={tag.name} />
              ))}
            </Stack>
          ) : null}
        </Stack>

        <Button
          label={t('library.detail.addReminder')}
          onPress={() =>
            navigation.navigate(rootRoutes.reminderEditor, {reminderId: undefined, mediaId: item.id})
          }
          icon="add"
          fullWidth
        />
        <Stack direction="row" gap="xs" wrap>
          <Button
            label={t('library.detail.playPreview')}
            variant="tonal"
            icon="play"
            disabled={!canPlay}
            onPress={() => setPreviewOpen(true)}
          />
          <Button label={t('library.detail.editDetails')} variant="outlined" icon="edit" onPress={() => setRenameOpen(true)} />
          <Button label={t('library.detail.exportItem')} variant="outlined" icon="upload" onPress={() => undefined} />
        </Stack>

        {item.notes ? (
          <Stack gap="xxs">
            <Text variant="titleMedium">{t('library.detail.notes')}</Text>
            <Text variant="bodyLarge" tone="variant">
              {item.notes}
            </Text>
          </Stack>
        ) : null}

        <Stack gap="xxs">
          <Text variant="titleMedium">{t('library.detail.attachedReminders')}</Text>
          {reminders.isPending ? (
            <Text variant="bodyMedium" tone="variant">
              {t('loading.startingUp')}
            </Text>
          ) : attachedReminders.length === 0 ? (
            <Text variant="bodyMedium" tone="variant">
              {t('library.detail.noAttachedReminders')}
            </Text>
          ) : (
            attachedReminders.map(reminder => (
              <Card
                key={reminder.id}
                onPress={() =>
                  navigation.navigate(rootRoutes.reminderDetail, {reminderId: reminder.id})
                }>
                <Text variant="titleMedium">{reminder.label}</Text>
                <Text variant="bodyMedium" tone="variant">
                  {reminder.repeatSummary}
                </Text>
              </Card>
            ))
          )}
        </Stack>

        <Button
          label={t('action.delete')}
          variant="destructive"
          icon="delete"
          onPress={() => setDeleteDialogOpen(true)}
        />
      </Stack>

      <RenameMediaDialog
        visible={renameOpen}
        media={item}
        onDismiss={() => setRenameOpen(false)}
      />

      {canPlay ? (
        <MediaPreviewPlayer
          visible={previewOpen}
          onDismiss={() => setPreviewOpen(false)}
          title={item.title}
          sourceToken={item.sourceToken}
          kind={item.kind}
          closeLabel={t('library.player.close')}
          loadErrorLabel={t('library.player.loadError')}
        />
      ) : null}

      <Dialog
        visible={deleteDialogOpen}
        title={t('library.detail.deleteTitle')}
        body={t('library.detail.deleteConfirmBody')}
        impact={
          attachedReminders.length > 0
            ? t('library.detail.deleteDependencyWarning', {count: attachedReminders.length})
            : undefined
        }
        destructive
        cancel={{label: t('action.cancel'), onPress: () => setDeleteDialogOpen(false)}}
        alternative={
          attachedReminders.length > 0
            ? {
                label: t('library.detail.deleteKeepDisabled'),
                onPress: () => setDeleteDialogOpen(false),
              }
            : undefined
        }
        confirm={{
          label:
            attachedReminders.length > 0
              ? t('library.detail.deleteMediaAndReminders')
              : t('action.delete'),
          onPress: () => {
            haptics.trigger('warning');
            setDeleteDialogOpen(false);
          },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  previewWide: {width: '100%', aspectRatio: 16 / 9},
  previewSquare: {width: '100%', aspectRatio: 1},
  previewOverlay: {...StyleSheet.absoluteFillObject},
});
