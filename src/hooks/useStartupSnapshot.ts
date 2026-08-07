/**
 * The startup snapshot query.
 *
 * MR-07 step 4: "UI requests a StartupSnapshot from the native module: counts,
 * next occurrence, capability summary, repair state and schema version."
 * Every screen that needs a top-level number (media count, next occurrence)
 * reads it from this one cached query rather than issuing its own bridge call,
 * so they can never disagree within a render.
 */
import {useAppQuery, type AppQueryResult} from './useAppQuery';
import {useAppContainer} from '../app/di';
import {queryKeys, unwrapResult} from '../core/state';
import type {StartupSnapshot} from '../native-client/types';



export const useStartupSnapshot = (): AppQueryResult<StartupSnapshot> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.startup(),
    queryFn: () => unwrapResult(() => repositories.startup.getSnapshot()),
    // The snapshot is cheap and foundational; a short stale time keeps Today's
    // capability banner reasonably fresh without polling (ADR-007).
    staleTime: 15_000,
  });
};
