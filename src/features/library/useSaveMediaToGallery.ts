import {useAppContainer} from '../../app/di';
import {unwrapResult} from '../../core/state';
import {useAppMutation} from '../../hooks';
import type {MutationResult, UUID} from '../../native-client/types';

/**
 * "Save a copy to gallery" — writes the managed copy into the device's own
 * media collections under a Nudgio folder.
 *
 * Nothing to invalidate: this is an export. The managed copy stays the
 * reminder's source of truth, so Nudgio's own state is unchanged by it (see
 * `MediaStoreExporter` for why the export is deliberately one-directional).
 */
export const useSaveMediaToGallery = () => {
  const {repositories} = useAppContainer();

  return useAppMutation<MutationResult, UUID>({
    mutationFn: id => unwrapResult(() => repositories.media.saveCopyToGallery(id)),
  });
};
