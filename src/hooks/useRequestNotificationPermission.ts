import {useAppMutation} from './useAppMutation';
import {useAppQueryClient} from './useAppQueryClient';
import {useAppContainer} from '../app/di';
import {queryKeys, unwrapResult} from '../core/state';
import type {NotificationPermissionResult} from '../native-client/types';

/**
 * Health screen's `request_runtime` action — the user-triggered counterpart
 * to `useRequestNotificationPermissionOnLaunch`'s one-shot launch prompt.
 * Re-prompting is safe: the OS dialog itself is a no-op once already
 * granted, and Android simply won't show it again once the user has denied
 * it twice, sending them straight to Settings instead (the same
 * `request_runtime` action then just becomes indistinguishable from a no-op
 * tap — no separate "denied forever" state exists on the JS side to detect
 * that and swap in `open_special_access` yet).
 */
export const useRequestNotificationPermission = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();

  return useAppMutation<NotificationPermissionResult, void>({
    mutationFn: () => unwrapResult(() => repositories.capability.requestNotificationPermission()),
    onSuccess: () => {
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.capability()});
    },
  });
};
