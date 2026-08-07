/**
 * Preferences read/write, paired so a settings screen never gets out of sync
 * with what it just wrote: the mutation's `onSuccess` seeds the query cache
 * directly with the server-confirmed value instead of triggering a refetch.
 */


import {useAppMutation, type AppMutationResult} from './useAppMutation';
import {useAppQuery, type AppQueryResult} from './useAppQuery';
import {useAppQueryClient} from './useAppQueryClient';
import {useAppContainer} from '../app/di';
import {queryKeys, unwrapResult} from '../core/state';
import type {PreferencePatch, PreferencesSnapshot} from '../native-client/types';

export const usePreferences = (): AppQueryResult<PreferencesSnapshot> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.preferences(),
    queryFn: () => unwrapResult(() => repositories.settings.read()),
    staleTime: Infinity,
  });
};

export const useUpdatePreferences = (): AppMutationResult<
  PreferencesSnapshot,
  PreferencePatch
> => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();

  return useAppMutation<PreferencesSnapshot, PreferencePatch>({
    mutationFn: patch => unwrapResult(() => repositories.settings.update(patch)),
    onSuccess: snapshot => {
      queryClient.setQueryData(queryKeys.preferences(), snapshot);
    },
  });
};
