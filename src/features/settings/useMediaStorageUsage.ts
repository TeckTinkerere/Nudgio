import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppQuery, type AppQueryResult} from '../../hooks/useAppQuery';
import type {MediaStorageUsage} from '../../native-client/types';

/**
 * What Nudgio's own media copies cost on disk.
 *
 * Keyed under `queryKeys.media` so it is refreshed by the same
 * `invalidateQueries(media.all())` every import and delete already fires —
 * the figure would otherwise go stale the moment the user imported anything,
 * which is precisely when they would look at it.
 */
export const useMediaStorageUsage = (): AppQueryResult<MediaStorageUsage> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.media.storage(),
    queryFn: () => unwrapResult(() => repositories.media.storageUsage()),
  });
};
