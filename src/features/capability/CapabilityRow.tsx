/**
 * A single actionable capability row (notifications / exact alarm / full-
 * screen intent / channels / battery / scheduler), driven by
 * `CapabilitySnapshot.items`. Extracted out of `HealthScreen` so Onboarding's
 * permissions page can show the same real, tappable rows instead of a
 * description with nothing behind it — previously the only place a user
 * could actually grant exact-alarm access or the battery-optimization
 * exemption was this screen, which onboarding never linked to and most users
 * would never find on their own. Reusing this row (not a simplified copy)
 * means both places request/deep-link through the exact same native calls.
 */
import {StyleSheet} from 'react-native';

import {
  Button,
  Card,
  Icon,
  Stack,
  StatusPill,
  Text,
  useTheme,
  type IconName,
  type StatusKind,
} from '../../design-system';
import {useOpenCapabilitySettings, useRequestNotificationPermission} from '../../hooks';
import {useTranslation, type TranslationKey} from '../../localization';
import type {CapabilityAction, CapabilityItem, CapabilityKind} from '../../native-client/types';

export const CAPABILITY_ITEM_STATUS_LABEL_KEY: Readonly<Record<CapabilityItem['status'], TranslationKey>> = {
  ready: 'today.status.ready',
  limited: 'today.status.limitedTiming',
  blocked: 'today.status.actionNeeded',
  unknown: 'today.status.limitedTiming',
};

export const CAPABILITY_ITEM_STATUS_KIND: Readonly<Record<CapabilityItem['status'], StatusKind>> = {
  ready: 'ready',
  limited: 'limited',
  blocked: 'actionNeeded',
  unknown: 'neutral',
};

export const CAPABILITY_KIND_ICON: Readonly<Record<CapabilityKind, IconName>> = {
  notifications: 'notification',
  exact_alarm: 'clock',
  full_screen_intent: 'alert',
  channels: 'notification',
  battery_environment: 'health',
  scheduler: 'repeat',
};

export const CAPABILITY_KIND_TITLE_KEY: Readonly<Record<CapabilityKind, TranslationKey>> = {
  notifications: 'health.capability.notifications.title',
  exact_alarm: 'health.capability.exact_alarm.title',
  full_screen_intent: 'health.capability.full_screen_intent.title',
  channels: 'health.capability.channels.title',
  battery_environment: 'health.capability.battery_environment.title',
  scheduler: 'health.capability.scheduler.title',
};

/** Which of the two real Settings-facing actions a row's button performs; `none`/`run_test` render no button at all. */
const isActionable = (
  action: CapabilityAction,
): action is 'request_runtime' | 'open_special_access' | 'open_channel' | 'open_app' =>
  action === 'request_runtime' ||
  action === 'open_special_access' ||
  action === 'open_channel' ||
  action === 'open_app';

export function CapabilityRow({item}: {readonly item: CapabilityItem}) {
  const t = useTranslation();
  const theme = useTheme();
  const requestPermission = useRequestNotificationPermission();
  const openSettings = useOpenCapabilitySettings();

  const isPending = requestPermission.isPending || openSettings.isPending;

  const runAction = () => {
    if (item.action === 'request_runtime') {
      requestPermission.mutate();
    } else if (
      item.action === 'open_special_access' ||
      item.action === 'open_channel' ||
      item.action === 'open_app'
    ) {
      openSettings.mutate(item.kind);
    }
  };

  return (
    <Card>
      <Stack direction="row" align="flex-start" gap="sm">
        <Icon name={CAPABILITY_KIND_ICON[item.kind]} color={theme.color.onSurfaceVariant} />
        <Stack style={styles.flexFill} gap="xxs">
          <Stack direction="row" align="center" justify="space-between" gap="sm">
            <Text variant="titleMedium">{t(CAPABILITY_KIND_TITLE_KEY[item.kind])}</Text>
            <StatusPill
              kind={CAPABILITY_ITEM_STATUS_KIND[item.status]}
              label={t(CAPABILITY_ITEM_STATUS_LABEL_KEY[item.status])}
            />
          </Stack>
          <Text variant="bodyMedium" tone="variant">
            {t(item.effectKey as TranslationKey)}
          </Text>
          {isActionable(item.action) ? (
            <Button
              label={item.action === 'request_runtime' ? t('health.action.allow') : t('health.action.openSettings')}
              variant="text"
              loading={isPending}
              onPress={runAction}
              style={styles.rowAction}
            />
          ) : null}
        </Stack>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
  rowAction: {alignSelf: 'flex-start'},
});
