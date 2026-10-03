/**
 * Navigation route names.
 *
 * Centralized so a rename is a one-file edit and so `RootNavigator`'s param
 * list and every `navigation.navigate()` call reference the same literal
 * type instead of hand-typed strings that can drift apart.
 */
export const rootRoutes = {
  onboarding: 'Onboarding',
  tabs: 'Tabs',
  mediaDetail: 'MediaDetail',
  editMediaAsset: 'EditMediaAsset',
  reminderDetail: 'ReminderDetail',
  reminderEditor: 'ReminderEditor',
  selectMedia: 'SelectMedia',
  health: 'Health',
  backup: 'Backup',
  import: 'Import',
  statistics: 'Statistics',
  about: 'About',
} as const;

/**
 * Three destinations, not four. "Upcoming" and "Reminders" were two views of
 * the same objects — the landing one was empty whenever nothing happened to
 * fall inside its 5-day window — so they are now one `Home`. See
 * `features/home/HomeScreen.tsx`.
 */
export const tabRoutes = {
  home: 'Home',
  library: 'Library',
  settings: 'Settings',
} as const;

export type RootRouteName = (typeof rootRoutes)[keyof typeof rootRoutes];
export type TabRouteName = (typeof tabRoutes)[keyof typeof tabRoutes];
