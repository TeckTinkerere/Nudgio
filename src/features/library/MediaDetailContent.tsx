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

import {DeleteFlushOverlay} from './DeleteFlushOverlay';
import {MediaPreviewPlayer} from './MediaPreviewPlayer';
import {useDeleteMedia} from './useDeleteMedia';
import {useExportMedia} from './useExportMedia';
import {useMediaDetail} from './useMediaDetail';
import type {RootStackParamList} from '../../app/navigation/types';
import {useToast} from '../../app/toast/ToastProvider';
import {rootRoutes} from '../../constants/routes';
import {
  AppBar,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  LoadingState,
  Stack,
  StatusPill,
  Text,
} from '../../design-system';
import type {IconName, StatusKind} from '../../design-system';
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
  /**
   * Fires once the delete flush animation finishes after a confirmed,
   * successful delete — the standalone screen pops itself, the two-pane
   * embedded pane clears its selection. Distinct from `onBack` because the
   * embedded pane has no "back" of its own, only a selection to clear.
   */
  readonly onDeleted?: () => void;
}

const KIND_LABEL_KEY: Record<MediaKind, TranslationKey> = {
  video: 'library.kind.video',
  audio: 'library.kind.audio',
  image: 'library.kind.image',
  text: 'library.kind.text',
};

const KIND_ICON: Record<MediaKind, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
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

export function MediaDetailContent({mediaId, onBack, onDeleted}: MediaDetailContentProps) {
  const t = useTranslation();
  const haptics = useHaptics();
  const navigation = useNavigation<Navigation>();
  const media = useMediaDetail(mediaId);
  const reminders = useReminderList();
  const deleteMedia = useDeleteMedia();
  const exportMedia = useExportMedia();
  const {showToast} = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [deletingIcon, setDeletingIcon] = useState<IconName | null>(null);

  const backAction = onBack ? {label: t('action.back'), onPress: onBack} : undefined;

  // Deliberately checked before `media.isPending`/`isError` below: once the
  // native delete has succeeded, the underlying `getMedia` query can be
  // invalidated and refetch at any moment (it 404s once the row is truly
  // gone) — reading `media.data` for anything past this point would race
  // the flush animation and flash a "not found" state underneath it. This
  // branch stops touching `media` entirely; `deletingIcon` was captured
  // before the delete request went out, while the item still existed.
  if (flushing) {
    return (
      <FlushingMediaView
        backAction={backAction}
        libraryTitle={t('library.title')}
        icon={deletingIcon ?? 'mediaMissing'}
        // Deliberately does NOT reset `flushing` back to `false` — this
        // component is about to unmount either way (`onBack`'s
        // `navigation.goBack()` pops it, or the two-pane parent swaps it
        // for its empty-selection pane), and flipping `flushing` first
        // caused exactly one extra render on the way out where `media`'s
        // now-invalidated query had already flipped to "not found" —
        // a visible flash of the wrong state right as the screen closed.
        onFinished={() => onDeleted?.()}
      />
    );
  }

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
  const openEditAsset = () =>
    navigation.navigate(rootRoutes.editMediaAsset, {mediaId: item.id});

  const exportItem = () => {
    exportMedia.mutate([item.id], {
      onSuccess: () => showToast({message: t('library.selection.exportSuccess', {count: 1}), tone: 'success'}),
      onError: () => showToast({message: t('library.selection.exportError'), tone: 'error'}),
    });
  };

  const performDelete = (cascadeDeleteReminders: boolean) => {
    setDeleteDialogOpen(false);
    haptics.trigger('warning');
    setDeletingIcon(KIND_ICON[item.kind]);
    deleteMedia.mutate(
      {id: item.id, cascadeDeleteReminders},
      {onSuccess: () => setFlushing(true)},
    );
  };

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
                style={StyleSheet.absoluteFill}
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
          <Stack direction="row" align="center" gap="xxs">
            <Text variant="headlineMedium" isHeading style={styles.title}>
              {item.title}
            </Text>
            <IconButton
              name="edit"
              label={t('library.editAsset.editLabel', {title: item.title})}
              onPress={openEditAsset}
            />
          </Stack>
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
          <Button label={t('library.detail.editDetails')} variant="outlined" icon="edit" onPress={openEditAsset} />
          <Button
            label={t('library.detail.exportItem')}
            variant="outlined"
            icon="upload"
            loading={exportMedia.isPending}
            onPress={exportItem}
          />
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

      <DeleteMediaDialog
        visible={deleteDialogOpen}
        attachedReminderCount={attachedReminders.length}
        onCancel={() => setDeleteDialogOpen(false)}
        onKeepDisabled={() => performDelete(false)}
        onConfirm={() => performDelete(attachedReminders.length > 0)}
      />

      {deleteMedia.isError ? (
        <Dialog
          visible
          title={t('error.unexpected.title')}
          body={t('error.unexpected.effect')}
          cancel={{label: t('action.close'), onPress: () => deleteMedia.reset()}}
        />
      ) : null}
    </>
  );
}

interface FlushingMediaViewProps {
  readonly backAction?: {readonly label: string; readonly onPress: () => void};
  readonly libraryTitle: string;
  readonly icon: IconName;
  readonly onFinished: () => void;
}

/**
 * Extracted so the delete flush's own JSX branching doesn't add to
 * `MediaDetailContent`'s already-high cognitive complexity (code-health
 * hook, this slice) — it renders once, right after a confirmed delete,
 * and never touches `media`/`reminders` query state at all.
 */
function FlushingMediaView({backAction, libraryTitle, icon, onFinished}: FlushingMediaViewProps) {
  return (
    <>
      {backAction ? <AppBar title={libraryTitle} back={backAction} /> : null}
      <DeleteFlushOverlay visible icon={icon} onFinished={onFinished} />
    </>
  );
}

interface DeleteMediaDialogProps {
  readonly visible: boolean;
  readonly attachedReminderCount: number;
  readonly onCancel: () => void;
  readonly onKeepDisabled: () => void;
  readonly onConfirm: () => void;
}

/** Extracted for the same code-health reason as `FlushingMediaView` above. */
function DeleteMediaDialog({
  visible,
  attachedReminderCount,
  onCancel,
  onKeepDisabled,
  onConfirm,
}: DeleteMediaDialogProps) {
  const t = useTranslation();
  const hasAttachedReminders = attachedReminderCount > 0;

  return (
    <Dialog
      visible={visible}
      title={t('library.detail.deleteTitle')}
      body={t('library.detail.deleteConfirmBody')}
      impact={
        hasAttachedReminders
          ? t('library.detail.deleteDependencyWarning', {count: attachedReminderCount})
          : undefined
      }
      destructive
      cancel={{label: t('action.cancel'), onPress: onCancel}}
      alternative={
        hasAttachedReminders
          ? {label: t('library.detail.deleteKeepDisabled'), onPress: onKeepDisabled}
          : undefined
      }
      confirm={{
        label: hasAttachedReminders
          ? t('library.detail.deleteMediaAndReminders')
          : t('action.delete'),
        onPress: onConfirm,
      }}
    />
  );
}

const styles = StyleSheet.create({
  previewWide: {width: '100%', aspectRatio: 16 / 9},
  previewSquare: {width: '100%', aspectRatio: 1},
  previewOverlay: {...StyleSheet.absoluteFill},
  title: {flexShrink: 1},
});
