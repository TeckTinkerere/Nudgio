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

import {
  AppBar,
  ErrorState,
  LoadingState,
  Screen,
  Stack,
  StatusPill,
  Text,
  type StatusKind,
} from '../../../design-system';
import {CapabilityRow} from '../../../features/capability/CapabilityRow';
import {useCapabilitySnapshot} from '../../../hooks';
import {useTranslation, type TranslationKey} from '../../../localization';
import type {ResultStatus} from '../../../native-client/types';
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
