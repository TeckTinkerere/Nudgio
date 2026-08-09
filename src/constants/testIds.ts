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
    selectButton: 'library.selectButton',
    backButton: 'library.backButton',
    exportButton: 'library.exportButton',
    deleteButton: 'library.deleteButton',
    editAssetScreen: 'library.editAssetScreen',
    editAssetTitleField: 'library.editAssetTitleField',
    editAssetSaveButton: 'library.editAssetSaveButton',
    emptyState: 'library.emptyState',
  },
  reminders: {
    screen: 'reminders.screen',
    list: 'reminders.list',
    selectMediaScreen: 'reminders.selectMediaScreen',
    selectMediaSearchField: 'reminders.selectMediaSearchField',
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
