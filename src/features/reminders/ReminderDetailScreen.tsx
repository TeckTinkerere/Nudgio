/**
 * Reminder detail screen (MR-03 reminder detail / editor preview fields).
 *
 * Shows the reminder's media, schedule, alert profile and snooze policy with
 * Edit/Delete actions. Real, Room-backed data via `useReminderDetail`
 * (previously `findMockReminder`/`findMockMedia` — opening this screen for
 * any real, saved reminder showed fixture data instead, docs/decision-log.md).
 * The enable `Toggle` and Delete confirm are now wired to the real
 * `setReminderEnabled`/`deleteReminder` mutations too — both were previously
 * decorative (`useState` and "close the dialog, do nothing" respectively).
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useState} from 'react';
import {Image, StyleSheet} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';

import {useDeleteReminder} from './useDeleteReminder';
import {useReminderDetail} from './useReminderDetail';
import {useSetReminderEnabled} from './useSetReminderEnabled';
import type {RootStackParamList} from '../../app/navigation/types';
import {rootRoutes} from '../../constants/routes';
import {
  AppBar,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Screen,
  Stack,
  Text,
  Toggle,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {useTheme} from '../../design-system/theme/useTheme';
import {useHaptics, useProfiles} from '../../hooks';
import {useTranslation} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import {isBuiltInProfileNameKey} from '../../native-client/reminderProfileNameKeys';
import type {MediaKind} from '../../native-client/types';

const MEDIA_ICON: Record<MediaKind, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
};

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderDetail'>;

export function ReminderDetailScreen({navigation, route}: Props) {
  const t = useTranslation();
  const theme = useTheme();
  const haptics = useHaptics();
  const reminderQuery = useReminderDetail(route.params.reminderId);
  const profiles = useProfiles();
  const setEnabled = useSetReminderEnabled();
  const deleteReminder = useDeleteReminder();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (reminderQuery.isPending) {
    return (
      <Screen hasAppBar>
        <AppBar
          title={t('reminders.detail.title')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
        />
        <LoadingState label={t('loading.startingUp')} />
      </Screen>
    );
  }

  if (reminderQuery.isError || !reminderQuery.data) {
    return (
      <Screen hasAppBar>
        <AppBar
          title={t('reminders.detail.title')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
        />
        {reminderQuery.isError ? (
          <ErrorState
            title={t('error.unexpected.title')}
            effect={t('error.unexpected.effect')}
            recoveryAction={{label: t('action.retry'), onPress: () => reminderQuery.refetch()}}
            diagnosticCode={reminderQuery.error.correlationId}
          />
        ) : (
          <EmptyState
            icon="reminders"
            title={t('library.detail.notFound.title')}
            body={t('library.detail.notFound.effect')}
          />
        )}
      </Screen>
    );
  }

  const reminder = reminderQuery.data;
  const profile = profiles.data?.find(item => item.id === reminder.profileId);
  const thumbnail = thumbnailImageSource(reminder.thumbnailToken);

  const avatarStyle = StyleSheet.create({
    box: {
      width: theme.layout.reminderThumbnailSize,
      height: theme.layout.reminderThumbnailSize,
      borderRadius: theme.radius.card,
      backgroundColor: theme.color.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={reminder.label}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
        actions={[
          {
            icon: 'edit',
            label: t('reminders.detail.edit'),
            onPress: () =>
              navigation.navigate(rootRoutes.reminderEditor, {reminderId: reminder.id}),
          },
        ]}
      />

      <Animated.View
        entering={
          theme.a11y.reduceMotion ? undefined : FadeInUp.springify().damping(18)
        }>
        <Stack gap="lg" paddingVertical="md">
          {reminder.effectiveState === 'disabled' ? (
            <Banner
              kind="neutral"
              title={reminder.label}
              effect={t('reminders.detail.disabledNotice')}
            />
          ) : reminder.effectiveState === 'needs_setup' ? (
            <Banner
              kind="actionNeeded"
              title={reminder.label}
              effect={t('reminders.detail.needsSetupNotice')}
              action={{
                label: t('today.capability.openHealth'),
                onPress: () => navigation.navigate(rootRoutes.health),
              }}
            />
          ) : null}

          <Card>
            <Stack direction="row" align="center" gap="sm">
              <Stack style={avatarStyle.box} align="center" justify="center">
                {thumbnail ? (
                  <Image
                    source={thumbnail}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                ) : (
                  <Icon
                    name={MEDIA_ICON[reminder.mediaKind]}
                    size="lg"
                    color={theme.color.onPrimaryContainer}
                  />
                )}
              </Stack>
              <Stack gap="xxs" style={styles.flexFill}>
                <Text variant="labelLarge" tone="variant">
                  {t('reminders.editor.enabledToggle')}
                </Text>
                <Text variant="titleMedium">{reminder.label}</Text>
              </Stack>
              <Toggle
                value={reminder.enabledIntent}
                onValueChange={value => setEnabled.mutate({id: reminder.id, enabled: value})}
                label={reminder.label}
              />
            </Stack>
          </Card>

          <Stack gap="xxs">
            <Text variant="titleMedium">{t('reminders.detail.schedule')}</Text>
            <Card>
              <Stack direction="row" align="center" gap="sm">
                <Icon name="repeat" color={theme.color.onSurfaceVariant} />
                <Text variant="bodyLarge">{reminder.repeatSummary}</Text>
              </Stack>
            </Card>
          </Stack>

          <Stack gap="xxs">
            <Text variant="titleMedium">{t('reminders.detail.alertStyle')}</Text>
            <Card>
              <Text variant="titleMedium">
                {profile && isBuiltInProfileNameKey(profile.nameKey)
                  ? t(profile.nameKey)
                  : ''}
              </Text>
              {profile?.nameKey === 'profile.persistent.name' ? (
                <Text variant="labelMedium" tone="variant">
                  {t('profile.persistent.notice')}
                </Text>
              ) : null}
            </Card>
          </Stack>

          <Stack gap="xxs">
            <Text variant="titleMedium">{t('reminders.detail.snooze')}</Text>
            <Card>
              <Text variant="bodyLarge">
                {t('reminders.editor.snoozeMinutes', {
                  minutes: reminder.snooze.defaultMinutes,
                })}
              </Text>
            </Card>
          </Stack>

          <Button
            label={t('reminders.detail.delete')}
            variant="destructive"
            icon="delete"
            onPress={() => setDeleteDialogOpen(true)}
          />
        </Stack>
      </Animated.View>

      <Dialog
        visible={deleteDialogOpen}
        title={t('reminders.detail.deleteConfirmTitle')}
        body={t('reminders.detail.deleteConfirmBody')}
        destructive
        cancel={{label: t('action.cancel'), onPress: () => setDeleteDialogOpen(false)}}
        confirm={{
          label: t('action.delete'),
          onPress: () => {
            haptics.trigger('warning');
            setDeleteDialogOpen(false);
            deleteReminder.mutate(reminder.id, {onSuccess: () => navigation.goBack()});
          },
        }}
      />

      {deleteReminder.isError ? (
        <Dialog
          visible
          title={t('error.unexpected.title')}
          body={t('error.unexpected.effect')}
          cancel={{label: t('action.close'), onPress: () => deleteReminder.reset()}}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
});
