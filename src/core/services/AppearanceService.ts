/**
 * Resolves everything the theme needs from persisted settings and the platform.
 *
 * This is the seam between `core` (which owns settings) and `design-system`
 * (which owns the theme but is forbidden from reading a repository). The app
 * layer calls this and feeds the result into `<ThemeProvider>` as props.
 */
import type {MediaReminderClient} from '../../native-client/MediaReminderClient';
import {appConfig} from '../config/appConfig';
import type {Logger} from '../logging';
import type {SettingsRepository} from '../repositories/types';

/**
 * Mirrors `design-system/theme` without importing it: `core` must not depend
 * on the UI layer. The shapes are structurally compatible, and the app layer
 * is where the two meet.
 */
export type AppearancePreference = 'system' | 'light' | 'dark';

export interface AppearanceState {
  readonly preference: AppearancePreference;
  readonly useMaterialYou: boolean;
  /** Raw ramps from the platform, or `null` when unavailable. */
  readonly dynamicColor: unknown | null;
  /** False below API 31 — the Settings toggle is hidden rather than disabled. */
  readonly dynamicColorSupported: boolean;
}

export interface AppearanceService {
  load(): Promise<AppearanceState>;
  setPreference(preference: AppearancePreference): Promise<AppearanceState>;
  setUseMaterialYou(enabled: boolean): Promise<AppearanceState>;
}

export interface AppearanceServiceDeps {
  readonly settings: SettingsRepository;
  readonly client: MediaReminderClient;
  readonly logger: Logger;
  /** Platform API level. Injected so the branch is testable without a device. */
  readonly apiLevel: number;
}

export const createAppearanceService = (
  deps: AppearanceServiceDeps,
): AppearanceService => {
  const {settings, client, logger, apiLevel} = deps;
  const dynamicColorSupported = apiLevel >= appConfig.platform.dynamicColorMinSdk;

  /**
   * Fetch the wallpaper ramps only when they will actually be used. Reading
   * them on every launch would cost a bridge round trip for the majority of
   * users, who are on the default brand palette (MR-04).
   */
  const loadDynamicColor = async (useMaterialYou: boolean): Promise<unknown | null> => {
    if (!useMaterialYou || !dynamicColorSupported) {
      return null;
    }
    const result = await client.getDynamicColorScheme();
    if (!result.ok) {
      // Falling back to the brand palette is always safe and is what a
      // pre-API-31 device does anyway.
      logger.warn('appearance.dynamicColorUnavailable', {code: result.error.code});
      return null;
    }
    return result.value;
  };

  const build = async (
    preference: AppearancePreference,
    useMaterialYou: boolean,
  ): Promise<AppearanceState> => ({
    preference,
    useMaterialYou,
    dynamicColor: await loadDynamicColor(useMaterialYou),
    dynamicColorSupported,
  });

  return {
    load: async () => {
      const result = await settings.read();
      if (!result.ok) {
        return build('system', false);
      }
      return build(result.value.themePreference, result.value.useMaterialYou);
    },

    setPreference: async preference => {
      const result = await settings.update({themePreference: preference});
      const useMaterialYou = result.ok ? result.value.useMaterialYou : false;
      return build(preference, useMaterialYou);
    },

    setUseMaterialYou: async enabled => {
      const result = await settings.update({useMaterialYou: enabled});
      const preference = result.ok ? result.value.themePreference : 'system';
      return build(preference, enabled);
    },
  };
};
