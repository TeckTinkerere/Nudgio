import {useAppContainer} from '../../app/di';
import {unwrapResult} from '../../core/state';
import {useAppMutation} from '../../hooks';
import type {MutationResult, UUID} from '../../native-client/types';

/** Library "Export selected" — opens the OS share sheet; no cache to invalidate, nothing here changes stored data. */
export const useExportMedia = () => {
  const {repositories} = useAppContainer();

  return useAppMutation<MutationResult, readonly UUID[]>({
    mutationFn: ids => unwrapResult(() => repositories.media.exportSelected(ids)),
  });
};
