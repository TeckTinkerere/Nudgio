/**
 * Preferences storage.
 *
 * MR-07 assigns "Theme and lightweight preferences" to DataStore, owned by the
 * native settings repository. So this store does not persist anything itself —
 * it is a typed facade over the bridge.
 *
 * Keeping it behind an interface means a screen never learns whether a
 * preference came from DataStore, from a cached snapshot or from a test
 * double, and there is exactly one place that knows the difference.
 */
import type {PreferencePatch, PreferencesSnapshot} from '../../native-client/types';
import type {AppError} from '../errors';
import type {Result} from '../result/Result';

export interface PreferencesStore {
  read(): Promise<Result<PreferencesSnapshot, AppError>>;
  /**
   * Applies a partial update and returns the full resulting snapshot.
   *
   * Patch semantics matter: two settings screens writing different keys must
   * not clobber each other, which a read-modify-write of the whole object
   * would allow.
   */
  write(patch: PreferencePatch): Promise<Result<PreferencesSnapshot, AppError>>;
}

/** Sensible startup values used before the first successful read. */
export const defaultPreferences: PreferencesSnapshot = {
  themePreference: 'system',
  // MR-04: the fixed brand palette is the default; Material You is opt-in.
  useMaterialYou: false,
  // `null` means "follow the device", per MR-13's 12/24-hour rule.
  use24HourTime: null,
  languageTag: null,
  hasCompletedOnboarding: false,
  defaultSnoozeMinutes: 10,
};
