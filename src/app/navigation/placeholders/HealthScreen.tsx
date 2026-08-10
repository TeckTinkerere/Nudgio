/**
 * Health dashboard (MR-03 "Health screen").
 *
 * Real per-item capability rows, driven by `CapabilitySnapshot.items` —
 * previously this screen showed only the overall status pill and a static
 * "not built yet" message, even though `useCapabilitySnapshot()` and every
 * per-kind native status/effectKey it needs already existed. `effectKey`
 * was previously dead data end to end — nothing in the JS layer localized
 * it (the Upcoming screen's capability banner uses its own separate,
 * generic copy) — so the `capability.*` keys it points at did not exist in
 * `en.ts` until this pass added them, matching the exact strings
 * `CapabilitySnapshotProvider.kt` emits.
 *
 * `run_test` (the `scheduler` row's eventual action) stays unwired here —
 * Test reminder needs a real session/profile choice, which is its own
 * follow-up (this file's previous doc comment already flagged it as
 * deferred with "the alarm/capability slice").
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {StyleSheet} from 'react-native';

import {
  AppBar,
  Button,
  Card,
  ErrorState,
  Icon,
  LoadingState,
  Screen,
  Stack,
  StatusPill,
  Text,
  useTheme,
  type IconName,
  type StatusKind,
} from '../../../design-system';
import {useCapabilitySnapshot, useOpenCapabilitySettings, useRequestNotificationPermission} from '../../../hooks';
import {useTranslation, type TranslationKey} from '../../../localization';
import type {CapabilityAction, CapabilityItem, CapabilityKind, ResultStatus} from '../../../native-client/types';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Health'>;

/** MR-08 `ResultStatus` -> the StatusPill/StatusRoles vocabulary. */
const STATUS_KIND: Readonly<Record<ResultStatus, StatusKind>> = {
  ok: 'ready',
  limited: 'limited',
  needs_action: 'actionNeeded',
};

const STATUS_LABEL_KEY: Readonly<Record<ResultStatus, TranslationKey>> = {
  ok: 'today.status.ready',
  limited: 'today.status.limitedTiming',
  needs_action: 'today.status.actionNeeded',
};

/**
 * `CapabilityItem.status` has no dedicated label set of its own — reuses
 * `today.status.*`, since both vocabularies describe the same ready/
 * limited/blocked spectrum. `unknown` falls back to `limited`'s wording
 * rather than inventing a fourth pill state.
 */
const ITEM_STATUS_LABEL_KEY: Readonly<Record<CapabilityItem['status'], TranslationKey>> = {
  ready: 'today.status.ready',
  limited: 'today.status.limitedTiming',
  blocked: 'today.status.actionNeeded',
  unknown: 'today.status.limitedTiming',
};

const ITEM_STATUS_KIND: Readonly<Record<CapabilityItem['status'], StatusKind>> = {
  ready: 'ready',
  limited: 'limited',
  blocked: 'actionNeeded',
  unknown: 'neutral',
};

const KIND_ICON: Readonly<Record<CapabilityKind, IconName>> = {
  notifications: 'notification',
  exact_alarm: 'clock',
  full_screen_intent: 'alert',
  channels: 'notification',
  battery_environment: 'health',
  scheduler: 'repeat',
};

const KIND_TITLE_KEY: Readonly<Record<CapabilityKind, TranslationKey>> = {
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

function CapabilityRow({item}: {readonly item: CapabilityItem}) {
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
        <Icon name={KIND_ICON[item.kind]} color={theme.color.onSurfaceVariant} />
        <Stack style={styles.flexFill} gap="xxs">
          <Stack direction="row" align="center" justify="space-between" gap="sm">
            <Text variant="titleMedium">{t(KIND_TITLE_KEY[item.kind])}</Text>
            <StatusPill kind={ITEM_STATUS_KIND[item.status]} label={t(ITEM_STATUS_LABEL_KEY[item.status])} />
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

export function HealthScreen({navigation}: Props) {
  const t = useTranslation();
  const capability = useCapabilitySnapshot();

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={t('health.title')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      {/* `isPending`, not `isLoading` — see useAppBootstrap for why. */}
      {capability.isPending ? (
        <LoadingState label={t('loading.startingUp')} />
      ) : capability.isError ? (
        <ErrorState
          title={t('error.unexpected.title')}
          effect={t('error.unexpected.effect')}
          recoveryAction={{label: t('action.retry'), onPress: () => capability.refetch()}}
          diagnosticCode={capability.error.correlationId}
        />
      ) : capability.data ? (
        <Stack gap="md" paddingVertical="md">
          <Stack direction="row" align="center" gap="sm">
            <Text variant="titleLarge" isHeading>
              {t(STATUS_LABEL_KEY[capability.data.overall])}
            </Text>
            <StatusPill
              kind={STATUS_KIND[capability.data.overall]}
              label={t(STATUS_LABEL_KEY[capability.data.overall])}
            />
          </Stack>

          {capability.data.items.map(item => (
            <CapabilityRow key={item.kind} item={item} />
          ))}

          <Text variant="labelMedium" tone="variant">
            {t('health.oemNote')}
          </Text>
        </Stack>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
  rowAction: {alignSelf: 'flex-start'},
});
