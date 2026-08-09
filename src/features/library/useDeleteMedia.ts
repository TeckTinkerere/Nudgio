/**
 * Delete-media mutation (MR-03 "Delete") — the confirm button previously
 * only closed the dialog and never called the native side at all, so
 * deleted items stayed on disk and in Room forever (docs/decision-log.md).
 * Invalidates both media and reminders caches: a cascade delete removes
 * reminder rows outright, and even the non-cascade path changes their
 * enabled state, so either way `reminders.all()` can no longer be trusted
 * as-is — same reasoning `useSaveReminder` documents for its own invalidation.
 */
import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppMutation, useAppQueryClient} from '../../hooks';
import type {DeleteMediaRequest, MutationResult} from '../../native-client/types';

export const useDeleteMedia = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();

  return useAppMutation<MutationResult, DeleteMediaRequest>({
    mutationFn: request => unwrapResult(() => repositories.media.remove(request)),
    onSuccess: (_result, request) => {
      queryClient.removeQueries({queryKey: queryKeys.media.detail(request.id)});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.media.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.reminders.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
    },
  });
};
