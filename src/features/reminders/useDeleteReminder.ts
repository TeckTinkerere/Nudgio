import {useAppContainer} from '../../app/di';
import {useToast} from '../../app/toast/ToastProvider';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppMutation, useAppQueryClient} from '../../hooks';
import {useTranslation} from '../../localization';
import type {ReminderDetail, SaveReminderRequest, UUID} from '../../native-client/types';

/** Everything needed to save the reminder again as new. */
export const restoreRequestFor = (detail: ReminderDetail): SaveReminderRequest => ({
  mediaId: detail.mediaId,
  label: detail.label,
  notes: detail.notes,
  schedule: detail.schedule,
  profileId: detail.profileId,
  snooze: detail.snooze,
  enabledIntent: detail.enabledIntent,
  historyEnabled: detail.historyEnabled,
  action: detail.action,
  mediaStartMs: detail.mediaStartMs ?? null,
});

/**
 * `ReminderDetailScreen`'s Delete confirm previously only closed the dialog
 * and navigated back — nothing was ever actually removed, so the reminder
 * reappeared the next time the list refetched (docs/decision-log.md).
 *
 * Undo (DL-110): the reminder is read just before it is deleted, and the
 * success toast's Undo saves that copy again. It comes back as a new
 * reminder — same media, words, schedule and settings, with its next time
 * recalculated — because the native delete is real and cascades its
 * history. If the read fails the delete still happens, without the Undo.
 */
export const useDeleteReminder = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();
  const {showToast} = useToast();
  const t = useTranslation();

  const refresh = (id?: UUID) => {
    if (id) {
      queryClient.removeQueries({queryKey: queryKeys.reminders.detail(id)});
    }
    // eslint-disable-next-line no-void
    void queryClient.invalidateQueries({queryKey: queryKeys.reminders.all()});
    // eslint-disable-next-line no-void
    void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
  };

  const restore = async (detail: ReminderDetail) => {
    const saved = await repositories.reminders.save(restoreRequestFor(detail));
    refresh();
    showToast(saved.ok
      ? {message: t('reminders.detail.restored'), tone: 'success'}
      : {message: t('reminders.detail.restoreError'), tone: 'error'});
  };

  return useAppMutation<ReminderDetail | null, UUID>({
    mutationFn: async id => {
      const snapshot = await repositories.reminders.get(id);
      await unwrapResult(() => repositories.reminders.remove(id));
      return snapshot.ok ? snapshot.value : null;
    },
    onSuccess: (snapshot, id) => {
      refresh(id);
      showToast({
        message: t('reminders.detail.deleteSuccess'),
        tone: 'success',
        action: snapshot
          ? {
            label: t('library.albums.undo'),
            onPress: () => {
              restore(snapshot).catch(() => undefined);
            },
          }
          : undefined,
      });
    },
    onError: () => {
      showToast({message: t('reminders.detail.deleteError'), tone: 'error'});
    },
  });
};
