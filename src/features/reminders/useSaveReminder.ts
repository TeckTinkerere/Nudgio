/**
 * Create/update reminder mutation.
 *
 * MR-08: "Save returns native-calculated truth and any DST resolution" — the
 * mutation's result seeds both the reminders list and this reminder's detail
 * cache directly with the server-confirmed value, the same
 * write-through-cache pattern `useUpdatePreferences` uses, rather than
 * triggering a refetch that could momentarily show stale data.
 */
import {useAppContainer} from '../../app/di';
import {useToast} from '../../app/toast/ToastProvider';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppMutation, useAppQueryClient} from '../../hooks';
import {useTranslation} from '../../localization';
import type {SaveReminderRequest, SaveReminderResult} from '../../native-client/types';

export const useSaveReminder = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();
  const {showToast} = useToast();
  const t = useTranslation();

  return useAppMutation<SaveReminderResult, SaveReminderRequest>({
    mutationFn: request => unwrapResult(() => repositories.reminders.save(request)),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(queryKeys.reminders.detail(result.reminder.id), result.reminder);
      // The list and startup snapshot both summarize reminder state
      // (activeReminderCount, nextOccurrence); invalidate rather than
      // hand-patch them, since a save can change sort order and counts in
      // ways a local cache write can't cheaply reproduce. `void` marks the
      // refetch as intentionally fire-and-forget from this handler.
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.reminders.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
      // `variables.id` is only present when editing an existing reminder —
      // absent on the create path (see `SaveReminderRequest`).
      showToast({
        message: t(variables.id ? 'reminders.editor.updateSuccess' : 'reminders.editor.createSuccess'),
        tone: 'success',
      });
    },
  });
};
