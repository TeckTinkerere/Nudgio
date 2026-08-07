/**
 * Stable `testID` values.
 *
 * MR-18 requires component semantics and manual/visual state evidence with
 * every UI change. Centralizing IDs here means a component-test and an
 * accessibility-tree assertion reference the same constant instead of a
 * string literal that can silently diverge between the component and its test.
 */
export const testIds = {
  today: {
    screen: 'today.screen',
    nextReminderCard: 'today.nextReminderCard',
    capabilityBanner: 'today.capabilityBanner',
    emptyState: 'today.emptyState',
  },
  library: {
    screen: 'library.screen',
    searchField: 'library.searchField',
    grid: 'library.grid',
  },
  reminders: {
    screen: 'reminders.screen',
    list: 'reminders.list',
  },
  settings: {
    screen: 'settings.screen',
    themeRow: 'settings.themeRow',
    materialYouToggle: 'settings.materialYouToggle',
    strongerHapticsToggle: 'settings.strongerHapticsToggle',
  },
  onboarding: {
    screen: 'onboarding.screen',
    continueButton: 'onboarding.continueButton',
  },
  appShell: {
    startupLoading: 'appShell.startupLoading',
    startupError: 'appShell.startupError',
  },
} as const;
