/**
 * `PreferencesStore` backed by the native DataStore via the bridge.
 *
 * Holds a last-known-good snapshot so that a transient bridge failure degrades
 * to the previous values rather than snapping the UI back to defaults —
 * MR-11's general posture is that a failure leaves current state unchanged.
 */
import type {MediaReminderClient} from '../../native-client/MediaReminderClient';
import type {PreferencePatch, PreferencesSnapshot} from '../../native-client/types';
import type {AppError} from '../errors';
import type {Logger} from '../logging';
import {defaultPreferences, type PreferencesStore} from './PreferencesStore';
import {ok, type Result} from '../result/Result';


export interface NativePreferencesStoreDeps {
  readonly client: MediaReminderClient;
  readonly logger: Logger;
}

export const createNativePreferencesStore = (
  deps: NativePreferencesStoreDeps,
): PreferencesStore => {
  const {client, logger} = deps;
  let lastKnownGood: PreferencesSnapshot = defaultPreferences;

  return {
    read: async (): Promise<Result<PreferencesSnapshot, AppError>> => {
      const result = await client.getPreferences();
      if (result.ok) {
        lastKnownGood = result.value;
        return result;
      }
      // Degrade rather than fail: preferences are cosmetic, and a theme that
      // cannot load must not block the app from rendering.
      logger.warn('preferences.readFailed', {code: result.error.code});
      return ok(lastKnownGood);
    },

    write: async (
      patch: PreferencePatch,
    ): Promise<Result<PreferencesSnapshot, AppError>> => {
      const result = await client.setPreferences(patch);
      if (result.ok) {
        lastKnownGood = result.value;
        return result;
      }
      // A failed write IS surfaced. Silently discarding a setting the user
      // just toggled would be a lie about persisted state.
      logger.error('preferences.writeFailed', {
        code: result.error.code,
        keys: Object.keys(patch).join(','),
      });
      return result;
    },
  };
};

/** Test/preview double. Persists for the lifetime of the object only. */
export const createInMemoryPreferencesStore = (
  initial: Partial<PreferencesSnapshot> = {},
): PreferencesStore => {
  let snapshot: PreferencesSnapshot = {...defaultPreferences, ...initial};

  return {
    read: async () => ok(snapshot),
    write: async patch => {
      snapshot = {...snapshot, ...patch};
      return ok(snapshot);
    },
  };
};
