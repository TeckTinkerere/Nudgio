import {useAppContainer} from '../../app/di';
import {unwrapResult} from '../../core/state';
import {useAppMutation} from '../../hooks';
import type {MutationResult, UUID} from '../../native-client/types';

/** A Library selection: media chosen one by one, and whole folders. */
export interface LibrarySelectionRequest {
  readonly mediaIds: readonly UUID[];
  readonly folderIds: readonly UUID[];
}

/**
 * Library "Share". One file goes to the OS share sheet as is; two or more
 * files, or any folder, become one zip with the folder structure kept. The
 * zipping happens natively, so there is nothing to cache or invalidate here.
 */
export const useShareLibrarySelection = () => {
  const {repositories} = useAppContainer();

  return useAppMutation<MutationResult, LibrarySelectionRequest>({
    mutationFn: ({mediaIds, folderIds}) =>
      unwrapResult(() => repositories.media.shareSelection(mediaIds, folderIds)),
  });
};
