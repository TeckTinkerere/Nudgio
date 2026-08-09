/**
 * Renders the MR-07 startup states before handing off to navigation.
 *
 * `error` here means the bridge itself is unreachable or the contract
 * mismatched (see `MediaReminderClient.getStartupSnapshot`) — not an ordinary
 * empty library, which is a normal `ready` state handled by Today's own
 * empty-state UI.
 */
import type {PropsWithChildren} from 'react';

import {useAppBootstrap} from './useAppBootstrap';
import {useRequestNotificationPermissionOnLaunch} from './useRequestNotificationPermissionOnLaunch';
import {testIds} from '../../constants';
import {ErrorState, LoadingState} from '../../design-system';
import {useTranslation} from '../../localization';


export function StartupGate({children}: PropsWithChildren) {
  const t = useTranslation();
  const bootstrap = useAppBootstrap();
  useRequestNotificationPermissionOnLaunch(bootstrap.snapshot);

  if (bootstrap.phase === 'loading') {
    return (
      <LoadingState label={t('loading.startingUp')} testID={testIds.appShell.startupLoading} />
    );
  }

  if (bootstrap.phase === 'repairing') {
    // MR-07: a long repair gets its own state, distinct from the generic
    // loading spinner, so a slow device reads as "working" not "stuck".
    return <LoadingState label={t('loading.repairing')} />;
  }

  if (bootstrap.phase === 'error') {
    const error = bootstrap.query.error;
    const title =
      error?.code === 'MR_BRIDGE_UNAVAILABLE'
        ? t('error.bridgeUnavailable.title')
        : error?.code === 'MR_CONTRACT_MISMATCH'
          ? t('error.updateRequired.title')
          : t('error.unexpected.title');
    const effect =
      error?.code === 'MR_BRIDGE_UNAVAILABLE'
        ? t('error.bridgeUnavailable.effect')
        : error?.code === 'MR_CONTRACT_MISMATCH'
          ? t('error.updateRequired.effect')
          : t('error.unexpected.effect');

    return (
      <ErrorState
        testID={testIds.appShell.startupError}
        title={title}
        effect={effect}
        recoveryAction={{
          label: t('action.retry'),
          onPress: () => bootstrap.query.refetch(),
        }}
        diagnosticCode={error?.correlationId}
      />
    );
  }

  return <>{children}</>;
}
