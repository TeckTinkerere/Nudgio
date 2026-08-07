import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppQuery, type AppQueryResult} from '../../hooks/useAppQuery';
import type {MediaQuery, MediaSummary, Page} from '../../native-client/types';

const DEFAULT_QUERY: MediaQuery = {sort: 'recent', offset: 0, limit: 50};

export const useMediaList = (
  query: MediaQuery = DEFAULT_QUERY,
): AppQueryResult<Page<MediaSummary>> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.media.list(query),
    queryFn: () => unwrapResult(() => repositories.media.list(query)),
  });
};
