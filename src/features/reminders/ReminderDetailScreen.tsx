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
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useCallback, useState} from 'react';
import {StyleSheet} from 'react-native';

import {MediaHero} from './MediaHero';
import {actionButtonLabel, actionTargetOf, ACTION_TARGET_ICON, displayHostOf} from './reminderActions';
import {describeStatus} from './ReminderRow';
import {reminderStatus} from './reminderStatus';
import {useDeleteReminder} from './useDeleteReminder';
import {useOpenReminderAction} from './useOpenReminderAction';
import {useReminderDetail} from './useReminderDetail';
import {useSetReminderEnabled} from './useSetReminderEnabled';
import {useSkipNext} from './useSkipNext';
import type {RootStackParamList} from '../../app/navigation/types';
import {rootRoutes} from '../../constants/routes';
import {useSessionStore} from '../../core/state/sessionStore';
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
  useFloatingAppBar,
} from '../../design-system';
import {useTheme} from '../../design-system/theme/useTheme';
import {useHaptics, usePreferences, useProfiles} from '../../hooks';
import {useTranslation} from '../../localization';
import {isBuiltInProfileNameKey} from '../../native-client/reminderProfileNameKeys';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderDetail'>;

export function ReminderDetailScreen({navigation, route}: Props) {
  const t = useTranslation();
  const theme = useTheme();
  const haptics = useHaptics();
  const reminderQuery = useReminderDetail(route.params.reminderId);
  const profiles = useProfiles();
  const setEnabled = useSetReminderEnabled();
  const skipNext = useSkipNext();
  const deleteReminder = useDeleteReminder();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const appBar = useFloatingAppBar();
  const openMoment = useSessionStore(state => state.openMoment);
  const openAction = useOpenReminderAction();
  const preferences = usePreferences();
  const use24Hour = preferences.data?.use24HourTime ?? null;
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => setNow(new Date()), []));

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
            recoveryAction={{
              label: t('action.retry'),
              onPress: () => reminderQuery.refetch(),
            }}
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
  const status = reminderStatus(reminder, now);
  const profileName = profile && isBuiltInProfileNameKey(profile.nameKey) ? t(profile.nameKey) : '';

  return (
    <Screen
      hasAppBar
      scrollable
      onScroll={appBar.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{paddingTop: appBar.barHeight}}
      appBarSlot={
        <AppBar
          title={t('reminders.detail.title')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
          actions={[
            {
              icon: 'edit',
              label: t('reminders.detail.edit'),
              onPress: () =>
                navigation.navigate(rootRoutes.reminderEditor, {
                  reminderId: reminder.id,
                }),
            },
          ]}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
        />
      }>
      <Stack gap="lg" paddingVertical="md">
        {reminder.effectiveState === 'needs_setup' ? (
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

        {/* The moment, as it will appear: media first, then the words. */}
        <Card padding={0}>
          <MediaHero thumbnailToken={reminder.thumbnailToken} kind={reminder.mediaKind} roundTopOnly />
          <Stack gap="xs" style={{padding: theme.spacing.md}}>
            <Text variant="headlineMedium" isHeading>{reminder.label}</Text>
            {reminder.notes ? <Text variant="bodyLarge">{reminder.notes}</Text> : null}
            <Button
              label={t('reminders.detail.previewMoment')}
              variant="tonal"
              icon="play"
              onPress={() => openMoment({reminderId: reminder.id, mediaId: reminder.mediaId})}
              testID="reminder-preview-moment"
            />
          </Stack>
        </Card>

        <Card>
          <Stack direction="row" align="center" gap="sm">
            <Icon name="clock" color={theme.color.onSurfaceVariant} />
            <Stack gap={2} style={styles.flexFill}>
              <Text variant="titleMedium" tone={status.kind === 'next' ? 'primary' : 'default'}>
                {describeStatus(status, now, use24Hour, t)}
              </Text>
              <Text variant="bodyMedium" tone="variant">{reminder.repeatSummary}</Text>
            </Stack>
            {status.kind === 'done' ? null : (
              <Toggle
                value={reminder.enabledIntent}
                onValueChange={value => setEnabled.mutate({id: reminder.id, enabled: value})}
                label={t('reminders.list.enableToggle', {label: reminder.label})}
              />
            )}
          </Stack>
          {/*
            DL-110 "Skip next": repeating reminders only — a one-time
            reminder's next time is its only one, so it has the toggle.
          */}
          {reminder.skippedAt ? (
            <Stack direction="row" align="center" gap="sm" style={styles.skipRow}>
              <Icon name="skip" size="sm" color={theme.color.onSurfaceVariant} />
              <Text variant="bodyMedium" tone="variant" style={styles.flexFill} testID="reminder-skipped-note">
                {t('reminders.skip.skipped', {
                  when: describeStatus({kind: 'next', at: new Date(reminder.skippedAt)}, now, use24Hour, t),
                })}
              </Text>
              <Button
                label={t('reminders.skip.undo')}
                variant="text"
                disabled={skipNext.isPending}
                onPress={() => skipNext.mutate({id: reminder.id, skip: false})}
              />
            </Stack>
          ) : reminder.schedule.type !== 'once' && status.kind === 'next' ? (
            <Button
              label={t('reminders.skip.action')}
              variant="text"
              icon="skip"
              disabled={skipNext.isPending}
              onPress={() => skipNext.mutate({id: reminder.id, skip: true})}
              testID="reminder-skip-next"
              style={styles.skipButton}
            />
          ) : null}
        </Card>

        <Stack gap="xxs">
          <Text variant="titleMedium">{t('reminders.action.section')}</Text>
          <Card>
            {reminder.action ? (
              <Stack direction="row" align="center" gap="sm">
                <Icon name={ACTION_TARGET_ICON[actionTargetOf(reminder.action.uri)]} color={theme.color.primary} />
                <Stack gap={2} style={styles.flexFill}>
                  <Text variant="titleMedium">{actionButtonLabel(reminder.action, t)}</Text>
                  <Text variant="bodyMedium" tone="variant" numberOfLines={1}>
                    {displayHostOf(reminder.action.uri) ?? reminder.action.uri}
                  </Text>
                </Stack>
                <Button
                  label={t('reminders.action.test')}
                  variant="text"
                  onPress={() => {
                    if (reminder.action) {
                      // eslint-disable-next-line no-void
                      void openAction(reminder.action);
                    }
                  }}
                />
              </Stack>
            ) : (
              <Text variant="bodyLarge" tone="variant">{t('reminders.detail.noAction')}</Text>
            )}
          </Card>
        </Stack>

        <Stack gap="xxs">
          <Text variant="titleMedium">{t('reminders.detail.alertStyle')}</Text>
          <Card>
            <Text variant="bodyLarge">
              {t('reminders.editor.alertSummary', {profile: profileName, minutes: reminder.snooze.defaultMinutes})}
            </Text>
            {profile?.nameKey === 'profile.persistent.name' ? (
              <Text variant="labelMedium" tone="variant">
                {t('profile.persistent.notice')}
              </Text>
            ) : null}
          </Card>
        </Stack>

        <Stack direction="row" gap="sm" wrap>
          <Button
            label={t('reminders.detail.duplicate')}
            variant="outlined"
            icon="add"
            onPress={() =>
              navigation.navigate(rootRoutes.reminderEditor, {reminderId: undefined, duplicateFromId: reminder.id})
            }
            style={styles.grow}
          />
          <Button
            label={t('action.delete')}
            variant="destructive"
            icon="delete"
            onPress={() => setDeleteDialogOpen(true)}
            style={styles.grow}
          />
        </Stack>
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
  skipRow: {paddingTop: 8},
  skipButton: {alignSelf: 'flex-start', marginTop: 4},
  grow: {flexGrow: 1, flexBasis: 140},
});
