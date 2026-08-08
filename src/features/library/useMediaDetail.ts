import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppQuery, type AppQueryResult} from '../../hooks/useAppQuery';
import type {MediaDetail, UUID} from '../../native-client/types';

/**
 * Real, Room-backed media detail (MR-08 `getMedia`). Replaces
 * `findMockMedia`, which could never resolve a real imported item's UUID —
 * every real import shows "not found" until a screen reads from here instead.
 */
export const useMediaDetail = (id: UUID): AppQueryResult<MediaDetail> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.media.detail(id),
    queryFn: () => unwrapResult(() => repositories.media.get(id)),
  });
};
