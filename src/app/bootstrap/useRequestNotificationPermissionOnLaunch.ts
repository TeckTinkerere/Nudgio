/**
 * Prompts for notification permission once, right after cold startup
 * resolves — the catch-up path for users who already finished onboarding
 * (upgraders, or anyone who revoked the permission later), rather than
 * leaving them to discover a blocked-notifications banner and hunt for the
 * right Settings screen themselves.
 *
 * Deliberately silent until `hasCompletedOnboarding` is true: onboarding now
 * owns the first ask, as its own explained step with a visible status row
 * (`OnboardingScreen`'s permissions page). Firing here too would throw the
 * bare OS dialog at a first-run user *before* they have been told what it is
 * for — and worse, Android only ever shows that dialog twice, so spending
 * one of those on an unexplained prompt is not recoverable.
 *
 * Exact-alarm access has no equivalent runtime dialog (Android only offers a
 * Settings deep link for it — MR-06's `open_special_access` action, not
 * `request_runtime`), so this hook only ever triggers the one capability
 * that actually has an OS permission dialog behind it.
 */
import {useEffect, useRef} from 'react';

import {queryKeys} from '../../core/state';
import {useAppQueryClient, usePreferences} from '../../hooks';
import type {StartupSnapshot} from '../../native-client/types';
import {useAppContainer} from '../di';

export const useRequestNotificationPermissionOnLaunch = (
  snapshot: StartupSnapshot | undefined,
): void => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();
  const preferences = usePreferences();
  const hasCompletedOnboarding = preferences.data?.hasCompletedOnboarding ?? false;
  const requested = useRef(false);

  useEffect(() => {
    if (!snapshot || requested.current || !hasCompletedOnboarding) {
      return;
    }
    const notifications = snapshot.capability.items.find(item => item.kind === 'notifications');
    if (!notifications || notifications.status === 'ready') {
      return;
    }

    requested.current = true;
    // eslint-disable-next-line no-void
    void repositories.capability.requestNotificationPermission().then(() => {
      // Refetch rather than patch: a granted permission changes both this
      // item's status and the snapshot's overall `needs_action`/`ok` rollup.
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.capability()});
    });
  }, [snapshot, repositories, queryClient, hasCompletedOnboarding]);
};
