/**
 * Bridge-backed repository implementations.
 *
 * Each is a thin adapter. They are grouped in one factory because they share a
 * single client instance and are always constructed together — splitting them
 * across six files would add ceremony without adding a seam anyone uses.
 */
import type {
  BackupRepository,
  CapabilityRepository,
  MediaRepository,
  ProfileRepository,
  ReminderRepository,
  SettingsRepository,
  StartupRepository,
} from './types';
import type {MediaReminderClient} from '../../native-client/MediaReminderClient';
import type {PreferencesStore} from '../storage/PreferencesStore';


export interface Repositories {
  readonly startup: StartupRepository;
  readonly media: MediaRepository;
  readonly reminders: ReminderRepository;
  readonly profiles: ProfileRepository;
  readonly capability: CapabilityRepository;
  readonly settings: SettingsRepository;
  readonly backup: BackupRepository;
}

export interface CreateRepositoriesDeps {
  readonly client: MediaReminderClient;
  readonly preferences: PreferencesStore;
}

export const createRepositories = (deps: CreateRepositoriesDeps): Repositories => {
  const {client, preferences} = deps;

  return {
    startup: {
      getSnapshot: () => client.getStartupSnapshot(),
    },

    media: {
      list: query => client.listMedia(query),
      get: id => client.getMedia(id),
      pickDocument: mimeTypes => client.pickDocument(mimeTypes),
      beginImport: request => client.beginMediaImport(request),
      update: request => client.updateMedia(request),
      remove: request => client.deleteMedia(request),
      exportSelected: ids => client.exportMediaAssets(ids),
      cancelOperation: id => client.cancelOperation(id),
    },

    reminders: {
      list: () => client.listReminders(),
      get: id => client.getReminder(id),
      save: request => client.saveReminder(request),
      setEnabled: (id, enabled) => client.setReminderEnabled(id, enabled),
      remove: id => client.deleteReminder(id),
      scheduleTest: request => client.scheduleTestReminder(request),
      play: (sessionId, nonce) => client.playDueSession(sessionId, nonce),
      snooze: (sessionId, minutes, nonce) => client.snoozeDueSession(sessionId, minutes, nonce),
      dismiss: (sessionId, nonce) => client.dismissDueSession(sessionId, nonce),
    },

    profiles: {
      list: () => client.listProfiles(),
    },

    capability: {
      getSnapshot: () => client.getCapabilitySnapshot(),
      requestNotificationPermission: () => client.requestNotificationPermission(),
      openSettings: kind => client.openCapabilitySettings(kind),
    },

    settings: {
      // Preferences route through the store, not the client, so the
      // last-known-good degradation lives in exactly one place.
      read: () => preferences.read(),
      update: patch => preferences.write(patch),
    },

    backup: {
      beginExport: request => client.beginExport(request),
      shareBackupExport: fileName => client.shareBackupExport(fileName),
      inspectBackup: uriToken => client.inspectBackup(uriToken),
      commitImport: request => client.commitImport(request),
      cancelOperation: id => client.cancelOperation(id),
    },
  };
};
