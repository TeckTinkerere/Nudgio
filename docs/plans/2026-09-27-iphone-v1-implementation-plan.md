# Nudgio for iPhone — design and implementation plan

**Date:** 27 September 2026  
**Status:** Product-plan direction and Ink & Apricot branding accepted by the user. iPhone implementation started 2026-09-28 with P0/P1 source under `ios/`; compilation and physical-device gate G1 remain unverified. Android recolouring is a separate implementation.  
**Scope:** A complete, local-first iPhone application. Cross-device sync and payment are on hold.  
**Repository inspected:** `e5f0290` on the current checkout. Existing Android source remains the baseline for Android.  
**Companions:** [Screen design board](2026-09-27-iphone-v1-design-board.html) · [Ink & Apricot brand guidelines](iphone-brand-guidelines.md) · [Colour tokens](iphone-brand-tokens.json).

## 1. Product decision

Build an iPhone reminder app that lets a person create a useful alarm immediately and optionally attach local audio, video or an image. The first experience must not require preparing a media library, making an account or understanding platform permissions.

The core journey is:

**Create → describe → choose time → optionally attach → schedule → stop, snooze or open → play when requested.**

The app must distinguish a saved reminder from an alarm actually registered with iOS. A clear interface cannot compensate for unverified scheduling, and a successful schedule request does not prove that an alarm was heard.

### Proposed defaults

| Decision | Implementation direction |
|---|---|
| Minimum OS | iOS 26.0, subject to the device-validation gate below; no notification-only substitute marketed as an equivalent alarm |
| Devices | iPhone first, including supported compact and large models, with and without Dynamic Island; no dedicated iPad or watch app in this release |
| Everyday UI | React Native, with iPhone-specific navigation, forms and components |
| Reliability core | Swift + AlarmKit + App Intents; no dependency on React Native startup for system alarm actions |
| Persistence | Native Core Data SQLite store and app-owned media files; a single native command service owns mutations |
| Network | No application backend, account, sync, analytics, ads, payment SDK or app-originated networking |
| Content | A title is required; notes and one media attachment are optional |
| Schedule | Once, every day, or selected weekdays; no monthly/yearly/custom-interval schedules in the first iPhone release |
| Alert | System AlarmKit alarm; do not import Android's Gentle/Standard/Persistent profiles as equivalent iPhone capabilities |
| Lock Screen secondary action | Snooze by default; optional Open reminder instead of Snooze, using the system-supported action slot |
| Snooze | Default 10 minutes; selectable 5, 10, 15 or 30 minutes per reminder |
| Media playback | Begins only after an explicit Play; opening a reminder does not itself start playback |
| Backup | Manual, validated iPhone logical ZIP backup and restore; no Android archive compatibility claim |
| Design | Ink blue, warm ivory and apricot; system typography, grouped surfaces, native navigation, restrained motion |

These are design choices for this plan, not assertions that every API detail has passed a device test. Gate G1 validates the risky platform assumptions before the full feature build.

### Success criteria

- At least 8 of 10 representative first-time testers independently schedule a title-only reminder within 60 seconds, measured from opening the editor and excluding time spent reading Apple's permission prompt.
- At least 8 of 10 independently attach a local file, schedule it and later play the correct attachment without coaching.
- All participants can identify whether a reminder is scheduled, paused or needs attention; misunderstandings are treated as design defects.
- All required native alarm, data-integrity and accessibility tests pass on the declared device/OS matrix before public release.
- No unresolved critical/high-severity issue in scheduling, stop actions, data loss, privacy or accessible core flows.
- No in-app analytics are introduced to measure this; use observed sessions, volunteer feedback and explicit diagnostic exports.

## 2. Evidence and boundaries

### What the current repository establishes

- The existing application uses React Native 0.86.0 and React Navigation, with a Kotlin/Room reliability core. `package.json` has no iOS run script or iOS native module registration.
- No iOS app target was found in the scoped source inventory.
- `src/features/reminders/ReminderEditorScreen.tsx:423` requires a non-empty label and selected media. The iPhone flow deliberately removes the media prerequisite.
- `src/native-client/types.ts` contains Android URI terminology, Android capability concepts and a wider recurrence set than the proposed iPhone scope. Reusing all existing DTOs unchanged would encode incorrect assumptions.
- `src/native-client/NativeMediaReminder.ts` records real Codegen constraints: wire types must be parser-compatible and declared in the spec. The Swift bridge needs its own compilation proof.
- `src/app/App.tsx` includes Android-era alarm overlays and media routing. Do not mount those unchanged in the iPhone shell.
- MR-03/MR-04 use Material navigation, Android permissions and a custom full-screen alarm. Those are useful product context, not iPhone screen specifications.
- ADR-002 is Android-only; ADR-005's globally earliest alarm depends on Android execution opportunities. Neither should silently become an iOS architecture rule.
- Recent Git history includes a 1.9.0 version bump and alarm UI/action fixes. Parts of README, ARCHITECTURE and the decision log describe older stages; they are not current release evidence.

### Verified platform facts relevant to the plan

- AlarmKit is available from iOS 26, requires user authorization and provides system alarm presentation and actions. It supports fixed dates and relative schedules. [Apple introduction](https://developer.apple.com/videos/play/wwdc2025/230/).
- Apple's sample demonstrates weekly recurrence, required usage-description copy, and system handling of stop/countdown actions. It does not establish arbitrary Android recurrence parity. [Scheduling sample](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit).
- AlarmKit can reject scheduling when its maximum alarm limit is reached. Do not hardcode an undocumented OS limit. [Capacity error](https://developer.apple.com/documentation/alarmkit/alarmmanager/alarmerror/maximumlimitreached).
- LiveActivityIntent can execute in the app process without bringing the UI forward. [Intent documentation](https://developer.apple.com/documentation/appintents/liveactivityintent).
- Background push delivery is not guaranteed. No future sync or push mechanism should become a prerequisite for an already-scheduled alarm. [Background updates](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app).

## 3. Scope and explicit exclusions

### Required for the first public iPhone release

1. Onboarding, a short alarm explanation and an optional test alarm.
2. Title-only reminders; optional notes; optional single audio/video/image attachment.
3. Once/daily/selected-weekday scheduling; edit, duplicate, pause, resume and delete.
4. Native Stop and Snooze; native Open reminder routing when selected.
5. A native reminder/player screen reachable even if the React Native interface fails.
6. Local media import, preview, reuse, dependency-aware removal and storage reporting.
7. Accurate schedule status, permission recovery and a local test facility.
8. Local backup/restore with validation and rollback.
9. Light/dark appearance, Dynamic Type, VoiceOver, reduced motion and accessible core flows.
10. Release evidence, privacy disclosures and TestFlight validation.

### Deferred

- Android↔iPhone sync, iCloud/CloudKit sync, accounts, remote changes and device linking.
- Import/export interchange with Android; this plan covers iPhone-to-iPhone manual backups only.
- Payment, subscriptions, advertising and analytics.
- In-app recording, camera capture, web downloads, YouTube/social integrations and streaming.
- Monthly/yearly/custom-interval recurrence, location reminders and calendar integration.
- Quiet-notification mode, Android-style escalation, custom alarm tones and user-created alert profiles.
- Share extensions, standalone home-screen widgets, Siri creation shortcuts, Watch app and iPad layouts. The countdown Live Activity extension required by the snooze design is included.
- Gamified streaks, inferred completion statistics, AI suggestions and medical/emergency positioning.

No placeholders for deferred functions should appear as working buttons in the app. Do not add a sync abstraction, account table, networking client or background push entitlement just for possible future use. Stable IDs and versioned local records are sufficient preparation.

## 4. Architecture choice

| Approach | Benefit | Cost/risk | Decision |
|---|---|---|---|
| React Native screens + Swift native core | Reuses existing engineering investment while isolating alarm execution | Requires careful bridge, native presentation and platform styling | Recommended |
| Entire iPhone app in SwiftUI | Direct native controls and a single iOS language | Creates a second complete UI implementation to maintain | Revisit only if the RN iOS proof fails or native UX costs exceed its reuse value |
| Generic cross-platform alarm plugin | Fast initial demo | Hides lifecycle and action limitations behind a shared API | Reject as the reliability foundation |

React Native 0.86 documents an Objective-C++ adapter for Swift TurboModules. Use the supported generated adapter pattern, not a handwritten bridge that merely resembles the Android contract. [React Native Swift integration](https://reactnative.dev/docs/0.86/the-new-architecture/turbo-modules-with-swift).

### Runtime boundaries

```text
iPhone React Native screens
        │ typed commands and snapshots
Objective-C++ generated-module adapter
        │
Swift NudgioKernel / command service
   ├── Core Data repositories and journals
   ├── AlarmCoordinator ── AlarmKit (system schedules and ringing)
   ├── MediaStore ── private validated files
   ├── Native reminder view / AVKit player
   └── Backup service

AlarmKit / LiveActivityIntent ── same Swift command service
Countdown widget extension ── presentation metadata only
```

- The native store owns durable state. React Query caches snapshots; UI state never determines whether an alarm exists.
- AlarmKit owns system ringing and presentation. Do not run an app audio loop as an alternative alarm engine.
- Native intents resolve the alarm/occurrence identifier and act without JS. The native reminder view can show title/notes/media without the RN bundle.
- Build a lazy native kernel: handling an intent must not wait for React initialization. Verify actual app-process behaviour on device, including a deliberately unavailable JS bundle.
- Keep the widget extension presentation-only. Do not add a shared writable store or App Group unless the spike proves a requirement; Alarm attributes should carry minimal display metadata.
- Serialize commands within the native app process. Core Data transactions and uniqueness constraints enforce durable idempotency; a Swift actor alone is not a cross-process lock. If a later extension writes data, redesign the boundary before adding it.

## 5. Navigation and information architecture

Use three bottom tabs: **Today**, **Library**, **Settings**. The Today screen includes the complete reminder list through an Upcoming/All segmented control. This removes a separate Reminders tab from the iPhone edition without changing Android navigation.

| Destination | Entry | Navigation/presentation |
|---|---|---|
| Today | Launch, first tab | Large native-style title; top-right Add |
| New reminder | Add or empty-state CTA | Full-height modal with Cancel and Save |
| Reminder detail | Reminder row/card | Push; standard back gesture and Edit action |
| Edit reminder | Detail Edit / row menu | Same form as creation, seeded with current values |
| Repeat | Editor repeat row | Pushed subform within editor navigation |
| Add attachment | Editor attachment row | Action sheet: Photos, Files, Library |
| Library | Second tab | Searchable grid; list at accessibility text sizes |
| Media detail | Library item | Push; Preview, Use in reminder, Remove |
| Reminder check | Today warning or Settings | Status rows and Test alarm |
| Backup | Settings | Export / Restore flows |
| Due content | Open reminder intent or explicit app selection | Native view; React Native is optional |

No floating Android FAB, custom floating app bar, Android back icon, navigation rail or Material permission sheet in the iPhone shell. Use platform navigation transitions and a native-stack form presentation. A native-backed tab bar is preferred; if the installed navigation version cannot deliver it, use a simple accessible fixed tab bar for beta and document that choice—do not create a custom glass imitation.

## 6. Visual specification

The accompanying design board shows hierarchy and spacing. It is a static planning artifact, not a running iPhone build or a screenshot of AlarmKit.

### Tokens and layout rules

| Element | Design specification |
|---|---|
| Background | App-owned warm ivory `#F7F4EE`; dark midnight `#11141D`. Native system surfaces retain iOS materials |
| Cards/form groups | App-owned paper `#FFFEFA`; dark `#1D2230`, expressed as adaptive semantic tokens |
| Brand primary | Ink blue `#2D4DB5`; dark moon blue `#BAC8FF`. White light-theme button labels; dark navy `#172654` on dark-theme buttons |
| Brand warmth | Apricot `#E9B58E` with brown `#56321C` text; pale apricot/dark warm container for Snooze. Never white text on apricot |
| Primary text | App-owned deep ink `#202638` / dark `#F3F1EC`; secondary `#5F6675` / dark `#BCC2D0`; native controls use system labels |
| Attention | Separate warning tokens and explicit icon/text; apricot is not a warning/error signal |
| Destructive | System red plus verb; normal Stop is not styled as destructive |
| Typography | System font with Dynamic Type: large title 34 pt, title 22 pt, headline/body 17 pt, secondary 15 pt, caption 13 pt at default size |
| Reminder time | 40 pt semibold tabular digits in next-reminder card; scales and wraps independently |
| Spacing | 4/8/12/16/20/24/32 pt; 20 pt phone side margins, 16 pt card padding, 24 pt section spacing |
| Shape | App-owned cards 16 pt; native form/sheet/nav geometry follows iOS |
| Hit area | At least 44×44 pt; primary in-app Play/Snooze controls at least 56 pt high |
| Rows | At least 56 pt; multi-line reminder rows at least 72 pt, growing with content |
| Icons | SF Symbols on native surfaces; use a small native symbol wrapper for RN or licensed cross-platform assets with matching semantics; no unlicensed font extraction |
| Motion | Native navigation; optional 150–200 ms state crossfade; instant/reduced transitions when Reduce Motion is on |
| Surface effects | Native navigation materials where available; opaque content cards, with Reduce Transparency respected |

Use the [versioned colour tokens](iphone-brand-tokens.json) for app-owned surfaces and preserve native system materials for navigation, pickers and AlarmKit presentation. The matching [CSS variables](iphone-brand-tokens.css) drive the design board. The [brand guidelines](iphone-brand-guidelines.md) specify pairings and measured contrast: primary button labels are 7.39:1 in light mode and 8.87:1 in dark mode. Native large titles collapse on scroll. Content never hides behind the tab bar, keyboard, home indicator or Dynamic Island. No fixed-height forms, clipped status messages or shrinking text to fit.

The 44 pt touch-target floor and Dynamic Type support follow Apple's accessibility guidance; critical actions in Nudgio use larger targets where possible. [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).

### Reusable components

`IOSScreen`, `GroupedSection`, `FormRow`, `StatusRow`, `ReminderRow`, `NextReminderCard`, `AttachmentRow`, `ImportProgress`, `InlineError`, `PermissionExplanation`, `EmptyState`, `DestructiveConfirmation`.

Every component specifies normal, pressed, focused, disabled, busy and error states. Disabled Save has adjacent explanatory text; a spinner must not remove the action label. Status is text + icon. Do not put switches inside an overlapping row-wide button hit area.

## 7. Screen-by-screen behaviour

### S01 — First launch

- One short welcome screen: **“A reminder, with what you need.”**
- Body: **“Set a time. Add a note, photo, audio or video if it helps. Your reminders stay on this iPhone.”**
- Primary **Create a reminder**; secondary **Explore first**; small **Privacy** link.
- No OS permission prompt on launch. No mandatory multi-page carousel.
- Explore opens an honest empty Today screen. Do not insert sample reminders into the user's schedule.
- After the first successful save, offer an optional Test alarm; never require completing it to browse the app.

### S02 — Today

```text
Today                                      +
Sunday, 27 September
[Upcoming                         All]

NEXT REMINDER
┌────────────────────────────────────────┐
│ 8:00 AM                    Tomorrow    │
│ Morning practice                       │
│ Every day · Audio attached             │
│ ✓ Scheduled on this iPhone             │
└────────────────────────────────────────┘

TODAY
9:30 AM   Stretch                       >
          Video attached
6:00 PM   Read for ten minutes           >
          No attachment

Today             Library            Settings
```

- Show one next-reminder card and chronological rows; avoid duplicating the same occurrence in both the hero and list. If it is the only upcoming item, do not add a redundant section.
- Show dates explicitly when not today; display the native-calculated next time.
- Add opens the editor directly. Card/row opens details. Context menu: Edit, Duplicate, Pause, Delete; all available without a gesture in detail.
- All shows active and paused reminders with search; status and enable switch are explicit.
- Empty: **“What would you like to remember?”**, **Create reminder**, supporting **“Attachments are optional.”**
- If setup affects alarms, show one inline card above the next reminder, not a stack of banners. Tapping opens Reminder check.
- Recent actions may show **Stopped**, **Snoozed** or **Opened** when recorded. Never label an elapsed time as proof of delivery or completion.
- Cold load: small skeleton only for initial database loading. A database error shows Retry and diagnostic export, never an empty-library success state.

### S03 — New/edit reminder

```text
Cancel             New reminder          Save

What would you like to remember?
[Morning practice                         ]

WHEN
[Date                         Tomorrow   >]
[Time                          8:00 AM   >]
[Repeat                       Every day  >]

CONTENT
[Add attachment                          +]
[Add a note                              >]

[More options                            >]

Next: Monday, 28 September at 8:00 AM
```

- Autofocus the title only on a new reminder. Maximum 160 Unicode characters; whitespace-only invalid. Notes up to 4,000 characters. Preserve Unicode and newlines safely.
- Default time is the next half-hour boundary at least five minutes ahead; once-only schedule. The native layer calculates the default and preview.
- Use native date/time controls with the user's locale and 12/24-hour preference. Editing hour/minute must not force a custom wheel or analog clock.
- Repeat choices: Does not repeat / Every day / Selected days. For Selected days require one or more weekdays, displayed in locale order. Hide Date for recurring reminders and display the next occurrence instead.
- More options: Snooze duration; Lock Screen action (Snooze / Open reminder); Show title on Lock Screen (off by default). Explain each with one sentence.
- Title-only and notes-only content need no dummy MediaAsset. Detaching an attachment leaves a valid reminder.
- Save persists a local draft first, requests alarm authorization only when necessary, and then attempts native registration.
- While saving: label **Saving…**, reject duplicate taps, preserve form input. Success closes the editor and briefly announces the scheduled time.
- Denied permission: **“Saved, but the alarm is off.”** Actions: **Open Settings**, **Keep paused**. Do not silently replace it with a quiet notification.
- OS registration failure: **“Saved, but not scheduled.”** Show **Try again** and **Keep paused**. Existing successfully applied schedule remains visible during failed edits.
- Dirty Cancel/swipe-to-dismiss: **Keep editing**, **Save draft**, **Discard changes**. Save draft does not schedule. Clean dismiss needs no prompt.
- Persist editor drafts with a short debounce and on meaningful navigation changes; label draft recovery on relaunch. Deleting a draft releases only unreferenced staged files.

### S04 — Attachment selection and import

- Action sheet: **Photos**, **Files**, **Choose from library**, **Cancel**. No broad Photos access or microphone request.
- Photos uses PHPicker/PhotosPicker; Files uses the system document picker. The OS/provider may need Internet to fetch a cloud-only source; imported content must become a verified local copy before readiness is shown.
- Progress: **Copying → Checking → Preparing preview → Ready**, with Cancel. Show byte progress when length is known; otherwise use an indeterminate indicator, never invented percentages.
- After import, show a 56 pt thumbnail/type icon, editable title, duration/size and Remove/Replace. Do not send users into a separate metadata workflow before they can save the reminder.
- Duplicate bytes reuse the existing asset by default, showing **“Using the copy already in your library.”** Renaming a reminder does not rename shared media.
- Cancel, unavailable cloud source, unsupported format, insufficient space and corrupt media preserve the editor and remove pending files.
- A dismissal during import cancels it in this release; do not promise continued transfer after suspension.

Selected-only Photos access is supported without full photo-library authorization. [Apple picker documentation](https://developer.apple.com/documentation/swiftui/view/photospicker(isPresented:selection:matching:preferredItemEncoding:photoLibrary:)).

### S05 — Reminder detail

- Title; large next time/date; repeat summary; schedule status; enabled switch; optional attachment preview; notes; Edit.
- Attachment has **Play preview** or **View image**. Preview does not resolve a future alarm or write a completion record.
- Below content: snooze duration, Lock Screen action and privacy setting.
- Pause cancels future registrations and any active snooze for that reminder; if it is currently ringing, label the action **Stop and pause**.
- Delete requires confirmation only for the irreversible reminder deletion, explaining whether media remains in the library. Deleting a reminder does not silently delete reusable media.
- Duplicate copies title, notes, content reference and schedule into an unscheduled editor; it does not create a second active alarm without Save.
- Failed pause/delete stays visibly **Change not applied** with the still-applied schedule and retry. Never remove the row before native cancellation is confirmed.

### S06 — System alarm and native due-content view

The system alarm is not an app-designed full-screen activity. The static board illustrates app-owned content only; final system appearance comes from signed builds on real iPhones.

| Chosen Lock Screen action | System alarm controls | Route to content |
|---|---|---|
| Snooze (default) | System Stop + Snooze/countdown | Open Nudgio and select the recent/current reminder |
| Open reminder | System Stop + custom Open reminder | Native intent stops the current alert and opens its native detail view after required unlock |

- Do not promise three simultaneous custom Play/Snooze/Dismiss buttons. If system layout differs across supported versions, retain the same meaning and document screenshots.
- Open reminder leads to a native view with title, scheduled time, notes and the appropriate Play/View action. It never autoplays.
- The native view provides a snooze action for the originating occurrence within a 30-minute response window; it schedules only that occurrence's child snooze. Outside the window, offer **Remind me again** with a new explicit time.
- Stop always means stop the current alert, not delete or disable the repeating reminder. Cancel registrations only for Pause/Delete/replace operations.
- Default Lock Screen title is **“Nudgio reminder”**. Showing the personal title is opt-in. Do not expose thumbnails, filenames or notes on system surfaces by default.
- Media player: AVPlayerViewController/native image viewer, title, elapsed/remaining time, accessible scrubber, Play/Pause and Close. Start from the beginning for a new occurrence; keep position only within the current viewing session.
- Playback remains foreground-only in this release. Locking/backgrounding pauses content and releases the audio session. No background-audio mode is requested; AlarmKit ringing is independent.
- Headphone removal pauses playback. Calls/audio interruptions pause; do not resume unexpectedly. If another alarm begins, pause content and yield to the system alert.
- Missing media: stop the ringing action regardless, show **“This attachment is unavailable”**, retain notes and offer repair on unlock. A broken player must never prevent Stop.

### S07 — Library

- Large title, Import action, search, All/Video/Audio/Images filters. Two-column grid on normal widths; a single-column list at accessibility sizes.
- Cards: thumbnail or clear type icon, title, duration/type and number of reminders using it. Use predictable aspect ratios; no masonry movement during loading.
- Search is local, case/diacritic-insensitive where appropriate; empty results preserve the query and offer Clear filters.
- Media detail: preview, rename, size, linked reminders, **Use in reminder**, **Remove from library**.
- Removing referenced media offers **Remove attachment from N reminders** or Cancel. This is explicit conversion to title/notes-only reminders; schedule intent is preserved after coordinated update. No broken references.
- Unexpectedly missing/corrupt files disable the affected reminder at reconciliation and show repair choices; do not silently perform the same conversion without user consent.
- Storage summary includes verified media bytes and clearable preview-cache bytes. Clearing cache does not delete originals or schedules.

### S08 — Settings and Reminder check

- Groups: Reminders (default snooze, test alarm, reminder check); Appearance (System/Light/Dark); Storage & backup; Privacy; About.
- No account, sync, payment, Android exact-alarm settings or notification-channel rows.
- Reminder check shows Alarm permission, locally applied schedules, attachments requiring repair and last successful check time. It does not claim to inspect every system sound setting.
- Test alarm: synthetic title, 15 seconds ahead, no personal media/history. Explain **“Lock your iPhone to try the alarm.”** Afterward ask whether it was heard; the answer is local feedback, not proof covering all future states.
- If alarm capacity is exhausted, offer cancelling the test or pausing a chosen reminder; never silently evict a real alarm.
- Accessible inline issues show consequence and one action. Technical details appear only in a collapsible diagnostic view.

### S09 — Backup and restore

- Export shows selected scope (all data; history optional), estimated size and **Create backup**. Use Files/share UI only after archive verification.
- Copy: **“This backup contains your reminders and media. Anyone with the file may be able to read it.”** No encryption claim.
- Restore selects a file, validates without mutation, and displays counts, estimated space and compatibility before a Replace confirmation.
- First iPhone release offers Replace only; Merge is deferred. Existing data remains rollback-ready until replacement is verified.
- Restored reminders start paused. **Review and enable** rechecks permission, media, schedule and OS capacity; no immediate surprise alarms.
- Explain that Files destinations may be cloud services chosen by the user; this is manual export, not application sync.

## 8. Alarm scheduling contract

### Schedule semantics

| Rule | Representation | Defined behaviour |
|---|---|---|
| Once | Fixed instant plus selected local date/time and zone for display | Warn if time is already past; after save the instant stays fixed when travelling |
| Every day | Relative weekly schedule covering all seven weekdays | Follows local wall-clock time on the iPhone |
| Selected days | Relative weekly schedule for selected weekdays | Follows local wall-clock time; first day of week is display-only |
| Snooze | System countdown or native-supported child schedule | Does not move the base recurrence |

- Use native recurring registrations rather than assuming the app executes after every alert. The Android globally-earliest-only rule is explicitly Android-scoped.
- Register each supported enabled schedule directly with AlarmKit. Do not maintain a finite rolling horizon that silently runs out when the app is not reopened.
- Validate DST gap/overlap behaviour against AlarmKit on supported OS builds. The native preview must match the tested system behaviour; do not force Android's policy onto it. If an affected date cannot be predicted truthfully, disclose the ambiguity and require a different time before enabling that schedule.
- Gate G1 records the exact DST policy accepted for release with fixtures and wording; until then, recurrence parity is unverified, not assumed.
- Detect same-time reminder collisions during save. For first release, block overlapping recurring/once base schedules with **“Another reminder is set for this time. Choose a different time.”** Use deterministic weekday/instant intersection checks. Warn when a requested custom snooze would collide; default to the next user-confirmed choice.
- A system Snooze may still collide with another scheduled alarm. Native system presentation must be tested; do not claim Android-style app queuing or assume an app callback at due time. Unusable overlapping stop controls block release.
- Product cap: 20 enabled base reminders, independent of the OS's actual limit. Paused reminders do not consume the cap. Catch system capacity errors even below 20 and fail visibly. Gate G1 must validate the advertised capacity plus test/snooze behaviour on the release matrix; lower the published cap if necessary.
- No second timer, JS polling loop, background-refresh delivery, silent audio keep-alive or push-triggered alarm.

### Durable state model

Store user intent separately from OS application state:

`draft / paused / enabled intent` + `pending apply / applied / needs permission / apply failed / cancellation pending`.

UI labels derive from both. **Scheduled** means the latest intended revision was successfully applied and checked; show last-check time in diagnostics. It is never a guarantee of audible delivery.

For editing, retain `desiredRevision` and `appliedRevision` and their schedules until reconciliation finishes. If an edit fails, show the old effective time explicitly: **“Change not applied. The alarm is still set for 8:00 AM.”** If neither registration remains, show Not scheduled. Never imply that an old alarm exists after a failed replacement unless native enumeration confirms it.

### Save/edit/delete algorithm

1. Validate title, content integrity, rule, collisions and permission state.
2. Commit the desired record revision and operation journal in one native transaction.
3. Apply the idempotent operation to AlarmKit with stable identifiers. G1 determines supported same-ID replacement behaviour; never assume scheduling over an existing ID is atomic.
4. Read/observe system state where the API supports it and commit applied revision or a precise failure. Preserve evidence of an uncertain outcome for reconciliation.
5. Publish a snapshot to RN only after the local transaction completes.
6. Reconcile after process restart, foreground entry, authorization changes while observable, return from Settings, and explicit user retry. These are repair opportunities, not guaranteed background execution.

For replace operations that cannot be atomic, journal each cancel/schedule phase. Avoid double-registration; if replacement fails after cancellation, attempt restoration of the last applied schedule and report the actual result. Never advertise an impossible atomic transaction between Core Data and AlarmKit.

Delete/pause uses cancellation first, followed by final durable state. Until confirmed, retain a visible pending record. A crash after cancellation but before local commit is reconciled without rescheduling a pending deletion.

### Native actions and history

- Idempotency key includes reminder revision, native alarm identifier, occurrence identifier and action. A recurring alarm ID alone is not enough: it would suppress actions on later days.
- Prefer a platform-provided occurrence distinction if available; otherwise derive one from the applied rule and observed action state/time, including DST/clock-change cases. G1 must prove this mapping before history or snooze persistence is trusted.
- Treat app-observed alarm state and user action records as evidence with timestamps. An overdue record with no action is **“No response recorded”**, not “Missed” or “Completed.”
- Stop is never conditional on successful history/database writes. If protected data is unavailable, use the native alarm ID to perform the system action and reconcile later; do not store sensitive labels in an unprotected workaround.
- App crash, OS process termination and user force-quit are distinct device tests. Do not apply Android force-stop explanations to iOS.
- Test reboot before first unlock separately. Platform-owned alarms may have different behaviour from app-owned media/data; no first-unlock guarantees without evidence.

## 9. Data, files and compatibility

### Native model v1

| Entity | Required fields/purpose |
|---|---|
| Reminder | UUID, title, notes, optional media UUID, schedule rule, snooze minutes, secondary action, lock-screen privacy choice, intent state, revision, timestamps |
| AlarmBinding | Reminder UUID, system ID, desired/applied revision, effective schedule snapshot, last checked timestamp, application status/error |
| MediaAsset | UUID, kind, relative private path, detected type, byte count, SHA-256, duration/dimensions, integrity, timestamps |
| OperationJournal | Operation UUID, type, entity/revision, phase, bounded recovery payload and error code |
| ActionReceipt | Occurrence/action key, system ID, action, timestamp, evidence source; uniqueness constraint |
| EditorDraft | UUID, validated partial form, pending asset references, updated time |
| Preferences | Appearance, default snooze, onboarding state, privacy default, history retention |

Keep media bytes out of Core Data. Store timestamps as UTC instants; wall-clock rules include explicit semantics. Use stable UUIDs, not paths, as relationships. Core Data must have a versioned model and explicit migration tests from its first public schema onward. No destructive “delete database and recreate” recovery.

Choose Core Data over SwiftData for this plan because explicit transaction/recovery control is important and the application does not use a SwiftUI model-driven main UI. This is an engineering choice, not a claim that SwiftData cannot work. No CloudKit container or entitlement.

### File lifecycle

- Native import streams into staging, hashes, validates decode/type/size, then atomically promotes and commits the media row through an operation journal.
- Use app-owned Application Support paths; filenames use generated IDs. Never persist a temporary picker URL as the durable asset.
- Proposed v1 bounds: one active import; 250 MiB per media asset; video/audio up to 30 minutes; images up to 40 megapixels after metadata inspection; reject invalid dimensions before full decode. Imported formats: MP4/MOV with supported H.264/HEVC+AAC, M4A/AAC/MP3/WAV, JPEG/PNG/HEIC. Actual decoder support is verified per device; unsupported codec fails clearly even when the extension is accepted.
- Preserve free space of the larger of 250 MiB or 5% of volume capacity, plus temporary operation needs. Estimate rollback/export duplication before starting.
- Bound thumbnails to 100 MiB and diagnostics to 5 MiB. Export/import uses bounded buffers; no full media archive in memory.
- Do not request a microphone, camera, broad Photos access or local-network permission.

### Data protection and backup policy

- Scheduling metadata/store uses protection available after first unlock, allowing native action handling while subsequently locked. Media uses complete protection and requires unlock for viewing. Test actual database sidecar/file protection, not only a directory flag.
- Never claim that local app storage implies the OS cannot back up data. The proposed iPhone policy allows Apple-managed device backup of user-created records/media under the user's device settings, excludes disposable caches, and accurately discloses this. This differs from Android ADR-015 and needs an iOS-specific ADR.
- No app-managed iCloud sync is enabled. Restoring device data still requires alarm registration reconciliation; system alarm IDs are not treated as portable authorizations.
- Apple's backup guidance distinguishes essential user data from disposable support files. Follow that guidance and test the configured behaviour. [Apple backup guidance](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup).
- If strict exclusion from system backup becomes a product requirement, resolve it before launch, update storage handling and copy, and retain manual backup as a release requirement.

### Manual archive

- Proposed independent format identifier: `com.aslam.nudgio.ios.backup`, archive version `1.0`. Do not reuse Android's `1.0` identifier with incompatible optional-media/action semantics.
- Manifest + versioned JSON records + media + SHA-256 checksums; no raw database/WAL, cache, alarm binding, permission, journal or runtime action session.
- Limits: 2 GiB uncompressed total, 2,000 entries, 20 MiB aggregate JSON, 250 MiB per media entry, bounded JSON depth 16, 100:1 maximum compression ratio. Validate counts, lengths, UUID uniqueness and all references before mutation.
- Reject traversal, absolute paths, symlinks, duplicate/case-colliding normalized paths, unknown major versions, unsupported required fields, invalid hashes and declared/actual size mismatches. Select a maintained streaming ZIP library that exposes entry metadata; pin its version/license in the archive ADR after validation.
- Restore stages and validates, preserves rollback data, cancels old registrations through a journal, swaps logical data, verifies, then offers activation. On failed cancellation, stop before replacing data. On interrupted replacement, recover the original or fully validated replacement, never an undocumented mixture.
- Same-format iPhone round-trip is required. Android archives receive **“This backup is from the Android edition and cannot be restored here yet.”** No partial conversion.

## 10. Bridge and repository integration

Use a new versioned iOS native module contract instead of widening the Android media-required API silently. Share suitable UI utilities and test patterns; keep iPhone DTOs explicit until both platforms support the same semantics.

### Proposed module methods

`getStartupSnapshot`, `getCapabilities`, `previewSchedule`, `saveDraft`, `saveReminder`, `setReminderEnabled`, `deleteReminder`, `duplicateReminderDraft`, `listReminders`, `getReminder`, `importMedia`, `listMedia`, `removeMedia`, `openNativeReminder`, `previewMedia`, `requestAlarmAuthorization`, `scheduleTestAlarm`, `inspectBackup`, `exportBackup`, `restoreBackup`, `exportDiagnostics`.

- Commands include request IDs/revision expectations; responses return typed status, applied revision and next occurrence.
- `previewSchedule` is native and side-effect free. The save path recalculates; a stale preview is never authorization to schedule a past time.
- Events are invalidation hints with monotonically increasing sequence numbers, not durable truth. On event gaps or foreground resume, re-fetch snapshots.
- Opaque import/media handles cross the bridge; no raw private paths. Expire temporary source tokens and validate ownership.
- Errors: permission denied, schedule capacity, unsupported rule, collision, media missing/unsupported, insufficient storage, revision conflict, apply failed, cancellation pending, archive incompatible/invalid, protected data unavailable, bridge unavailable.
- iOS production builds must fail visibly if the native module is unavailable. Never show functional-looking mock reminders in a shipping app.

### Proposed file map (new paths, not claims that files exist)

```text
ios/
  Nudgio.xcodeproj / Nudgio.xcworkspace
  Podfile
  Nudgio/
    AppDelegate.swift
    Info.plist / PrivacyInfo.xcprivacy
    Bridge/NudgioIOSModule.mm
    Core/NudgioKernel.swift
    Core/ReminderCommandService.swift
    Alarms/AlarmCoordinator.swift
    Alarms/AlarmScheduleMapper.swift
    Alarms/AlarmActionProcessor.swift
    Alarms/AlarmReconciler.swift
    Intents/StopReminderIntent.swift
    Intents/OpenReminderIntent.swift
    Data/Nudgio.xcdatamodeld
    Data/ReminderStore.swift
    Data/OperationJournal.swift
    Media/MediaImporter.swift
    Media/MediaStore.swift
    Presentation/NativeReminderView.swift
    Presentation/NativePlayerPresenter.swift
    Backup/ArchiveValidator.swift
    Backup/BackupService.swift
  NudgioCountdown/                 # WidgetKit/ActivityKit target
  NudgioTests/
  NudgioUITests/
src/
  app/App.ios.tsx                 # existing extensionless import selects iPhone shell
  ios/
    app/IOSProviders.tsx
    app/IOSNavigation.tsx
    design-system/                # iPhone tokens and components
    features/today/
    features/reminders/
    features/library/
    features/settings/
    features/backup/
    native/IOSClient.ts
    native/types.ts
    localization/en.ts
  native-client/NativeNudgioIOS.ts # new Codegen-safe contract in existing scan root
fixtures/ios/                     # synthetic data only
docs/ios/                         # build, testing, privacy, compatibility evidence
scripts/ios/                     # repeatable verification and evidence collection
```

Do not mechanically copy the complete Android UI into `src/ios`. Reuse platform-neutral formatting/errors/testing infrastructure only where its assumptions remain true. Add platform-specific adapters where needed. Sharing does not require a premature global refactor.

Expected edits to existing files: `package.json` (iOS commands/Codegen registration), `react-native.config.js` if required, source test configuration, root documentation and platform-specific app entry resolution. Generated module code must compile for Android too, even when its implementation is iOS-only. Avoid an unrelated React Native upgrade during this work.

## 11. Specification and ADR changes required during implementation

Keep this plan proposed until adopted. Do not edit accepted Android ADR history to make it look as if iPhone was always included.

| Proposed ADR | Decision | Existing baseline affected |
|---|---|---|
| IOS-ADR-001 | Separate iPhone release scope, iOS 26 minimum, RN + Swift ownership | ADR-002/003; Android remains supported independently |
| IOS-ADR-002 | AlarmKit registrations, native actions, capacity and recurrence limits | ADR-005/006/008/018; Android alarm invariants remain Android-only |
| IOS-ADR-003 | Optional attachments and iPhone-specific versioned contracts | PRD-020, MR-08/09 |
| IOS-ADR-004 | Core Data, data protection, system-backup policy | ADR-004/010/015; MR-12 |
| IOS-ADR-005 | iPhone archive identity, streaming library and restore policy | ADR-013/014; MR-10 |
| IOS-ADR-006 | iPhone navigation, Lock Screen privacy/actions and accessibility | UX-001/006/007; MR-03/04/13 |

Add an iOS supplement and requirement catalog, link it from MR-00 and the decision log, and update AGENTS.md to distinguish Android hard rules from iOS rules. iOS has no Android-style manifest Internet permission; enforce the no-network product choice through dependencies, configuration and runtime inspection instead.

## 12. Ordered implementation work packages

Each package should land as a small reviewable change with its mapped evidence. No package is complete because a screen renders with mock data.

| Package | Dependencies | Work and target files | Required exit evidence |
|---|---|---|---|
| P0 — Adopt scope and prepare Mac | None | iOS ADRs/supplement; build runbook; resolve Apple team, bundle ID, macOS host and signing | Written scope; working Xcode/device access; no change to Android runtime |
| P1 — Native feasibility proof | P0 | Minimal native target; AlarmKit adapter; Stop/Snooze/Open intents; countdown extension; device matrix | G1 evidence below; a signed device build, not simulator-only success |
| P2 — iPhone shell and design primitives | P1 | `App.ios.tsx`, providers, navigation, tokens, native controls | Navigation/VoiceOver/font-scale tests; no Android UI regression; labelled design fixtures only |
| P3 — Native storage and command contract | P1 | Core Data model, command service, journals, Codegen module/client | CRUD/recovery/bridge tests; actual RN→Swift round-trip; no mock fallback in release |
| P4 — Title-only vertical slice | P2, P3 | Today, editor, details, native preview and AlarmCoordinator | Create → schedule → lock → alarm → Stop/Snooze → next recurrence, with RN unavailable during action |
| P5 — Media and native content view | P4 | Pickers, streaming importer, library, AVKit/native detail | Import → delete source → offline alarm → Open → Play; corrupt/low-space/cancel tests |
| P6 — Reliability and recovery | P4; integrate P5 | Revision application, edit/pause/delete, collisions, capacity, permission recovery | Fault injection at every journal phase; accurate UI after restart and permission changes |
| P7 — Backup and privacy | P3, P5, P6 | Archive service, backup UI, data-protection audit, privacy manifest | Round-trip, malformed archive suite, interruption rollback, device-backup policy evidence |
| P8 — Design and accessibility finish | P2–P7 | All state layouts, localization structure, dark mode, VoiceOver, native playback | Full screen/state/device visual matrix; 10-person usability study with recorded outcomes |
| P9 — TestFlight and release | P1–P8 | CI, signed archive, distribution runbook, privacy/store disclosures | G2/G3 release gates, device soak and complete evidence manifest |

### G1 — Platform feasibility gate, before full UI construction

Execute on a real iPhone using a release-like build with bundled JS:

1. Schedule once, daily and selected-weekday alarms; verify no need to reopen the app between recurrences.
2. Exercise authorization allowed/denied/revoked and the real OS capacity error.
3. Stop and Snooze while RN is unavailable; ensure the action does not delete the next recurrence.
4. Open reminder from locked and unlocked states, observing unlock and exact action-slot behaviour.
5. Confirm custom Open stops only the current alert; test repeat activation and duplicate intent delivery.
6. Confirm supported same-ID edit semantics, cancellation enumeration, retry and crash recovery. Produce the operation-state diagram from observed API behaviour.
7. Test low power, silent mode, Focus, ordinary process termination, user force-quit, reboot before/after first unlock and permitted/denied Live Activities.
8. Verify fixed vs local-time schedules under timezone/manual-clock changes and DST transitions, including next-occurrence preview and occurrence-action mapping.
9. Exercise 20 active schedules, a test alarm and snooze; document actual capacity and system collision behaviour. A number observed on one OS version is not a universal limit.
10. Confirm native content can open without React Native and protected media does not leak while locked.

Produce `docs/ios/evidence/G1-platform-capabilities.md` with device model, OS build, app commit, steps, actual observations, screenshots/video and PASS/FAIL/UNVERIFIED for each case. Unsupported behaviour changes the spec before dependent work proceeds. Never substitute a silent-audio loop or private API to make a failing case pass.

### Build environment

- This planning session runs on Windows. Xcode builds, Simulator execution, signing and physical iPhone verification require a Mac; their availability has not been established here.
- Use an installed stable Xcode/SDK compatible with the selected deployment target and App Store requirements at build time. Record exact Xcode, Swift, Ruby/CocoaPods, Node and dependency-lock versions; do not label a guessed future version as tested.
- A physical iPhone is required for AlarmKit/Lock Screen/action evidence. Simulator tests cover forms, pure logic and many data cases, not release alarm behaviour.
- Resolve the production bundle identifier and Apple Developer team in P0; do not assume the Android package is available in Apple's provisioning namespace.
- Builds must come from an identified clean commit with recorded dependency locks. Android APK builds retain the primary-checkout/clean/up-to-date rules already in AGENTS.md.

## 13. Requirements-to-evidence catalog

All IDs below are proposed iPhone requirements. Their tests are planned, not already passing. Relevant existing requirement IDs are included to preserve traceability without claiming identical platform implementation.

| ID | Acceptance requirement | Existing relation | Evidence ID |
|---|---|---|---|
| IOS-001 | Local creation, scheduling and imported-media playback work offline | PRD-001 | E2E-IOS-01 |
| IOS-002 | No account/network SDK/app telemetry or payment in core app | PRD-003, SEC scope | SEC-IOS-01 |
| IOS-003 | Title-only reminder schedules without dummy media | PRD-020 amendment | E2E-IOS-02 |
| IOS-004 | Native preview matches applied schedule semantics | PRD-023/024 | UT-IOS-01, DEV-IOS-01 |
| IOS-005 | Denied/revoked permission never appears Scheduled | PRD-025/043 | DEV-IOS-02 |
| IOS-006 | Once/daily/selected-weekday alarms survive supported lifecycle states | PRD-021/042 adaptation | DEV-IOS-03 |
| IOS-007 | Stop/Snooze do not depend on JS and retain future recurrence | PRD-033 | DEV-IOS-04 |
| IOS-008 | Media starts only after Play; stop is independent of media errors | PRD-034/035 | DEV-IOS-05 |
| IOS-009 | System alert/action presentation follows AlarmKit support | UX-006/007 adaptation | DEV-IOS-06 |
| IOS-010 | Failed edit shows actual previous or absent applied schedule | PRD-025, DAT integrity | IT-IOS-01 |
| IOS-011 | Pause/delete cancel native registrations and recover after interruption | PRD-022 | IT-IOS-02 |
| IOS-012 | Repeated actions are idempotent per occurrence, not per recurring ID | FUN-011 | UT-IOS-02, DEV-IOS-07 |
| IOS-013 | Import is bounded, cancellable, validated and independent of source deletion | PRD-010/011/014 | IT-IOS-03 |
| IOS-014 | Detachment/removal uses explicit dependency policy | PRD-013 | E2E-IOS-03 |
| IOS-015 | Imported-media playback/notes remain available without RN | PRD-033 extension | DEV-IOS-08 |
| IOS-016 | Core data has no raw private paths in bridge/logs and no silent reset | MR-08/09/12 | SEC-IOS-02, IT-IOS-04 |
| IOS-017 | Capacity errors preserve existing alarms; no automatic eviction | PRD-025 | DEV-IOS-09 |
| IOS-018 | Recurrence/DST/timezone/collision rules are tested and disclosed | PRD-024 | UT-IOS-03, DEV-IOS-10 |
| IOS-019 | Draft survives permission flow, backgrounding and restart | UX-004 | E2E-IOS-04 |
| IOS-020 | Lock Screen defaults to generic title and no personal thumbnail | MR-12 | SEC-IOS-03 |
| IOS-021 | Idle app does not poll, keep audio alive or deliver via background task | PRD-040 | PERF-IOS-01 |
| IOS-022 | Backup validates before mutation, preserves rollback and restores paused | PRD-050..055 adaptation | IT-IOS-05, SEC-IOS-04 |
| IOS-023 | Core tasks work with VoiceOver, Switch Control and largest text | PRD-060..064 | A11Y-IOS-01..04 |
| IOS-024 | Light/dark/reduced motion/transparency and landscape are usable | MR-04/13 | VIS-IOS-01 |
| IOS-025 | History uses observed outcomes and never invents delivery/completion | UX-014 | UT-IOS-04 |
| IOS-026 | Test alarm is synthetic, cancellable and does not evict or change real alarms | FUN-015 | DEV-IOS-11 |
| IOS-027 | Native data protection and OS-backup behaviour match privacy copy | ADR-015 adaptation | SEC-IOS-05 |
| IOS-028 | Release artifacts identify code, environment, test evidence and limitations | MR-14/20 | REL-IOS-01 |

## 14. Test strategy and release gates

### Automated tests

- Swift unit tests: rule validation/preview, weekday normalization, DST fixtures, command state transitions, idempotency, collision detection and archive validators.
- Native integration tests: disk-backed Core Data, database/file journals, forced failure at every apply/cancel/import/restore boundary, missing/protected files, low-space injection, old-schema migrations and actual codec validation. In-memory database tests alone are insufficient.
- Bridge contract tests: valid/invalid payloads, optional media, permission errors, event gaps and JS bundle absent. Generate and compile the contract on both platforms.
- RN tests: create without media, permission-denied save preserves draft, status rendering, failed edit old-time messaging, imports preserving form state, accessible action labels and empty/error distinctions.
- XCUITest: full local create/edit/pause/delete, library, settings and restore journeys. Keep system-permission handling explicit; do not mock AlarmKit in tests claimed as device proof.
- Fuzz/property tests: JSON/ZIP validation bounds and timezone rule calculations. Inputs are synthetic.

### Device and state matrix

| Dimension | Required coverage |
|---|---|
| Hardware | Smallest supported iPhone display/layout; at least one supported older non-Dynamic-Island phone; modern Dynamic Island phone; large phone. At least two real physical devices across these classes; remaining layouts may use Simulator |
| OS | Minimum advertised supported iOS version/build and current stable release; check API/behaviour differences on each major supported line |
| App state | Foreground, background, ordinary OS termination, user force-quit, reboot before/after first unlock |
| System state | Locked/unlocked, low-power mode, silent mode, Focus, low volume, headphones/Bluetooth, phone call/audio interruption, low storage, alarm authorization revoked |
| Time | 12/24-hour, locale weekday order, timezone travel, manual clock change, DST gap/overlap and leap-day once schedule |
| Content | No attachment, short/long title, notes, video, audio, image, deleted source, missing/corrupt owned file, unsupported codec, maximum-size asset |
| Access | VoiceOver, Switch Control, largest accessibility text, bold text, increased contrast, reduced motion/transparency, RTL layout with pseudolocalized strings |

If the minimum advertised OS cannot be tested or has blocking AlarmKit defects, raise the minimum supported patch/version or delay release; never mark the missing evidence as passed.

### Quantitative engineering targets

Proposed targets, measured on the oldest physical reference device with a release build:

- Cold launch to usable Today: p95 ≤ 2.5 s over 30 launches with 500 saved reminders and 200 media records.
- Editor interactions: input remains responsive during file work; no visible main-thread stalls over 100 ms in representative traces.
- Save after authorization already granted: p95 ≤ 1.5 s for normal local scheduling; show progress immediately when slower. A timeout is an uncertain state to reconcile, not proof of failure.
- Native Open reminder to usable content controls: p95 ≤ 2 s after any required unlock over 30 trials; playback decode measured separately.
- Import/backup transient memory: ≤ 32 MiB additional buffering independent of source file size, excluding bounded platform codec working memory measured separately.
- Idle: no app-owned periodic wakeups, persistent audio session or unexpected network traffic in an eight-hour trace. Compare three controlled idle runs; do not advertise a battery percentage from this architecture alone.
- Alarm timing: in controlled device tests, measure visible/audible start against scheduled wall time using an external reference; any unexplained miss or delay beyond five seconds is investigated and blocks the reliability gate until resolved or the supported-condition claim is narrowed. Do not present this test threshold as a universal timing guarantee.

### G2 — Internal acceptance

Every IOS requirement has PASS evidence or an explicitly removed/revised scope item before release. Required failures cannot be waived by describing the app as a beta. Confirm all screen states, native action recovery, archive recovery, privacy and accessibility; run existing shared TypeScript/lint/Jest checks and Android native checks if shared contracts/build configuration changed.

### G3 — TestFlight acceptance

- A 14-day trial on at least two real device models, including recurring alarms while the app is not reopened daily.
- At least 100 documented alarm/action scenarios across the matrix, with exact case counts and unexplained failures reported. This is a release sample, not a statistical guarantee.
- Ten-person usability test against section 1 targets; fix recurring confusion before submission.
- Zero unresolved critical/high defects; no silent schedule failures, stuck ringing or data loss.
- Signed archive from the reviewed commit; required privacy manifest, dependency licenses, App Store disclosures and known-limitations text checked against actual build behaviour.
- TestFlight distribution and App Store submission are later execution steps; this planning request does not publish anything.

## 15. Effort, resources and sequencing

Planning estimate for one experienced mobile engineer with Mac/iPhone access: **approximately 9–14 focused engineering weeks plus a 2-week field trial**, excluding delays for hardware, provisioning, review or platform defects. This is an estimate to rebaseline after P1, not a delivery promise.

| Stage | Indicative effort |
|---|---|
| Scope/tooling + native feasibility | 1–2 weeks |
| Shell, native store/bridge, title-only vertical slice | 2–3 weeks |
| Media/library/native player and recovery | 2–3 weeks |
| Backup/privacy/accessibility/design finish | 2–3 weeks |
| Release automation and defect buffer | 2–3 weeks |

P2 and P3 are logically independent after feasibility, but this plan does not require multiple agents or concurrent implementation. The critical path is native feasibility → durable scheduling → real reminder journey → recovery → release evidence. Do not spend weeks polishing all screens before native actions have passed G1.

Required resources: a Mac with compatible Xcode, Apple provisioning access for signed testing/distribution, physical iPhones, access to users for usability trials, and a location for private evidence artifacts. None has been verified by this planning work.

## 16. Risk decisions and explicit fallbacks

| Risk | Consequence | Planned response |
|---|---|---|
| AlarmKit differs across OS versions | Buttons, persistence or recurrence can behave differently | G1 records behaviour; narrow supported versions or change design before full build |
| Android scheduler copied literally | Later alarms may never be registered on iOS | Direct native recurring registrations; no dependency on a due callback |
| Native action triggers RN startup dependency | Stop/Open stalls or fails | Lazy Swift kernel and native content view; disable JS during proof |
| Save/cancel crash between database and OS | UI and real alarms diverge | Revision snapshots, journaled operations and reconciliation |
| OS capacity lower than expected | Reminder appears enabled but is absent | Explicit capacity errors, preserve existing registrations, validated published cap |
| Background action outcome is unobservable | False history or stuck status | Record only observed evidence; no invented delivery/completion |
| Personal content appears on Lock Screen | Privacy loss | Generic title default; explicit opt-in for title; unlock for media |
| System backup contradicts offline copy | Misleading privacy promise | Disclose Apple-managed backup separately; no app-managed sync |
| Backup scope expands into Android migration | Delays reliable first iPhone release | Separate archive identity; reject Android archives clearly |
| Two UIs drift over time | Maintenance burden | Share safe utilities/contracts only; record platform differences deliberately |
| Native proof exposes unusable action trade-off | Weak media-access experience | Keep Stop+Snooze default; evaluate Open action in usability study; do not invent unsupported controls |

## 17. Plan review and handoff

Before implementing, adopt the proposed defaults or record explicit revisions. The decisions most likely to need user input are the iOS 26 minimum, the 20-enabled-reminder initial cap, foreground-only playback, default generic Lock Screen title, system-backup policy and the availability of Mac/iPhone hardware. The plan is actionable without pretending these defaults have already been approved or tested.

This document does not change runtime permissions, schemas, archive formats, Android behaviour or accepted ADRs. Those changes are future work packages with their own tests. Cross-device sync remains completely outside this release.

Implementation completion reports must include requirement IDs, changed behaviour/files, exact test names/counts/results, device/OS/build evidence, migration/compatibility, permission/privacy/battery/accessibility impact and residual risks. A plan checkbox is not evidence of a working iPhone app.

### Planning validation performed

- Inspected current repository entry point, dependency manifest, Android-oriented bridge/types, reminder editor, architecture, decision log and relevant source-of-truth documents.
- Reviewed official Apple AlarmKit, App Intents, picker, accessibility and backup documentation and React Native 0.86 Swift-module guidance.
- Explicitly separated proposed product choices from verified platform facts and future device tests.
- Following the user's branding request, replaced teal with the Ink & Apricot colour system in the plan and six-screen board. Static verification passed 34 contrast pairs, 40 matching JSON/CSS token values, nine screen specifications and 28 requirement entries. Browser-rendered review was blocked by local-file policy; no rendered or device validation is claimed.
- No application code, dependency installation, schema migration, APK/iOS build, signing or device tests performed for this plan.

### Research sources and refresh rule

Sources were consulted on 27 September 2026. Recheck API signatures, supported OS versions, signing requirements and distribution rules in P0/P1 and immediately before release. The source links support platform capabilities; the layouts, capacity cap, data model, work packages and numerical targets are Nudgio design proposals.

- [AlarmKit](https://developer.apple.com/documentation/alarmkit)
- [AlarmKit introduction](https://developer.apple.com/videos/play/wwdc2025/230/)
- [Scheduling an alarm](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit)
- [Alarm configuration](https://developer.apple.com/documentation/alarmkit/alarmmanager/alarmconfiguration)
- [Alarm capacity failure](https://developer.apple.com/documentation/alarmkit/alarmmanager/alarmerror/maximumlimitreached)
- [LiveActivityIntent](https://developer.apple.com/documentation/appintents/liveactivityintent)
- [Background updates](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app)
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Dynamic Type](https://developer.apple.com/videos/play/wwdc2024/10074/)
- [Photos picker](https://developer.apple.com/documentation/photokit/selecting-photos-and-videos-in-ios)
- [Audio session playback](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/playback)
- [Data protection](https://developer.apple.com/documentation/foundation/urlfileprotection/completeuntilfirstuserauthentication)
- [Device backup](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup)
- [React Native 0.86 Swift modules](https://reactnative.dev/docs/0.86/the-new-architecture/turbo-modules-with-swift)
