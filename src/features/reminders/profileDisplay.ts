/**
 * Shared icon/description lookup for the three built-in alert profiles —
 * used by the reminder editor's "Alert style" picker and Settings' "Preview
 * alarm styles" section, which both need to show the same name/description
 * for a given profile.
 */
import type {TranslationKey} from '../../localization';

export const PROFILE_ICON: Record<string, 'notification' | 'reminders' | 'clock'> = {
  'profile.gentle.name': 'notification',
  'profile.standard.name': 'reminders',
  'profile.persistent.name': 'clock',
};

export const PROFILE_DESCRIPTION_KEY: Record<string, TranslationKey> = {
  'profile.gentle.name': 'profile.gentle.description',
  'profile.standard.name': 'profile.standard.description',
  'profile.persistent.name': 'profile.persistent.description',
};
