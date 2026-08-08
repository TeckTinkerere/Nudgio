/**
 * MR-03 "Edit details" (rename/notes) mutation.
 *
 * Write-through-cache on success, same pattern `useSaveReminder` uses: the
 * native call already returns the authoritative, version-bumped
 * `MediaDetail`, so seeding the detail cache with it directly avoids a
 * refetch flicker. The list is invalidated rather than patched, since a
 * rename can move the item under `sort: 'name'`.
 */
import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppMutation, useAppQueryClient} from '../../hooks';
import type {MediaDetail, UpdateMediaRequest} from '../../native-client/types';

export const useUpdateMedia = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();

  return useAppMutation<MediaDetail, UpdateMediaRequest>({
    mutationFn: request => unwrapResult(() => repositories.media.update(request)),
    onSuccess: updated => {
      queryClient.setQueryData(queryKeys.media.detail(updated.id), updated);
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.media.all()});
    },
  });
};
