/**
 * ADR-018: the three built-in reminder profiles (Gentle/Standard/Persistent)
 * persist a localization key in `nameKey`, never a display string (MR-13).
 * A custom, user-defined profile stores free text there instead — this is
 * the one shared place that distinguishes the two cases, used by every
 * screen that renders a profile's name (`ReminderDetailScreen`,
 * `ReminderEditorScreen`, `SettingsScreen`) instead of each screen
 * redeclaring the same set and type guard.
 */
import type {TranslationKey} from '../localization';

export const BUILT_IN_PROFILE_NAME_KEYS: ReadonlySet<string> = new Set([
  'profile.gentle.name',
  'profile.standard.name',
  'profile.persistent.name',
]);

export const isBuiltInProfileNameKey = (value: string): value is TranslationKey =>
  BUILT_IN_PROFILE_NAME_KEYS.has(value);
