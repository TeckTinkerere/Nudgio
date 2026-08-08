/**
 * Enable/disable toggle mutation for the Reminders list — previously wired
 * to nothing (`onValueChange={() => undefined}`). Follows `useSaveReminder`'s
 * write-through-cache pattern: the mutation's own result already carries the
 * server-confirmed summary, so the list cache is seeded directly rather than
 * waiting on a refetch the toggle's own optimistic flip would otherwise
 * visually race against.
 */
import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppMutation, useAppQueryClient} from '../../hooks';
import type {EnableResult, UUID} from '../../native-client/types';

export interface SetReminderEnabledRequest {
  readonly id: UUID;
  readonly enabled: boolean;
}

export const useSetReminderEnabled = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();

  return useAppMutation<EnableResult, SetReminderEnabledRequest>({
    mutationFn: ({id, enabled}) => unwrapResult(() => repositories.reminders.setEnabled(id, enabled)),
    onSuccess: () => {
      // Counts/next-occurrence on other rows and the startup snapshot can
      // shift too (e.g. `activeReminderCount`) — invalidate rather than
      // hand-patch, same reasoning `useSaveReminder` documents.
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.reminders.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
    },
  });
};
