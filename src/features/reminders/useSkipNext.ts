/**
 * "Skip next" for a repeating reminder (DL-110), and its undo.
 *
 * One exception without switching the reminder off: native resolves the
 * next occurrence as skipped and schedules the one after. Same invalidate-
 * rather-than-patch rule as `useSetReminderEnabled`, since Home's "next
 * moment" can change.
 */
import {useAppContainer} from '../../app/di';
import {useToast} from '../../app/toast/ToastProvider';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppMutation, useAppQueryClient} from '../../hooks';
import {useTranslation} from '../../localization';
import type {EnableResult, UUID} from '../../native-client/types';

export interface SkipNextRequest {
  readonly id: UUID;
  readonly skip: boolean;
}

export const useSkipNext = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();
  const {showToast} = useToast();
  const t = useTranslation();

  return useAppMutation<EnableResult, SkipNextRequest>({
    mutationFn: ({id, skip}) => unwrapResult(() => repositories.reminders.skipNext(id, skip)),
    onSuccess: () => {
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.reminders.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
    },
    onError: () => {
      showToast({message: t('reminders.skip.error'), tone: 'error'});
    },
  });
};
