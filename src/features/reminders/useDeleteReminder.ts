import {useAppContainer} from '../../app/di';
import {useToast} from '../../app/toast/ToastProvider';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppMutation, useAppQueryClient} from '../../hooks';
import {useTranslation} from '../../localization';
import type {MutationResult, UUID} from '../../native-client/types';

/**
 * `ReminderDetailScreen`'s Delete confirm previously only closed the dialog
 * and navigated back — nothing was ever actually removed, so the reminder
 * reappeared the next time the list refetched (docs/decision-log.md).
 */
export const useDeleteReminder = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();
  const {showToast} = useToast();
  const t = useTranslation();

  return useAppMutation<MutationResult, UUID>({
    mutationFn: id => unwrapResult(() => repositories.reminders.remove(id)),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({queryKey: queryKeys.reminders.detail(id)});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.reminders.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
      showToast({message: t('reminders.detail.deleteSuccess'), tone: 'success'});
    },
  });
};
