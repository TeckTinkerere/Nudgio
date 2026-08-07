/**
 * Reminder detail screen (MR-03 reminder detail / editor preview fields).
 *
 * Shows the reminder's media, schedule, alert profile and snooze policy with
 * Edit/Delete actions. Data source is mock fixtures (`findMockReminder`) —
 * see `MediaDetailScreen`'s module doc for why.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useState} from 'react';
import {StyleSheet} from 'react-native';

import type {RootStackParamList} from '../../app/navigation/types';
import {rootRoutes} from '../../constants/routes';
import {
  AppBar,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  Screen,
  Stack,
  Text,
  Toggle,
  useTheme,
} from '../../design-system';
import {useHaptics} from '../../hooks';
import {useTranslation} from '../../localization';
import {findMockMedia, findMockReminder} from '../../mocks/fixtures';
import {mockProfiles} from '../../native-client';
import {isBuiltInProfileNameKey} from '../../native-client/reminderProfileNameKeys';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderDetail'>;

export function ReminderDetailScreen({navigation, route}: Props) {
  const t = useTranslation();
  const theme = useTheme();
  const haptics = useHaptics();
  const reminder = findMockReminder(route.params.reminderId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [enabled, setEnabled] = useState(reminder?.enabledIntent ?? false);

  if (!reminder) {
    return (
      <Screen hasAppBar>
        <AppBar
          title={t('reminders.detail.title')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
        />
        <EmptyState
          icon="reminders"
          title={t('library.detail.notFound.title')}
          body={t('library.detail.notFound.effect')}
        />
      </Screen>
    );
  }

  const media = findMockMedia(reminder.mediaId);
  const profile = mockProfiles.find(item => item.id === reminder.profileId);

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

      <Stack gap="lg" paddingVertical="md">
        {reminder.effectiveState === 'disabled' ? (
          <Banner kind="neutral" title={reminder.label} effect={t('reminders.detail.disabledNotice')} />
        ) : reminder.effectiveState === 'needs_setup' ? (
          <Banner
            kind="actionNeeded"
            title={reminder.label}
            effect={t('reminders.detail.needsSetupNotice')}
            action={{label: t('today.capability.openHealth'), onPress: () => navigation.navigate(rootRoutes.health)}}
          />
        ) : null}

        <Card>
          <Stack direction="row" align="center" justify="space-between">
            <Stack gap="xxs" style={styles.flexFill}>
              <Text variant="labelLarge" tone="variant">
                {t('reminders.editor.enabledToggle')}
              </Text>
              <Text variant="titleMedium">{media?.title ?? reminder.label}</Text>
            </Stack>
            <Toggle value={enabled} onValueChange={setEnabled} label={reminder.label} />
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
              {profile && isBuiltInProfileNameKey(profile.nameKey) ? t(profile.nameKey) : ''}
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
              {t('reminders.editor.snoozeMinutes', {minutes: reminder.snooze.defaultMinutes})}
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
            navigation.goBack();
          },
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
});
