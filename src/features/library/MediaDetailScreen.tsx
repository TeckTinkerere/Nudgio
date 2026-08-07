/**
 * Media detail screen (MR-03 "Media detail").
 *
 * "The detail screen includes preview, title, type/duration/size, category,
 * tags, notes, attached reminders and file integrity status. Primary action
 * is Add reminder. Secondary actions: Play preview, Edit details, Export this
 * item, Delete." Deleting shows dependency-aware copy with the destructive
 * button last (MR-03 "Error and recovery pattern" / Dialog conventions).
 *
 * Data source: mock fixtures via `findMockMedia` for now — this screen has
 * no corresponding bridge query yet (`getMedia` rejects on a real device;
 * the demo module answers it, see `native-client/demoNativeModule.ts`).
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useState} from 'react';
import {StyleSheet} from 'react-native';

import type {RootStackParamList} from '../../app/navigation/types';
import {
  AppBar,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  Screen,
  Stack,
  StatusPill,
  Text,
} from '../../design-system';
import type {StatusKind} from '../../design-system';
import {useHaptics} from '../../hooks';
import {useTranslation, type TranslationKey} from '../../localization';
import {findMockMedia, mockReminders} from '../../mocks/fixtures';
import type {IntegrityState, MediaKind} from '../../native-client/types';
import {formatBytes, formatDurationCompact} from '../../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'MediaDetail'>;

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

export function MediaDetailScreen({navigation, route}: Props) {
  const t = useTranslation();
  const haptics = useHaptics();
  const media = findMockMedia(route.params.mediaId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!media) {
    return (
      <Screen hasAppBar>
        <AppBar title={t('library.title')} back={{label: t('action.back'), onPress: () => navigation.goBack()}} />
        <EmptyState
          icon="mediaMissing"
          title={t('library.detail.notFound.title')}
          body={t('library.detail.notFound.effect')}
        />
      </Screen>
    );
  }

  const attachedReminders = mockReminders.filter(reminder => reminder.mediaId === media.id);

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={media.title}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <Stack gap="lg" paddingVertical="md">
        <Card padding="none" elevation="level1">
          <Stack
            style={media.kind === 'video' ? styles.previewWide : styles.previewSquare}
            align="center"
            justify="center">
            <StatusPill
              kind={INTEGRITY_STATUS[media.integrity]}
              label={
                media.integrity === 'missing'
                  ? t('library.integrity.missing')
                  : t(KIND_LABEL_KEY[media.kind])
              }
            />
          </Stack>
        </Card>

        <Stack gap="xs">
          <Text variant="headlineMedium" isHeading>
            {media.title}
          </Text>
          <Stack direction="row" gap="xs" wrap>
            <Chip label={t(KIND_LABEL_KEY[media.kind])} />
            {media.durationMs ? <Chip label={formatDurationCompact(media.durationMs)} /> : null}
            <Chip label={formatBytes(media.sizeBytes)} />
            {media.category ? <Chip label={media.category.name} /> : null}
          </Stack>
          {media.tags.length > 0 ? (
            <Stack direction="row" gap="xxs" wrap>
              {media.tags.map(tag => (
                <Chip key={tag.id} label={tag.name} />
              ))}
            </Stack>
          ) : null}
        </Stack>

        <Button
          label={t('library.detail.addReminder')}
          onPress={() => undefined}
          icon="add"
          fullWidth
        />
        <Stack direction="row" gap="xs" wrap>
          <Button label={t('library.detail.playPreview')} variant="tonal" icon="play" onPress={() => undefined} />
          <Button label={t('library.detail.editDetails')} variant="outlined" icon="edit" onPress={() => undefined} />
          <Button label={t('library.detail.exportItem')} variant="outlined" icon="upload" onPress={() => undefined} />
        </Stack>

        {media.notes ? (
          <Stack gap="xxs">
            <Text variant="titleMedium">{t('library.detail.notes')}</Text>
            <Text variant="bodyLarge" tone="variant">
              {media.notes}
            </Text>
          </Stack>
        ) : null}

        <Stack gap="xxs">
          <Text variant="titleMedium">{t('library.detail.attachedReminders')}</Text>
          {attachedReminders.length === 0 ? (
            <Text variant="bodyMedium" tone="variant">
              {t('library.detail.noAttachedReminders')}
            </Text>
          ) : (
            attachedReminders.map(reminder => (
              <Card key={reminder.id} onPress={() => undefined}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewWide: {width: '100%', aspectRatio: 16 / 9},
  previewSquare: {width: '100%', aspectRatio: 1},
});
