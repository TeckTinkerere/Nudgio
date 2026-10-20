import type {LibrarySelectionRequest} from './useShareLibrarySelection';
import {useAppContainer} from '../../app/di';
import {unwrapResult} from '../../core/state';
import {useAppMutation} from '../../hooks';
import type {GallerySaveSummary} from '../../native-client/types';

/**
 * Library "Save to gallery" for a selection: opt-in copies into the Nudgio
 * album, a Library folder becoming a sub-folder. Like the single-item save,
 * an export: Nudgio's own state is unchanged, so nothing to invalidate.
 */
export const useSaveSelectionToGallery = () => {
  const {repositories} = useAppContainer();

  return useAppMutation<GallerySaveSummary, LibrarySelectionRequest>({
    mutationFn: ({mediaIds, folderIds}) =>
      unwrapResult(() => repositories.media.saveSelectionToGallery(mediaIds, folderIds)),
  });
};
