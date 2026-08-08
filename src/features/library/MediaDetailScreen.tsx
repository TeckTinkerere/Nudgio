/**
 * Media detail screen (MR-03 "Media detail").
 *
 * "The detail screen includes preview, title, type/duration/size, category,
 * tags, notes, attached reminders and file integrity status. Primary action
 * is Add reminder. Secondary actions: Play preview, Edit details, Export this
 * item, Delete." Deleting shows dependency-aware copy with the destructive
 * button last (MR-03 "Error and recovery pattern" / Dialog conventions).
 *
 * Data source: real, Room-backed (`useMediaDetail`/`getMedia`) — a previous
 * revision used `findMockMedia`, which could never resolve a real imported
 * item's UUID, so opening this screen from a real Library grid always showed
 * "not found." "Attached reminders" filters the real reminder list client-
 * side by `mediaId`; MR-09 does not anticipate enough reminders per medium to
 * need a dedicated indexed query for this.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useState} from 'react';
import {StyleSheet} from 'react-native';

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
  Screen,
  Stack,
  StatusPill,
  Text,
} from '../../design-system';
import type {StatusKind} from '../../design-system';
import {useHaptics, useReminderList} from '../../hooks';
import {useTranslation, type TranslationKey} from '../../localization';
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
  const media = useMediaDetail(route.params.mediaId);
  const reminders = useReminderList();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  if (media.isPending) {
    return (
      <Screen hasAppBar>
        <AppBar title={t('library.title')} back={{label: t('action.back'), onPress: () => navigation.goBack()}} />
        <LoadingState label={t('loading.startingUp')} />
      </Screen>
    );
  }

  if (media.isError || !media.data) {
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

  const item = media.data;
  const attachedReminders = reminders.data?.items.filter(reminder => reminder.mediaId === item.id) ?? [];

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={item.title}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <Stack gap="lg" paddingVertical="md">
        <Card padding="none" elevation="level1">
          <Stack
            style={item.kind === 'video' ? styles.previewWide : styles.previewSquare}
            align="center"
            justify="center">
            <StatusPill
              kind={INTEGRITY_STATUS[item.integrity]}
              label={
                item.integrity === 'missing'
                  ? t('library.integrity.missing')
                  : t(KIND_LABEL_KEY[item.kind])
              }
            />
          </Stack>
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
          <Button label={t('library.detail.playPreview')} variant="tonal" icon="play" onPress={() => undefined} />
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
