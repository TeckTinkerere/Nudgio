/**
 * Health dashboard placeholder (MR-03 "Health screen").
 *
 * The real screen reads `CapabilitySnapshot` rows with per-item action
 * buttons and a Test reminder control. This slice already exposes
 * `useCapabilitySnapshot()`; wiring the full row list is deferred with
 * reminder/alarm logic, but the overall status is shown here as the first
 * real consumer of that hook beyond Today's banner.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  AppBar,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  StatusPill,
  type StatusKind,
} from '../../../design-system';
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
    <Screen hasAppBar>
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
      ) : (
        <>
          {capability.data ? (
            <StatusPill
              kind={STATUS_KIND[capability.data.overall]}
              label={t(STATUS_LABEL_KEY[capability.data.overall])}
            />
          ) : null}
          <EmptyState
            icon="health"
            title="Full capability rows are not built yet"
            body="This screen currently shows overall status only; per-item rows and Test reminder arrive with the alarm/capability slice."
          />
        </>
      )}
    </Screen>
  );
}
