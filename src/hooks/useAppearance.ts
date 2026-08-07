/**
 * Resolves theme provider props from persisted settings and the platform.
 *
 * This is the seam mentioned in `AppearanceService`: it is the only hook that
 * imports both `core/services` and `design-system/theme` types, so a screen
 * never has to reconcile "preference" (core concept) with "appearance"
 * (design-system concept) itself.
 */
import {useCallback} from 'react';



import {useAppMutation} from './useAppMutation';
import {useAppQuery} from './useAppQuery';
import {useAppQueryClient} from './useAppQueryClient';
import {useAppContainer} from '../app/di';
import type {AppearancePreference} from '../core/services';
import {queryKeys, unwrapResult} from '../core/state';
import {decodeDynamicColorPayload, type ThemePreference} from '../design-system';

export interface ResolvedAppearance {
  readonly preference: ThemePreference;
  readonly useMaterialYou: boolean;
  readonly dynamicColorSupported: boolean;
  readonly dynamicColor: ReturnType<typeof decodeDynamicColorPayload>;
}

const toThemePreference = (value: AppearancePreference): ThemePreference => value;

export const useAppearance = () => {
  const {appearance} = useAppContainer();
  const queryClient = useAppQueryClient();

  const query = useAppQuery({
    queryKey: queryKeys.appearance(),
    queryFn: async (): Promise<ResolvedAppearance> => {
      const state = await appearance.load();
      return {
        preference: toThemePreference(state.preference),
        useMaterialYou: state.useMaterialYou,
        dynamicColorSupported: state.dynamicColorSupported,
        dynamicColor: decodeDynamicColorPayload(state.dynamicColor),
      };
    },
    staleTime: Infinity,
  });

  const setPreference = useAppMutation<ResolvedAppearance, ThemePreference>({
    mutationFn: async preference => {
      const state = await appearance.setPreference(preference);
      return {
        preference: toThemePreference(state.preference),
        useMaterialYou: state.useMaterialYou,
        dynamicColorSupported: state.dynamicColorSupported,
        dynamicColor: decodeDynamicColorPayload(state.dynamicColor),
      };
    },
    onSuccess: next => queryClient.setQueryData(queryKeys.appearance(), next),
  });

  const setUseMaterialYou = useAppMutation<ResolvedAppearance, boolean>({
    mutationFn: async enabled => {
      const state = await appearance.setUseMaterialYou(enabled);
      return {
        preference: toThemePreference(state.preference),
        useMaterialYou: state.useMaterialYou,
        dynamicColorSupported: state.dynamicColorSupported,
        dynamicColor: decodeDynamicColorPayload(state.dynamicColor),
      };
    },
    onSuccess: next => queryClient.setQueryData(queryKeys.appearance(), next),
  });

  return {
    ...query,
    setPreference: useCallback(
      (preference: ThemePreference) => setPreference.mutate(preference),
      [setPreference],
    ),
    setUseMaterialYou: useCallback(
      (enabled: boolean) => setUseMaterialYou.mutate(enabled),
      [setUseMaterialYou],
    ),
  };
};

export {unwrapResult};
