import type {ThemePreference} from '../../design-system';
import {useAppearance} from '../../hooks';

export interface AppearanceSettings {
  readonly preference: ThemePreference;
  readonly useMaterialYou: boolean;
  readonly dynamicColorSupported: boolean;
  readonly setPreference: (preference: ThemePreference) => void;
  readonly setUseMaterialYou: (enabled: boolean) => void;
}

/**
 * Thin feature-local adapter over `useAppearance()`.
 *
 * Exists so `SettingsScreen` depends on a settings-shaped interface rather
 * than reaching into the shared hook's query-result shape directly — the
 * screen does not need `isLoading`/`isError` because a missing appearance
 * query degrades to the safe defaults `useAppearance` already provides.
 */
export const useAppearanceSettings = (): AppearanceSettings => {
  const appearance = useAppearance();

  return {
    preference: appearance.data?.preference ?? 'system',
    useMaterialYou: appearance.data?.useMaterialYou ?? false,
    dynamicColorSupported: appearance.data?.dynamicColorSupported ?? false,
    setPreference: appearance.setPreference,
    setUseMaterialYou: appearance.setUseMaterialYou,
  };
};
