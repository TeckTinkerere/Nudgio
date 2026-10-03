import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppMutation, useAppQueryClient} from '../../hooks';
import type {ByteCount, ImportToken, MediaDetail, UUID} from '../../native-client/types';

export interface ReplaceMediaOutcome {
  readonly status: 'replaced' | 'noSelection';
  readonly media?: MediaDetail;
}

/**
 * "Replace media": pick a file, then point an existing record at it.
 *
 * Two bridge calls in one mutation for the same reason `useImportMedia`
 * chains its own — it is one user action, and backing out of the picker
 * (`null`, not an error) has to stay distinguishable from a real failure.
 *
 * Invalidates reminders as well as media: the record keeps its id, so no
 * reminder row changes, but every one of them was showing "Media
 * unavailable" and now is not.
 */
export const useReplaceMediaSource = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();

  return useAppMutation<ReplaceMediaOutcome, UUID>({
    mutationFn: async mediaId => {
      const picked = await unwrapResult(() =>
        repositories.media.pickDocument(['image/*', 'video/*']),
      );
      if (picked === null) {
        return {status: 'noSelection'};
      }
      const media = await unwrapResult(() =>
        repositories.media.replaceSource({
          mediaId,
          sourceUri: picked.uriToken as ImportToken,
          displayName: picked.displayName,
          mimeType: picked.mimeType,
          sizeBytes: picked.sizeBytes as ByteCount | undefined,
        }),
      );
      return {status: 'replaced', media};
    },
    onSuccess: outcome => {
      if (outcome.status !== 'replaced') {
        return;
      }
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.media.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.reminders.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
    },
  });
};
