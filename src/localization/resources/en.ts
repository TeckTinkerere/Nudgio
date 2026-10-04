/**
 * Base (English) string resource.
 *
 * This is the source of truth for `TranslationKey`. A translator comment sits
 * above any entry with a placeholder or plural form (MR-13: "translator
 * comments for placeholders"). Nothing here concatenates two keys into a
 * sentence — each entry is a complete, grammatical sentence or label.
 *
 * Copy follows MR-03 "Copy style": concise, respectful, no "failure" language
 * for a disabled setting, no idioms.
 */
export const en = {
  // --- Navigation (MR-03) ----------------------------------------------------
  // Internal route key stays `Today` (`tabRoutes.today`) — only the visible
  // label changed, so navigation state/deep links/tests keyed on the route
  // name are unaffected.
  'nav.home': 'Home',
  'nav.library': 'Library',
  'nav.settings': 'Settings',
  'nav.newReminder': 'New reminder',

  // --- Onboarding --------------------------------------------------------------
  'onboarding.purpose.title': 'Your own media, at the moment it matters',
  'onboarding.purpose.body':
    'Choose a photo, video or sound from your phone and Nudgio brings it back when you need it. Everything stays on this phone.',
  'onboarding.purpose.continue': 'Continue',
  'onboarding.purpose.privacyDetails': 'View privacy details',
  'onboarding.adaptive.title': 'It shows up the way you need it to',
  'onboarding.adaptive.body':
    'When your phone is locked, a reminder can open like an alarm. While you are using your phone, Android shows a compact notification instead.',
  // The pre-permission primer. Shown immediately before the OS notification
  // dialog, which Android will only ever show twice — so the ask is explained
  // first, while a decline here costs nothing and can be retried later.
  //
  // Translator note: deliberately singular. Exact-alarm timing is granted at
  // install on Android 13+ (`USE_EXACT_ALARM`), so on most devices
  // notifications are the only thing left to ask for. The review step below
  // lists whatever is genuinely still outstanding.
  'onboarding.primer.title': 'One thing before we start',
  'onboarding.primer.body':
    'Nudgio needs your permission to show reminders. Without it a reminder still runs on time — it just cannot reach you when it does.',
  'onboarding.primer.allow': 'Allow notifications',
  'onboarding.permissions.title': 'Let your reminders reach you',
  'onboarding.permissions.body':
    'Nudgio needs these to alert you at the right moment. You can continue without them and grant them later in Settings — reminders just may be late or silent until you do.',
  'onboarding.permissions.allSet':
    'All set. Nudgio can reach you when a reminder is due.',
  'onboarding.start': 'Create my first reminder',
  'onboarding.exploreFirst': 'Explore first',
  'onboarding.back': 'Back',
  'onboarding.skip': 'Skip',
  // Translator note: {current}/{total} are 1-based page numbers, e.g. "1 of 3".
  'onboarding.pageIndicator': '{current} of {total}',

  // --- Upcoming (formerly "Today" — internal keys/route unchanged, MR-03) ----
  'today.title': 'Upcoming',
  'today.status.ready': 'Ready',
  'today.status.actionNeeded': 'Action needed',
  'today.status.limitedTiming': 'Limited timing',
  'today.empty.title': 'Your first reminder',
  'today.empty.body':
    'Pick a photo, video or sound that means something to you, and choose when it should come back.',
  'today.empty.createReminder': 'Create a reminder',
  'today.empty.importMedia': 'Import media',
  'today.empty.createTextCard': 'Create reminder from a text card',
  'today.capability.exactTimingOff.title': 'Exact timing is off',
  'today.capability.exactTimingOff.effect': 'Android may deliver reminders later.',
  'today.capability.notificationsOff.title': 'Notifications are off',
  'today.capability.notificationsOff.effect':
    'Reminders will still run on time, but Nudgio cannot show them until you turn notifications on.',
  'today.capability.openSettings': 'Open settings',
  'today.capability.openHealth': 'Open Health',
  // Translator note: {count} is a plain integer.
  'today.activeReminderCount': '{count} active reminders',
  'home.title': 'Nudgio',
  'home.section.next': 'Next',
  'home.section.all': 'All reminders',
  'home.next.preview': 'Preview',
  'home.next.previewFor': 'Preview what {label} will show',
  'home.next.opensAfter': 'Opens a link afterwards',
  'home.empty.noneScheduledTitle': 'Nothing scheduled',
  'home.empty.noneScheduledBody':
    'Every reminder below is paused or finished. Turn one back on, or create a new one.',
  'home.empty.mediaMissingTitle': 'Some media is missing',
  'home.empty.mediaMissingBody':
    "Nudgio can't find the media for {count} of your reminders, so they've stopped. Open one to pick new media or remove it.",
  'today.nextReminder': 'Next reminder',
  'today.nextReminder.todayAt': 'Today at {time}',
  'today.nextReminder.tomorrowAt': 'Tomorrow at {time}',
  'today.nextReminder.weekdayAt': '{weekday} at {time}',
  // The date-section heading text itself, not the page title — spec:
  // "Do not rename date-section headings. The first schedule section should
  // still be called TODAY." Rendered visually upper-cased; the base string
  // stays sentence case for screen readers/other locales.
  // Translator note: {label} is the reminder title, {time} an already-formatted time.

  // --- Library ---------------------------------------------------------------
  'library.title': 'Library',
  // --- Library albums (DL-081) -------------------------------------------------
  'library.albums.tab': 'Albums',
  'library.albums.new': 'New album',
  // Translator note: {name} is an album name.
  'library.albums.newInside': 'New album in {name}',
  'library.albums.newSubtitle': 'Group your media the way you think about it',
  'library.albums.newUnavailable':
    'Albums go one level deep, so this album cannot hold more albums.',
  'library.albums.nameLabel': 'Album name',
  'library.albums.namePlaceholder': 'Family, Workouts, Lessons',
  // Translator note: {name} is the album just created.
  'library.albums.created': 'Created {name}.',
  // Translator note: {count} is a plain integer, 2 or more.
  'library.albums.subCount': '{count} albums',
  'library.albums.subCountOne': '1 album',
  'library.albums.options': 'Options for {name}',
  'library.albums.pin': 'Pin to top',
  'library.albums.moveAlbum': 'Move album',
  'library.albums.delete': 'Delete album',
  // Translator note: {name} is an album name.
  'library.albums.deleteOneTitle': 'Delete "{name}"?',
  'library.albums.deleteAlbumBody':
    'Only the album goes. Everything in it stays in your library, back in Unsorted or the album above it.',
  'library.albums.moveTo': 'Move to',
  'library.albums.moveHint':
    'Albums hold one level of albums. Greyed-out places would nest deeper.',
  'library.albums.searchAlbums': 'Search albums',
  'library.albums.topLevel': 'Library',
  'library.albums.topLevelDetail': 'Not inside another album',
  'library.albums.unsortedDetail': 'Not in any album',
  // Translator note: {count} is a plain integer; {name} an album name or "Unsorted".
  'library.albums.moved': 'Moved {count} items to {name}.',
  'library.albums.movedOne': 'Moved 1 item to {name}.',
  'library.albums.undo': 'Undo',
  'library.albums.search': 'Search',
  'library.albums.searchPlaceholder': 'Titles and notes',
  'library.albums.closeSearch': 'Close search',
  'library.albums.exitSelection': 'Cancel selection',
  'library.albums.selectItems': 'Select items',
  'library.albums.export': 'Share',
  'library.albums.emptyTitle': 'Your media lives here',
  'library.albums.emptyBody':
    'Import photos, videos and sounds from your phone. Nudgio keeps its own private copy, so your reminders keep working even if you tidy your gallery.',
  'library.albums.import': 'Import',
  'library.albums.importPhotoVideo': 'Photo or video',
  'library.albums.importSubtitle': 'From your phone',
  // Translator note: {name} is an album name.
  'library.albums.importInto': 'From your phone, straight into {name}',
  'library.albums.importAudio': 'Audio',
  'library.albums.importAudioSubtitle': 'Voice notes, music, sounds',
  // Translator note: {name} is an album name.
  'library.albums.emptyAlbumTitle': 'Nothing in {name} yet',
  'library.albums.emptyAlbumBody':
    'Import straight into this album, or select items anywhere in your library and choose Move.',
  'library.explorer.unsorted': 'Unsorted',
  'library.explorer.searchLibrary': 'Search Library',
  'library.explorer.searchPlace': 'Search {name}',
  'library.explorer.items': '{count} items',
  'library.explorer.item': '1 item',
  'library.explorer.pinned': 'Pinned',
  'library.explorer.selected': '{count} selected',
  'library.explorer.move': 'Move',
  'today.pause': 'Pause',
  'settings.profiles.show': 'Show alert styles and previews',
  'settings.profiles.hide': 'Hide alert style previews',
  'settings.alarmHealth.ready':
    'Android reports that reminder alerts are available. Use Health to check individual settings.',
  'settings.alarmHealth.limited':
    'Some Android settings limit reminder alerts. Open Health above to see what is affected and how to fix it.',
  'reminders.editor.moreOptions': 'More options · Snooze, notes and history',
  'reminders.editor.hideOptions': 'Hide extra options',
  'reminders.editor.previewEstimate':
    'Schedule preview. The exact next occurrence is confirmed after saving.',
  'reminders.editor.scheduleSummary': '{repeat} at {time}',
  'reminders.editor.validationWeekdaysRequired': 'Choose at least one weekday.',
  'reminders.editor.validationProfileRequired':
    'An alert style is required. Reopen this screen to reload styles.',
  'reminders.editor.checkingAlertSettings': 'Checking alert settings',
  'reminders.editor.monthDaySummary': '{month} · Day {day}',
  'today.pauseTitle': 'Pause reminder?',
  'today.pauseBody':
    '“{label}” will stop alerting until you turn it on again in Reminders.',
  'library.explorer.retryFolders': 'Could not load folders · Retry',
  'library.explorer.noFoldersFound':
    'No matching folders. Try another name or choose the root above.',
  'library.explorer.undoUnavailable':
    'This move can no longer be undone. You can move the media again.',
  'library.explorer.moveHere': 'Move here',
  'library.explorer.moveSeparate': 'Move folders and media separately.',
  'library.explorer.moveFolderFailed':
    'Folder could not be moved. Choose another destination.',
  'library.explorer.moveMediaChanged':
    'Some selected media changed. Select them again.',
  'library.explorer.moveMediaFailed':
    'Media could not be moved. Refresh and try again.',
  'library.explorer.moveFailed': 'Move could not be completed. Refresh and try again.',
  'library.explorer.folderSaveFailed':
    'Folder could not be saved. Refresh and try again.',
  'library.explorer.folderRemoveFailed':
    'Folder could not be removed. Refresh and try again.',
  'library.explorer.importedUnsorted': 'Imported to Unsorted. Move it from there.',
  'library.explorer.pinFailed': 'Could not update the pin. Refresh and try again.',
  'library.explorer.add': 'Add',
  'library.explorer.close': 'Close',
  'library.explorer.rename': 'Rename',
  'library.explorer.unpin': 'Unpin',
  'library.explorer.save': 'Save',
  'library.explorer.create': 'Create',
  'library.explorer.deleteTitle': 'Delete selected',
  'library.explorer.deleteBody':
    'Removing folders keeps their media. Deleting selected media removes its files and disables linked reminders; it does not delete those reminders.',
  'library.explorer.deleteImpact': '{folders} folders and {media} media selected.',
  'library.search.placeholder': 'Search media',
  'library.filter.videos': 'Videos',
  'library.filter.audio': 'Audio',
  'library.filter.images': 'Images',
  'library.filter.text': 'Text',
  'library.filter.missing': 'Missing',
  'library.filters.more': 'More filters',
  'library.filters.fewer': 'Fewer filters',
  // The two `library.empty.*` states cover different causes: a genuinely
  // empty library (first-run) versus a search/kind/category filter that
  // matched nothing (recoverable — see `library.empty.filtered.*`).
  'library.empty.title': 'Your library is empty',
  'library.empty.body': 'Imported videos, audio, images and text cards appear here.',
  'library.empty.filtered.title': 'No media matches these filters',
  'library.empty.filtered.body':
    'Try a different search term, or clear the filters to see everything.',
  'library.empty.filtered.clearFilters': 'Clear filters',
  'library.sort.recentlyAdded': 'Recently added',
  'library.sort.name': 'Name',
  'library.sort.mostScheduled': 'Most scheduled',
  'library.sort.fileSize': 'File size',
  'library.import.copying': 'Copying',
  'library.import.checking': 'Checking',
  'library.import.creatingPreview': 'Creating preview',
  'library.import.ready': 'Ready',
  'library.import.errorUnsupportedType': 'This file type is not supported.',
  'library.import.errorUnreadable':
    'The file could not be read. It may have moved or be damaged.',
  // Translator note: {megabytes} is a localized number, already formatted.
  'library.import.errorInsufficientSpace':
    'Not enough free space. Free at least {megabytes} MB and try again.',
  'library.import.errorCancelled': 'Import was cancelled. No file was added.',
  // Translator note: {count} is a plain integer, always 1 today (imports are one file at a time).
  'library.import.success': '{count} assets imported successfully.',
  // Translator note: {count} is a plain integer.
  'library.grid.itemCount': '{count} items',
  'library.kind.video': 'Video',
  'library.kind.audio': 'Audio',
  'library.kind.image': 'Image',
  'library.kind.text': 'Text',
  'library.integrity.missing': 'Missing',
  'library.detail.addReminder': 'Remind me with this',
  'library.detail.playPreview': 'Play preview',
  'library.detail.editDetails': 'Edit details',
  'library.detail.exportItem': 'Export this item',
  'library.detail.notes': 'Notes',
  'library.detail.attachedReminders': 'Attached reminders',
  'library.detail.noAttachedReminders': 'No reminders use this media yet.',
  'library.detail.fileIntegrity': 'File integrity',
  'library.detail.deleteTitle': 'Delete this media?',
  'library.detail.deleteConfirmBody': 'This removes the file from your library.',
  // Translator note: {count} is a plain integer, always 1 or more here.
  'library.detail.deleteDependencyWarning': 'This media is used by {count} reminders.',
  'library.detail.deleteKeepDisabled': 'Keep reminders disabled',
  'library.detail.deleteMediaAndReminders': 'Delete media and reminders',
  'library.detail.notFound.title': 'This media is no longer available',
  'library.detail.notFound.effect': 'It may have been removed from the library.',
  'library.detail.titleLabel': 'Title',
  'library.detail.titlePlaceholder': 'Name this media',
  'library.detail.notesPlaceholder': 'Add a note (optional)',
  'library.detail.renameValidationTitleRequired': 'Title cannot be empty.',
  'library.player.close': 'Close preview',
  'library.player.loadError': "Couldn't play this file.",
  'library.player.play': 'Play {title}',
  'library.detail.emptySelectionTitle': 'Select an item',
  'library.detail.emptySelectionBody':
    'Choose something from your library to see its details here.',
  'library.selection.select': 'Select',
  'library.selection.back': 'Exit selection',
  'library.selection.export': 'Export',
  'library.selection.delete': 'Delete',
  // Translator note: {count} is a plain integer, always 1 or more here.
  'library.selection.checkboxLabel': 'Select {title}',
  'library.selection.checkedLabel': 'Selected: {title}',
  'library.selection.emptyWarning': 'Select at least one item, or tap Back to exit.',
  'library.selection.exportSuccess': '{count} assets exported successfully.',
  'library.selection.deleteSuccess': '{count} assets deleted successfully.',
  'library.selection.exportError': "Couldn't export the selected items. Try again.",
  'library.selection.deleteError': "Couldn't delete the selected items. Try again.",
  'library.editAsset.title': 'Edit media asset',
  'library.editAsset.editLabel': 'Edit {title}',
  'library.editAsset.saveSuccess': 'Media details updated successfully.',

  // --- Reminders / editor (MR-03) ------------------------------------------
  'reminders.title': 'Reminders',
  'reminders.list.enableToggle': 'Enable {label}',
  'reminders.list.deleteAction': 'Delete {label}',
  'reminders.status.paused': 'Paused',
  'reminders.status.done': 'Done. Edit to schedule it again',
  'reminders.status.unscheduled': 'Not scheduled yet',
  // Translator note: {date} is a short date like "12 Oct"; {time} an already-formatted time.
  'reminders.status.dateAt': '{date} at {time}',
  'reminders.editor.what': 'What',
  'reminders.editor.when': 'When',
  'reminders.editor.alertStyle': 'Alert style',
  'reminders.editor.snooze': 'Snooze',
  'reminders.editor.options': 'Options',
  'reminders.editor.preview': 'Preview',
  'reminders.editor.save': 'Save reminder',
  'reminders.editor.change': 'Change',
  // Translator note: {time} and {date} are already locale-formatted.
  'reminders.editor.previewNext': 'Next: {date} at {time}',
  'reminders.repeat.once': 'Once',
  'reminders.repeat.everyDay': 'Every day',
  'reminders.repeat.selectedDays': 'Selected days',
  'reminders.repeat.monthly': 'Monthly',
  'reminders.repeat.yearly': 'Yearly',
  'reminders.repeat.custom': 'Custom',
  'reminders.editor.dayOfMonth': 'Day of month',
  'reminders.editor.month': 'Month',
  'reminders.editor.intervalDays': 'Repeat every',
  // Translator note: {days} is a plain integer, always 1 or more.
  'reminders.editor.intervalDaysValue': 'Every {days} days',
  'reminders.editor.increase': 'Increase',
  'reminders.editor.decrease': 'Decrease',
  'reminders.editor.amPm': 'AM or PM',
  'reminders.editor.hour': 'Hour',
  'reminders.editor.minute': 'Minute',
  // Translator note: {time} is the resolved local time after a DST gap.
  'reminders.dst.gap':
    '{original} does not occur on this date. The reminder will use {resolved}.',
  'reminders.dst.useSecond': 'Use second {time}',
  'reminders.editor.newTitle': 'New reminder',
  'reminders.editor.editTitle': 'Edit reminder',
  'reminders.editor.createSuccess': 'Reminder created successfully.',
  'reminders.editor.updateSuccess': 'Reminder updated successfully.',
  'reminders.editor.mediaSection': 'Media',
  'reminders.editor.mediaEmptyTitle': 'Add a photo, video or sound',
  'reminders.editor.changeMedia': 'Change media',
  'reminders.editor.chooseMedia': 'Choose media',
  'reminders.selectMedia.title': 'Select media',
  'reminders.selectMedia.useThis': 'Use this',
  'reminders.editor.label': 'Label',
  'reminders.editor.labelPlaceholder': 'Name this reminder',
  'reminders.editor.titleLabel': 'Title',
  'reminders.editor.titlePlaceholder': 'Wake up, Learn Japanese, Sleep',
  'reminders.editor.messageLabel': 'Message (optional)',
  'reminders.editor.messagePlaceholder': 'Something to tell yourself when it is time',
  'reminders.editor.source.photoVideo': 'Photo or video',
  'reminders.editor.source.audio': 'Audio',
  'reminders.editor.source.library': 'From library',
  'reminders.editor.previewMedia': 'Preview',
  'reminders.editor.repeat': 'Repeat',
  // Translator note: {profile} is an alert style name such as "Standard"; {minutes} a plain integer.
  'reminders.editor.alertSummary': '{profile} · snooze {minutes} min',
  'reminders.editor.notesPlaceholder': 'Optional notes',
  'reminders.editor.date': 'Date',
  'reminders.editor.time': 'Time',
  'reminders.editor.weekdays': 'Repeat on',
  'reminders.editor.snoozeDefault': 'Default snooze',
  // Translator note: {minutes} is a plain integer.
  'reminders.editor.snoozeMinutes': '{minutes} minutes',
  'reminders.editor.historyToggle': 'Record history',
  'reminders.editor.historyHelper':
    'Keep a local record of Play, Snooze and Dismiss for this reminder.',
  'reminders.editor.enabledToggle': 'Enabled',
  'reminders.editor.capabilitySummary': 'Capability summary',
  'reminders.editor.validationLabelRequired': 'Give this reminder a name.',
  'reminders.editor.validationMediaRequired': 'Choose media for this reminder.',
  'reminders.editor.saved': 'Reminder saved',
  'reminders.editor.notificationsBlockedTitle': 'Notifications are turned off',
  'reminders.editor.notificationsBlockedBody':
    "This reminder won't be able to alert you until notifications are enabled for Nudgio.",
  'reminders.editor.notificationsBlockedContinue': 'Save anyway',
  'reminders.editor.notificationsBlockedOpenSettings': 'Open Settings',
  'reminders.editor.exactAlarmBlockedTitle': 'Exact alarm access is off',
  'reminders.editor.exactAlarmBlockedBody':
    'Without it, Android may delay this reminder by several minutes — or drop it entirely on some phones. Turn on "Alarms & reminders" for Nudgio to fire on time.',
  'reminders.editor.exactAlarmBlockedContinue': 'Save anyway',
  'reminders.editor.exactAlarmBlockedOpenSettings': 'Open Settings',
  'reminders.detail.title': 'Reminder',
  'reminders.detail.edit': 'Edit',
  'reminders.detail.delete': 'Delete reminder',
  'reminders.detail.duplicate': 'Duplicate',
  'reminders.detail.previewMoment': 'Preview the moment',
  'reminders.detail.noAction': 'Nothing. Done just closes the reminder.',
  'reminders.detail.deleteConfirmTitle': 'Delete this reminder?',
  'reminders.detail.deleteConfirmBody': 'The media itself is not deleted.',
  'reminders.detail.deleteSuccess': 'Reminder deleted successfully.',
  'reminders.detail.deleteError': "Couldn't delete the reminder. Try again.",
  'reminders.toggle.enableError': "Couldn't enable the reminder. Try again.",

  // --- Reminder actions (DL-080) ----------------------------------------------
  'reminders.action.section': 'After the reminder',
  'reminders.action.sectionHelper':
    'Optionally open something when you tap the reminder: a lesson, a playlist, a workout video.',
  'reminders.action.none': 'Nothing',
  'reminders.action.openLink': 'Open a link',
  'reminders.action.linkLabel': 'Link',
  'reminders.action.linkPlaceholder': 'YouTube, Spotify, maps or website link',
  'reminders.action.buttonLabel': 'Button text (optional)',
  'reminders.action.invalid': "That doesn't look like a link Nudgio can open.",
  'reminders.action.test': 'Try it',
  // Translator note: {host} is a website name like "example.com".
  'reminders.action.opensHost': 'Opens {host}',
  'reminders.action.opensApp': 'Opens in another app',
  'reminders.action.cannotOpen': 'No app on this phone can open that link.',
  'reminders.action.default.youtube': 'Open YouTube',
  'reminders.action.default.spotify': 'Open Spotify',
  'reminders.action.default.maps': 'Open map',
  'reminders.action.default.phone': 'Call',
  'reminders.action.default.email': 'Write email',
  'reminders.action.default.sms': 'Send message',
  'reminders.action.default.web': 'Open link',
  'reminders.action.default.app': 'Open app',

  // --- The moment: what Play opens (DL-080) -----------------------------------
  'moment.done': 'Done',
  'moment.close': 'Close reminder',
  'moment.loading': 'Opening your reminder',
  'moment.mediaMissingTitle': "This media isn't available anymore",
  'moment.mediaMissingBody':
    'It may have been deleted. Your reminder and its message still work.',
  // Translator note: {time} is an already-formatted clock time; {repeat} is a plain-language repeat summary.
  'moment.context': '{time} · {repeat}',
  'reminders.toggle.disableError': "Couldn't disable the reminder. Try again.",
  'reminders.detail.next': 'Next occurrence',
  'reminders.detail.schedule': 'Schedule',
  'reminders.detail.alertStyle': 'Alert style',
  'reminders.detail.snooze': 'Snooze',
  'reminders.detail.disabledNotice': 'This reminder is disabled and will not alert.',
  'reminders.detail.needsSetupNotice':
    'This reminder needs a capability fixed before it can alert.',
  'reminders.weekday.mon': 'Mon',
  'reminders.weekday.tue': 'Tue',
  'reminders.weekday.wed': 'Wed',
  'reminders.weekday.thu': 'Thu',
  'reminders.weekday.fri': 'Fri',
  'reminders.weekday.sat': 'Sat',
  'reminders.weekday.sun': 'Sun',
  'reminders.weekday.monday': 'Monday',
  'reminders.weekday.tuesday': 'Tuesday',
  'reminders.weekday.wednesday': 'Wednesday',
  'reminders.weekday.thursday': 'Thursday',
  'reminders.weekday.friday': 'Friday',
  'reminders.weekday.saturday': 'Saturday',
  'reminders.weekday.sunday': 'Sunday',

  // --- Profiles (ADR-018) -----------------------------------------------------
  'profile.gentle.name': 'Gentle',
  'profile.gentle.description':
    'Heads-up if Android permits, one short vibration, sound off by default.',
  'profile.standard.name': 'Standard',
  'profile.standard.description':
    'Heads-up with sound. Full-screen alarm when your phone is locked.',
  'profile.persistent.name': 'Persistent',
  'profile.persistent.description': 'Repeated alerts and continuous alarm when locked.',
  'profile.persistent.notice': 'Not for emergencies.',

  // --- Due presentation (MR-03) ----------------------------------------------
  'due.play': 'Play',
  'due.snooze': 'Snooze',
  'due.dismiss': 'Dismiss',
  // Translator note: {time} is the resolved absolute time, e.g. "6:25 AM".
  'due.snoozedUntil': 'Snoozed until {time}',
  'due.silenceSound': 'Silence sound',

  // --- Health ------------------------------------------------------------------
  'health.title': 'Health',
  'health.testReminder': 'Test reminder',
  'health.lastSchedulerCheck': 'Last scheduler check',
  'health.oemNote':
    'Your device manufacturer may delay background alerts. Use Test reminder after changing battery settings.',
  'health.action.allow': 'Allow',
  'health.action.openSettings': 'Open settings',
  'health.capability.notifications.title': 'Notifications',
  'health.capability.exact_alarm.title': 'Exact alarm timing',
  'health.capability.battery_environment.title': 'Battery settings',
  'health.capability.scheduler.title': 'Scheduler',
  'health.capability.full_screen_intent.title': 'Full-screen alarms',
  'health.capability.channels.title': 'Notification channels',
  // Native `CapabilityItem.effectKey` values (MR-08). Kept in this exact
  // shape — one key per observed state, plain-language consequence, no
  // "failure" wording for a state the user has not actually done anything
  // wrong to reach (MR-03 "Copy style").
  'capability.notifications.ready': 'Reminders can show a notification.',
  'capability.notifications.blocked':
    'Reminders cannot show a notification until this is allowed.',
  'capability.exactAlarm.ready': 'Reminders fire at the exact time you set.',
  'capability.exactAlarm.limited':
    'Android may deliver reminders a little later than the exact time you set.',
  'capability.fullScreenIntent.ready':
    'Alarms can take over the screen, even when it is locked.',
  'capability.fullScreenIntent.limited':
    'Reminders will show as a notification instead of taking over the screen, even when it is locked.',
  'capability.batteryEnvironment.ready': 'Background alerts are not restricted.',
  'capability.batteryEnvironment.limited':
    'Your battery settings may delay background alerts. This is expected — Nudgio never asks to be exempted.',
  'capability.batteryEnvironment.unknown':
    "This device doesn't report battery-restriction status.",
  'capability.scheduler.ready': 'The next reminder is registered with Android.',
  'capability.scheduler.idle': 'No next reminder is currently scheduled.',
  'capability.scheduler.unknown': 'Scheduler status has not been confirmed yet.',
  'capability.scheduler.pending':
    'The latest schedule has not been confirmed by Android. Reopen the app and check again.',
  'capability.scheduler.inexact':
    'The next reminder uses limited timing and may arrive later.',
  'capability.channels.ready':
    'Reminder channels are enabled. Android controls their sound and presentation.',
  'capability.channels.blocked':
    'A reminder channel is disabled. Enable both reminder channels in Android settings.',

  // --- Backup (MR-03) ----------------------------------------------------------
  'backup.export.title': 'Export',
  'backup.export.privacyWarning':
    'This ZIP contains your media and reminder names. Anyone with the file can open it.',
  'backup.export.chooseDestination': 'Choose where to save',
  'backup.export.share': 'Share',
  'backup.export.done': 'Done',
  'backup.export.mediaCount': 'Media',
  'backup.export.reminderCount': 'Reminders',
  'backup.export.estimatedSize': 'Estimated size',
  'backup.export.exporting': 'Creating archive',
  'backup.export.successTitle': 'Export complete',
  // Translator note: {fileName}, {size} and {hash} are already formatted values.
  'backup.export.successBody': '{fileName} · {size}',
  'backup.export.hash': 'Checksum: {hash}',
  'backup.import.title': 'Import',
  'backup.import.chooseFile': 'Choose backup file',
  'backup.import.inspecting': 'Inspecting backup',
  'backup.import.inspectOnly': 'Inspect only',
  'backup.import.inspectOnlyDescription':
    'Look at what is in this backup. Nothing on this device changes.',
  'backup.import.merge': 'Merge',
  'backup.import.mergeDescription':
    'Add this backup’s media and reminders alongside what you already have.',
  'backup.import.replace': 'Replace',
  'backup.import.replaceDescription':
    'Erase everything on this device first, then restore only what is in this backup.',
  'backup.import.replaceNotice': 'This cannot be undone.',
  'backup.import.replaceConfirmToken': 'REPLACE',
  'backup.import.replaceConfirmTitle': 'Replace all local data?',
  'backup.import.replaceConfirmBody':
    'Everything currently on this device will be replaced with the backup. This can be undone immediately after import, but not later.',
  'backup.import.previewCreatedAt': 'Created',
  'backup.import.previewSourceVersion': 'From app version {version}',
  'backup.import.previewSize': 'Archive size',
  'backup.import.checksumValid': 'Checksum verified',
  'backup.import.checksumInvalid':
    'Checksum does not match. This archive may be damaged.',
  'backup.import.compatibilityCompatible': 'Compatible with this app version',
  'backup.import.compatibilityMigratable': 'Will be upgraded during import',
  'backup.import.compatibilityTooNew': 'This backup was created by a newer app version',
  'backup.import.compatibilityUnsupported': 'This backup format is not supported',
  'backup.import.conflictsTitle': 'Conflicts found',
  // Translator note: {count} is a plain integer.
  'backup.conflict.media': '{count} media conflicts',
  'backup.conflict.reminder': '{count} reminder conflicts',
  'backup.conflict.profile': '{count} profile conflicts',
  'backup.conflict.category': '{count} category conflicts',
  'backup.conflict.tag': '{count} tag conflicts',
  'backup.conflict.keptNewer': 'Kept the newer version',
  'backup.conflict.keptExisting': 'Kept what was already on this device',
  'backup.import.committing': 'Restoring',
  'backup.import.successTitle': 'Import complete',
  // Translator note: {mediaCount} and {reminderCount} are plain integers.
  'backup.import.successBody':
    'Restored {reminderCount} reminders and {mediaCount} media items.',

  // --- Settings (MR-04, appearance) -------------------------------------------
  'settings.title': 'Settings',
  'settings.appearance.title': 'Appearance',
  'settings.appearance.theme': 'Theme',
  'settings.appearance.theme.system': 'System',
  'settings.appearance.theme.light': 'Light',
  'settings.appearance.theme.dark': 'Dark',
  'settings.appearance.materialYou': 'Use wallpaper colors',
  'settings.appearance.materialYou.helper':
    'Match app colors to your device wallpaper (Android 12 and later).',
  'settings.section.remindersAndAlerts': 'Reminders and alerts',
  'settings.section.dataAndPrivacy': 'Data and privacy',
  'settings.section.support': 'Support',
  'settings.row.health': 'Health',
  'settings.row.health.subtitle': 'Permissions and scheduler status',
  'settings.row.profiles': 'Alert profiles',
  'settings.row.profiles.subtitle': 'Gentle, Standard, Persistent',
  'settings.alarmPreview.hint':
    'Preview tests notification and lock-screen presentation. To test ringing, Snooze and retries, create a reminder. Android controls whether a heads-up or full-screen alert appears.',
  'settings.alarmPreview.notificationTitle': '{name} preview',
  'settings.alarmPreview.scheduled':
    'Preview scheduled — check your notifications in a few seconds.',
  'settings.alarmPreview.notificationsBlocked':
    'Turn on notifications first so the preview can appear.',
  'settings.alarmPreview.failed': 'Preview could not be scheduled. Try again.',
  'settings.row.defaults': 'Reminder defaults',
  'settings.row.defaults.subtitle': 'Default snooze duration',
  'settings.row.statistics': 'Statistics',
  'settings.row.statistics.subtitle': 'Local history of your reminders',
  'reminders.status.mediaMissing': 'Media unavailable',
  'library.detail.replaceMedia': 'Replace media',
  'library.detail.replaceMedia.missing':
    "Nudgio can't find this file any more. Pick a replacement and every reminder using it starts working again.",
  'library.detail.replaceMedia.done':
    'Replaced. Reminders using this are ready to turn back on.',
  'library.detail.replaceMedia.failed': 'Could not replace this media.',
  'library.detail.saveToGallery': 'Save a copy to gallery',
  'library.detail.saveToGallery.done': 'Saved to your gallery, in a Nudgio folder.',
  'library.detail.saveToGallery.unsupported':
    "This Android version can't save straight to the gallery. Use Share instead.",
  'library.detail.saveToGallery.failed': 'Could not save a copy to your gallery.',
  'settings.row.storage': 'Nudgio media',
  'settings.row.storage.subtitle': '{items} · {size}',
  'settings.row.storage.empty': 'Nothing imported yet',
  'settings.row.storage.unavailable': '{count} unavailable',
  'settings.row.storage.item': 'item',
  'settings.row.storage.items': 'items',
  'settings.storage.explainer':
    'Nudgio keeps its own copy of everything you import, so your reminders keep working even if you delete the original.',
  'settings.row.backup': 'Backup',
  'settings.row.backup.subtitle': 'Export your reminders, settings and media',
  'settings.row.import': 'Import',
  'settings.row.import.subtitle': 'Restore from a backup file',
  'settings.row.accessibility': 'Accessibility',
  'settings.row.accessibility.subtitle': 'Reduced motion, high contrast, haptics',
  'settings.row.privacy': 'Privacy',
  'settings.row.privacy.subtitle': 'What stays on this device',
  'settings.row.about': 'About',
  'settings.row.about.subtitle': 'Version, licenses, source',
  'settings.defaults.timeFormat': 'Time format',
  'settings.defaults.timeFormat.device': 'Device',
  'settings.defaults.timeFormat.h12': '12-hour',
  'settings.defaults.timeFormat.h24': '24-hour',
  'settings.defaults.snoozeLabel': 'Default snooze duration',
  'settings.defaults.use24HourTime.helper':
    'Show times as 18:30 instead of 6:30 PM. Turn off device time format to choose.',
  'settings.defaults.alarmRingtone': 'Alarm ringtone',
  'settings.defaults.alarmRingtone.helper':
    'Used for Standard and Persistent ringing. Notification sounds follow Android channel settings.',
  'settings.defaults.alarmRingtone.change': 'Change',
  'settings.defaults.alarmRingtone.preview': 'Play ringtone preview',
  'settings.defaults.alarmRingtone.stopPreview': 'Stop ringtone preview',
  'settings.defaults.alarmRingtone.changed': 'Ringtone updated.',
  'settings.defaults.alarmRingtone.failed': 'Could not open ringtone picker.',
  'settings.defaults.alarmRingtone.saveFailed': 'Could not save ringtone. Try again.',
  'settings.defaults.alarmRingtone.previewFailed':
    'Could not play this tone. Choose another ringtone.',
  'settings.accessibility.reduceMotion': 'Reduce motion',
  'settings.accessibility.reduceMotion.helper':
    'Follows your system setting; shown here for reference.',
  'settings.accessibility.fontScale': 'Text size follows your system font setting.',
  'settings.accessibility.highContrast': 'High contrast',
  'settings.accessibility.on': 'On',
  'settings.accessibility.off': 'Off',
  'settings.accessibility.strongerHaptics': 'Stronger haptics',
  'settings.accessibility.strongerHaptics.helper':
    'Use a longer vibration for accept, snooze and delete confirmations.',
  'action.preview': 'Preview',
  'settings.privacy.body':
    'Nudgio has no account, no analytics and no Internet permission. Everything stays on this device unless you export a backup yourself.',

  // --- Statistics (MR-04 "Charts and history") ---------------------------------
  'statistics.title': 'Statistics',
  'statistics.completed': 'Completed',
  'statistics.dismissed': 'Dismissed',
  'statistics.missed': 'Missed',
  'statistics.snoozed': 'Snoozed',
  // Translator note: {days} is a plain integer, e.g. "Last 7 days".
  'statistics.rangeLabel': 'Last {days} days',
  'statistics.mostActive.none': 'Not enough history yet',
  'statistics.mostActive': 'Most active reminder',
  'statistics.dailyBreakdown': 'Day by day',
  'statistics.empty.title': 'No history yet',
  'statistics.empty.body': 'Once reminders start alerting, a summary appears here.',
  // Translator note: {date}, {completed}, {dismissed} and {missed} are already formatted.
  'statistics.dayAccessible':
    '{date}: {completed} completed, {dismissed} dismissed, {missed} missed',

  // --- About ---------------------------------------------------------------------
  'about.title': 'About',
  'about.version': 'Version {version}',
  'about.schemaVersion': 'Database schema {version}',
  'about.contractVersion': 'Bridge contract {version}',
  'about.buildVariant': 'Build {variant}',
  'about.license': 'License',
  'about.licenseValue': 'Apache License 2.0',
  'about.sourceCode': 'Source code',
  'about.privacyDetails': 'Privacy details',
  'about.noInternet':
    'This app has no Internet permission and makes no network requests.',
  'about.madeFor': 'Built for a calm, offline, local-first media reminder.',

  // --- Generic actions/states --------------------------------------------------
  'action.cancel': 'Cancel',
  'action.save': 'Save',
  'action.delete': 'Delete',
  'action.retry': 'Retry',
  'action.details': 'Details',
  'action.close': 'Close',
  'action.done': 'Done',
  'action.moreOptions': 'More options',
  'action.back': 'Back',
  'action.dismiss': 'Dismiss',
  'action.snooze': 'Snooze',
  'action.accept': 'Accept',
  'action.open': 'Open',
  'error.unexpected.title': 'Something went wrong',
  'error.unexpected.effect': 'The last action could not be completed.',
  'error.notificationsBlocked.title': 'Notifications are turned off',
  'error.notificationsBlocked.effect':
    'Allow notifications in Settings so alerts and previews can appear.',
  'error.bridgeUnavailable.title': 'Native features are unavailable',
  'error.bridgeUnavailable.effect':
    'This build is running without the Android reliability core connected.',
  'error.updateRequired.title': 'Update required',
  'error.updateRequired.effect': 'This version of the app is out of date.',
  'loading.startingUp': 'Starting up',
  'loading.repairing': 'Finishing an earlier operation',
} as const;
