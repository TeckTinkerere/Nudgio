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
  reminderDetail: 'ReminderDetail',
  reminderEditor: 'ReminderEditor',
  health: 'Health',
  backup: 'Backup',
  import: 'Import',
  statistics: 'Statistics',
  about: 'About',
} as const;

export const tabRoutes = {
  today: 'Today',
  library: 'Library',
  reminders: 'Reminders',
  settings: 'Settings',
} as const;

export type RootRouteName = (typeof rootRoutes)[keyof typeof rootRoutes];
export type TabRouteName = (typeof tabRoutes)[keyof typeof tabRoutes];
