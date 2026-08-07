/**
 * Keys for the disposable view-state store.
 *
 * Namespaced and centralized so two features cannot collide on a bare string,
 * and so it is obvious at a glance that nothing here is user data — every one
 * of these can be lost without consequence.
 */
export const viewStateKeys = {
  libraryFilter: 'view.library.filter',
  librarySort: 'view.library.sort',
  libraryViewMode: 'view.library.mode',
  remindersFilter: 'view.reminders.filter',
  settingsExpandedSections: 'view.settings.expandedSections',
  todayCollapsedHealthy: 'view.today.collapsedHealthy',
  /**
   * MR-13 "stronger haptics toggle where supported". Local-only (not the
   * native DataStore-backed `PreferencesSnapshot`): it is a cosmetic
   * intensity switch, not user data, so it can live in the disposable
   * view-state store instead of requiring a bridge/schema change.
   */
  strongerHaptics: 'view.settings.strongerHaptics',
} as const;

export type ViewStateKey = (typeof viewStateKeys)[keyof typeof viewStateKeys];
