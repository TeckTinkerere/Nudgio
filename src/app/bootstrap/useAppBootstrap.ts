/**
 * Cold-startup sequencing (MR-07 "Startup sequence", steps 3-6).
 *
 * Step 1 (Android creates MainActivity/RN host) and step 2 (native repair
 * reconciler) happen before JS runs at all. From here:
 *
 *  3. render a fast shell using the DataStore theme — `AppProviders` already
 *     does this by rendering children immediately under a best-guess theme;
 *  4. request the `StartupSnapshot` — this hook's job;
 *  5. a long repair surfaces as a dedicated state, not a blocked splash;
 *  6. the scheduler reconciles only if needed — server-side, not observed here.
 *
 * "Cold startup does not enumerate or hash the full media library" is a
 * Kotlin-side invariant; nothing in this hook requests a media list.
 */
import {useStartupSnapshot} from '../../hooks';
import type {AppQueryResult} from '../../hooks';
import type {StartupSnapshot} from '../../native-client/types';

export type BootstrapPhase = 'loading' | 'repairing' | 'ready' | 'error';

export interface AppBootstrap {
  readonly phase: BootstrapPhase;
  readonly snapshot: StartupSnapshot | undefined;
  readonly query: AppQueryResult<StartupSnapshot>;
}

export const useAppBootstrap = (): AppBootstrap => {
  const query = useStartupSnapshot();

  // `isPending`, not `isLoading`: the latter is a derived convenience flag in
  // React Query v5 and does not narrow `query.data`.
  const phase: BootstrapPhase = query.isError
    ? 'error'
    : query.isPending
      ? 'loading'
      : query.data.repair.inProgress
        ? 'repairing'
        : 'ready';

  return {phase, snapshot: query.data, query};
};
