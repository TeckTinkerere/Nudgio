# Product loop: personal media → meaningful moment → optional action

Working plan for the autonomous product/UX loop started 2026-10-02. It is
derived from the code as it stands at `b640475`, not from assumptions.

## What the app is today

- React Native 0.86 (new arch, Hermes) UI over a Kotlin core that owns Room,
  `AlarmManager`, notifications, ringing, boot recovery and backup. Android
  only. No network, no account (AGENTS.md hard rules).
- Tabs: Upcoming (5-day projection), Library (imported media, folders),
  Reminders (list + enable toggles), Settings. One global "Add" FAB opens a
  sheet: Import media / Create reminder.
- A reminder is: `label` + exactly one `mediaId` (required) + schedule
  (once/daily/weekdays/monthly/yearly/custom) + alert profile
  (Gentle/Standard/Persistent) + snooze + `notes` (hidden under
  "More options").
- Due path: one global exact alarm → `AlarmDispatchReceiver` → notification
  with Play/Snooze/Dismiss, plus the native full-screen `AlarmActivity` when
  locked, plus the in-app strip when the app is open.
- Play → app opens on a bare media viewer (`MediaSelectionPreviewModal`).

## Audit: highest-value problems, ranked

| # | Problem | Impact |
|---|---------|--------|
| 1 | **The moment itself is weak.** Play opens a bare viewer with no title, no message, no context and no "done". Tapping Play in the notification shade cannot open the app at all on Android 12+ (a broadcast receiver is a blocked notification trampoline), and Accept on the in-app strip opens nothing. | Every reminder, every time |
| 2 | **No message.** `notes` exists but is buried under "More options", labelled "Notes", and never shown on the alarm, notification or viewer. | Every reminder |
| 3 | **No after-reminder action** (open a lesson, a workout video, a playlist, a map, a phone number). | Core vision gap |
| 4 | **Editor reads like a database form**: media → label → when → alert style → options → preview → save. Picking media requires the library; you cannot take something straight from the phone. Save sits at the bottom of a long scroll. | Every create/edit |
| 5 | **Library folders don't look like albums** (the original complaint). | Library users |
| 6 | Editor's "Keep history" toggle is never persisted (`save()` ignores it). | Small, silent bug |

Later cycles: Upcoming as a real home (next moment + today), reminders list
clarity, duplicate, missed reminders, returning-after-weeks, permissions
copy, large fonts, tablet/landscape, accessibility.

## Product model

A reminder is a **moment**: *what* (title + optional message), *your media*
(the reason it exists), *when*, and optionally *what next* (an action).

### Reminder Action (new)

- Stored on `reminders` as `action_type`, `action_uri`, `action_label`
  (all nullable, `MIGRATION_6_7`). Archive: optional `action` object on the
  reminder record; absent means none, so old archives import unchanged.
- Wire/domain type is a discriminated union, today one variant:
  `{type: 'open_link', uri, label?}`. A new action type is a new variant +
  a new launcher, not a schema change.
- `open_link` covers web links, YouTube/Spotify/Maps app links, `tel:`,
  `mailto:`, `geo:`, `sms:` and app deep links. Rejected: `javascript:`,
  `file:`, `content:`, `intent:`, `data:` and anything malformed. Validation
  lives in one pure Kotlin object and is mirrored for instant editor feedback.
- Launched with `ACTION_VIEW` (RN `Linking`), so **no new permission**: the
  target app does the networking. A link no app can open shows a clear
  message instead of failing silently.
- Presentation recognizes common targets (YouTube, Spotify, Maps, phone,
  email, web) for the icon and default button label ("Open YouTube").

### The Moment screen (new)

Shown after Play from any entry point (full-screen alarm, notification,
in-app strip). Media first; title, message and time context below; primary
button is the configured action ("Open lesson") with Done beside it, or just
Done. Images show large with a blurred backdrop, video autoplays (the user
pressed Play) with native controls, audio shows its artwork and controls.
Missing media still shows the words and the action.

### Notification/alarm

- Notification body shows the message when there is one.
- Notification Play becomes an activity `PendingIntent` to a tiny
  translucent `AlarmOpenActivity` that resolves the session through the
  same `AlarmActionReceiver` path, hands over `{reminderId, mediaId}` and
  opens the app. This is the platform-sanctioned replacement for the
  blocked receiver trampoline.
- Full-screen alarm shows the message.

## Cycle log

Each cycle: inspect → change → typecheck/lint/test/gradle → device/emulator
check → re-audit. Results are appended below.

### Cycle 1 — the moment, messages, Reminder Actions (DL-080)

- Native: `reminders.action_*` + `MIGRATION_6_7` (schema 7), `ReminderActionRules`
  (save + backup import), action on summary/detail DTOs, backup codec and
  conflict planner, `historyEnabled` now persisted, notification body is the
  message (`BigTextStyle`), Play is an activity `PendingIntent` to
  `AlarmOpenActivity`, full-screen alarm shows the message and a kind-aware
  verb (Watch/Listen/View), Photo Picker numeric names get readable titles,
  one-time repeat summary names its date.
- JS: `ReminderMoment` (shell modal), `useOpenReminderAction`,
  `reminderActions.ts`, editor rebuilt from section components
  (`editor/`), direct import from the phone, Save in the app bar, no silent
  disabled Save, opaque floating app bar.
- Verified on an API 36 emulator: create with video + message + YouTube
  link (bare `youtube.com/...` resolves to "Open YouTube"), v6→v7 migration
  on an existing database, the alarm fired (inexact, ~90 s late without
  exact-alarm access), in-app strip, notification shows the message,
  notification Play opened the app on the moment with the video playing, the
  action opened the YouTube app and the moment closed.
- Found and fixed on device: in-app strip and its collapsed chip sat under
  the status bar (chip untappable); app bar translucency; loader titled
  "Edit reminder" for a new reminder; portrait media hero half-empty.

### Cycle 2 — first-run and everyday surfaces

- Empty-state actions were left-aligned app-wide (`Button` `alignSelf`).
- Upcoming: one "Your first reminder" empty state instead of five empty
  days; previews open the real moment; action indicator on rows.
- Per-tab FAB: "New reminder" (extended) on Upcoming/Reminders, Add on
  Library, none on Settings (it covered controls).
- Reminders list: media-led rows, next/paused/done status, sorted soonest
  first, no toggle for a finished one-time reminder.
- Reminder detail: media hero, message, "Preview the moment", action with
  "Try it", alert summary, Duplicate (`duplicateFromId`).
- Onboarding: copy no longer says "Two permissions" over three rows,
  permissions page scrolls, ends on "Create my first reminder" or "Explore first".
- `npm test`: 18 suites / 141 tests; repo lint clean; typecheck clean;
  `:app:testDebugUnitTest` green.

### Cycle 3 — Library as albums (DL-081)

- Shelf of album covers (mosaic at 4+ items), Unsorted as a virtual album,
  "New album" as a tile; album view with sub-album row, gallery grid,
  ⋮ options; album picker for Move; inline Undo after a move.
- Verified on the emulator with real imports (photos, portrait video,
  audio via the document picker): covers render from native, mosaic, create
  album, move two items (snackbar + Undo), nested album, empty album state.
- Found and fixed on device: only the cover (not the name) opened an album;
  title wrapped mid-word under four app-bar controls; an empty sub-album row
  pushed every album's media down; audio-led albums showed a bare mic cover;
  selection bar's "Delete" wrapped; move list misaligned.
- 19 suites / 146 tests; repo lint and typecheck clean.
