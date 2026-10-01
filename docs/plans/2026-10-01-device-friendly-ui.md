# Android usability and device layout pass

User authorized the proposed Library, reminder editor, Upcoming, Settings and recovery improvements on 2026-10-01. Backup repair, iPhone development and release publication are outside this pass.

## Implemented behavior

- Library Move searches full folder paths, virtualizes destinations, requires an explicit destination and disables invalid self/descendant/third-level destinations. Folder multi-selection uses the existing revision-checked native commands; completed moves leave the selection during a partial failure so a retry targets remaining folders.
- Media Move exposes the existing native ten-minute Undo, bound to the revision returned by that move. A later library mutation or changed media can invalidate Undo; failure explains that media can be moved again manually.
- Folder content and media share a virtualized list. Root, empty-folder and no-destination-match states explain the next action. Empty-folder import uses the current-folder import operation.
- Import progress does not replace loaded content. Refresh/page errors retain loaded items with Retry. Bulk delete is awaited before explorer refresh; failure preserves media selection. Explorer caches share the media invalidation prefix and expire after five inactive minutes.
- Folder navigation remembers each location's search, media-kind filter and scroll offset in memory, including Android Back. Breadcrumbs and selection actions wrap. Folder labels get flexible width; selected media uses the brand selection border. The + control has an accessible Add name.
- Reminder creation keeps required label/media, schedule and alert style visible. Snooze, notes and history are progressively disclosed. Selected media resolves directly by ID without the former first-200 lookup. Empty weekday choices and absent profiles prevent Save. Summary shows chosen recurrence, time, media and label; native code confirms the exact occurrence after saving. System/12/24-hour formatting is respected. Alarm-permission save warnings remain.
- Upcoming's next reminder has a confirmed Pause action using the existing native enable/disable repository and error feedback. Edit and Preview remain available; actions wrap.
- Settings groups existing controls, collapses profile previews, explains Android-reported readiness beside Health and puts ringtone actions below their description with wrapping.
- Sheets can host their own virtualized list without nesting ScrollViews. Sheet/list taps remain usable with the keyboard open. Existing Android adjustResize, safe-area ownership, tablet two-pane Library, reduced motion and theme tokens remain in effect.

## Requirements and compatibility

MR-03 / UX-001, UX-003, UX-004, UX-010; MR-04; PRD-012/013; MR-09 collection scale; ACC-001/002/005/006/007/009. These are implementation mappings, not acceptance of device-only evidence.

Room schema 6, Android package and archive format are unchanged. No migration, new native contract method, dependency, permission, network path, timer, service or scheduling algorithm is introduced. Existing location-query and reparent changes from the Library redesign remain part of the working tree. Local originals and the supplied logo are untouched. Backup compatibility is not newly certified; backup repair remains deferred.

## Device acceptance still required

1. At 320/360dp and 200% text, verify folder titles, breadcrumbs, Move sheet with keyboard, contextual actions, alert summaries and ringtone controls remain reachable.
2. On tablet/landscape, verify Library two-pane resizing and safe-area insets.
3. With TalkBack, verify Add/Select, selected cards, destination states, Undo, Retry and confirmed Pause focus/announcements.
4. Move media across root/main/subfolder; Undo; mutate the library then try Undo; try depth/cycle/name conflicts. Check reminders continue using the same media IDs.
5. Navigate deep folders then Back; verify restored search and scroll against variable-height rows. Test large folder counts and multiple loaded media pages.
6. Import into an empty/populated folder; cancel and simulate low storage. Delete failure must preserve selection and existing content.
7. Select older-than-200 media for a reminder; try no weekdays; save all recurrence types. Verify native next occurrence and pause/resume alarm scheduling.

No APK is built from this dirty checkout. Release packaging requires a clean, current primary checkout per AGENTS.md.

## Automated evidence

- `npm run verify -- --runInBand`: exit 0; TypeScript passed, repository lint passed with `--max-warnings=0`, Jest 15 suites / 74 tests passed. npm did not forward the requested serial flag into Jest; the displayed Jest command was `jest`. Dependency parser diagnostics appeared and Jest reported a worker that needed forced shutdown. These tooling warnings are not fixed or counted as device evidence.
- `npm test -- --runInBand --forceExit src/features/library/__tests__/LibraryGridBody.test.tsx src/features/today/__tests__/UpcomingScreen.test.tsx`: exit 0, 2 suites / 6 tests. Covers retained content during import and failed refresh, retry, current-folder import and Pause confirmation/repository call.
- `folderDestinations.test.ts`: three tests cover path search and depth/self restrictions, included in the full suite.
- Final `npm run typecheck`, focused lint with `--max-warnings=0`, and `git diff --check`: exit 0 after the validation-copy refinements. Diff check emitted only line-ending warnings.
- Native folder/query unit tests were passed in the preceding Library implementation pass. This UI pass changes no Kotlin source; Android device alarm timing, native Pause execution, visual layout, keyboard/scroll restoration, TalkBack and performance benchmarks remain unverified.

Primary files: `src/features/library/LibraryScreen.tsx`, `LibraryGridBody.tsx`, `folderDestinations.ts`, `useLibrarySelection.ts`, `useMediaDetail.ts`; `src/features/reminders/ReminderEditorScreen.tsx`; `src/features/today/UpcomingScreen.tsx`; `src/features/settings/SettingsScreen.tsx`; shared `Sheet.tsx` / `VirtualizedList.tsx`; `src/localization/resources/en.ts`; the new/updated Library and Upcoming tests.
