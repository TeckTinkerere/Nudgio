import {useAppQuery, type AppQueryResult} from './useAppQuery';
import {useAppContainer} from '../app/di';
import {queryKeys, unwrapResult} from '../core/state';
import type {CapabilitySnapshot} from '../native-client/types';



/** MR-03 Health screen and the Today capability banner share this query. */
export const useCapabilitySnapshot = (): AppQueryResult<CapabilitySnapshot> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.capability(),
    queryFn: () => unwrapResult(() => repositories.capability.getSnapshot()),
    staleTime: 15_000,
  });
};
