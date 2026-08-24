import {useEffect} from 'react';
import {AppState} from 'react-native';

import {useAppQuery, type AppQueryResult} from './useAppQuery';
import {useAppQueryClient} from './useAppQueryClient';
import {useAppContainer} from '../app/di';
import {queryKeys, unwrapResult} from '../core/state';
import type {CapabilitySnapshot} from '../native-client/types';

/**
 * MR-03 Health screen, the Today capability banner and the reminder editor's
 * pre-save permission checks all share this query.
 *
 * Refetched on every foreground transition, not just when `staleTime`
 * lapses. Every capability here is changed *outside* the app — the user
 * leaves for a system Settings screen, flips exact-alarm or notifications,
 * and comes back — and Android gives us no change broadcast for any of it.
 * Without this the editor kept nagging "exact alarm access is off" for up to
 * `staleTime` after the user had just granted it, which reads as the app not
 * believing them. `AppState` returning to `active` is the one signal that
 * reliably brackets that round trip.
 */
export const useCapabilitySnapshot = (): AppQueryResult<CapabilitySnapshot> => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();

  const query = useAppQuery({
    queryKey: queryKeys.capability(),
    queryFn: () => unwrapResult(() => repositories.capability.getSnapshot()),
    staleTime: 15_000,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        return;
      }
      // `invalidateQueries`, not `refetch()`: the startup snapshot embeds its
      // own copy of the capability rollup, so both have to be re-read or the
      // Upcoming banner and the Health rows disagree with each other.
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.capability()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
    });
    return () => subscription.remove();
  }, [queryClient]);

  return query;
};
