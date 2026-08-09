/**
 * Prompts for notification permission once, right after cold startup
 * resolves — the same "ask at launch" pattern most Android apps already
 * follow, rather than leaving the user to discover a blocked-notifications
 * banner and hunt for the right Settings screen themselves.
 *
 * Exact-alarm access has no equivalent runtime dialog (Android only offers a
 * Settings deep link for it — MR-06's `open_special_access` action, not
 * `request_runtime`), so this hook only ever triggers the one capability
 * that actually has an OS permission dialog behind it.
 */
import {useEffect, useRef} from 'react';

import {queryKeys} from '../../core/state';
import {useAppQueryClient} from '../../hooks';
import type {StartupSnapshot} from '../../native-client/types';
import {useAppContainer} from '../di';

export const useRequestNotificationPermissionOnLaunch = (
  snapshot: StartupSnapshot | undefined,
): void => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();
  const requested = useRef(false);

  useEffect(() => {
    if (!snapshot || requested.current) {
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
  }, [snapshot, repositories, queryClient]);
};
