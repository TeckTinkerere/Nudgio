# Nudgio for iPhone — where it stands and what comes next

**Date:** 6 October 2026
**Status:** Proposed. Extends, does not replace, the [approved iPhone plan](2026-09-27-iphone-v1-implementation-plan.md) and [ADR-IOS-001](../ios/ADR-IOS-001.md). Nothing below has been compiled or run on Apple hardware.
**Why now:** Android has shipped v2.0.0 → v2.2.1 since the iPhone plan was written (DL-080 – DL-109). The iPhone work has stayed at its first milestone, blocked on Mac access. This document re-baselines the plan against today's Android app and makes the next steps concrete.

## 1. Where the iPhone work actually is

| Item | State | Evidence |
|---|---|---|
| P0 scope, ADR, build runbook | Done | `docs/ios/ADR-IOS-001.md`, `ios/README.md` |
| P1 feasibility app (SwiftUI + AlarmKit + countdown widget) | **Source written, never compiled** | 10 Swift files under `ios/`, `ios/project.json` (XcodeGen) |
| Native unit tests | 16 authored, **never executed** | `ios/Tests/TestAlarmCoordinatorTests.swift` |
| G1 device gate (11 cases) | **All UNVERIFIED** | `docs/ios/evidence/G1-platform-capabilities.md` |
| P2 – P9 (RN shell, storage, media, backup, release) | Not started | — |
| Blocker | No Mac/Xcode, no Apple team or bundle ID decided | ADR-IOS-001 "Gate and rollback" |

Everything after P1 depends on G1, and G1 depends on a Mac. **Unblocking the Mac is the critical path; no amount of Windows-side work moves the iPhone app past P1.**

## 2. Unblock the build — recommendation

| Option | Cost | Good for | Not good for |
|---|---|---|---|
| **GitHub Actions macOS runner** | Included minutes; macOS minutes bill at a multiplier on private repos | Compiling, XcodeGen, simulator XCTest on every push — catches Swift errors from Windows | Signed device builds, AlarmKit behaviour, Lock Screen |
| Rented cloud Mac (hourly/monthly) | Monthly rental | Interactive Xcode, signing, TestFlight uploads | Physical-phone testing needs the phone plugged in or a wireless debug session |
| **Second-hand Apple-silicon Mac mini** | One-off purchase | Everything, including G1 with a cable-connected iPhone | — |

**Recommended:** both bold rows. Add a macOS CI job first (it can be written and pushed from Windows today, and turns "never compiled" into a real signal within a day). In parallel, get a Mac you can sit at for the G1 session — G1 cannot pass without a physical iPhone and a signed build. An Apple Developer Program membership is needed for TestFlight and distribution; confirm on the day whether free provisioning is enough for AlarmKit on-device development.

**Step 0 deliverable (Windows, no Mac needed):** `.github/workflows/ios.yml` running `node scripts/ios/check-source.cjs`, `xcodegen`, `xcodebuild build-for-testing` and `test-without-building` on an iOS 26 simulator with `CODE_SIGNING_ALLOWED=NO`. Exit evidence: a green run link pasted into the G1 evidence file's "Automated evidence" section, replacing "Not executed".

## 3. The key reuse decision: the bridge contract is the seam

The Android app is React Native screens over a Kotlin core, joined by **one TurboModule spec** — `src/native-client/NativeMediaReminder.ts` (40 methods). Every screen, hook, repository and test in `src/` talks only to that spec through `MediaReminderClient`.

**So the iPhone app should implement the same spec in Swift**, not a new one. The RN UI then runs on iPhone largely unchanged; platform differences are expressed as capability snapshots and `Platform.OS` branches in a handful of screens, not as a second UI. This keeps the approved plan's architecture ("React Native screens + Swift native core") and makes it cheap: P2/P4 become "make the existing screens render on iOS", not "build an iPhone UI".

Spec methods grouped by iOS mechanism:

| Group | Spec methods | iOS mechanism | Parity notes |
|---|---|---|---|
| Startup and settings | `getStartupSnapshot`, `getCapabilitySnapshot`, `getPreferences`, `setPreferences`, `getDynamicColorScheme`, `openCapabilitySettings`, `requestNotificationPermission` | Core Data singleton row; `AlarmManager.shared.authorizationState`; `UIApplication.openSettingsURLString` | `getDynamicColorScheme` returns null (no Material You). Exact-alarm capability is always "granted". `requestNotificationPermission` maps to AlarmKit authorization — reuse DL-108's primer, because iOS also only asks once. |
| Reminders and scheduling | `listReminders`, `getReminder`, `saveReminder`, `setReminderEnabled`, `deleteReminder`, `scheduleTestReminder`, `listProfiles`, `saveProfile`, `resetBuiltInProfile`, `getStatistics` | Core Data + `AlarmCoordinator` over AlarmKit recurring schedules | **Do not port the Android one-earliest-alarm scheduler** (approved plan §16). AlarmKit holds each recurrence natively. Profiles (Gentle/Standard/Persistent) map to snooze length and sound only — iOS has no escalating vibration control. |
| Due actions | `playDueSession`, `snoozeDueSession`, `dismissDueSession`, `takePendingMediaOpen` | AlarmKit system Stop/Snooze; `LiveActivityIntent` for Open | Same native-without-JS rule as Android. `takePendingMediaOpen` is how the RN Moment screen learns the alarm was opened — keep that name and shape. |
| Media library | `libraryCommand`, `listMedia`, `getMedia`, `updateMedia`, `deleteMedia`, `replaceMediaSource`, `getMediaStorageUsage`, `exportMediaAssets`, `saveMediaCopyToGallery` | Core Data + app-private files under Application Support; `UIActivityViewController` for export; `PHPhotoLibrary` add-only for "save a copy" | Albums (DL-081/089) are pure data — port as is. Add-only Photos access needs its own usage string. |
| Import | `pickDocument`, `pickDocuments`, `beginMediaImport`, `cancelOperation` | `PHPickerViewController` (`selectionLimit = 20`); `UIDocumentPickerViewController` (`allowsMultipleSelection`) | **Multi-select parity comes free** — the batch loop lives in `useImportMedia` (DL-109), so Swift only has to return an array. Stream with `NSItemProvider.loadFileRepresentation`; copy out of the temporary URL before the callback returns. |
| Ringtone | `pickAlarmRingtone`, `previewAlarmRingtone`, `stopAlarmRingtonePreview` | No system ringtone picker on iOS; AlarmKit plays a sound from the bundle or `Library/Sounds` | Ship a small in-app list of bundled tones. Hide "device ringtones" on iOS rather than fake it. |
| Backup | `beginExport`, `shareBackupExport`, `inspectBackup`, `commitImport` | Same logical ZIP format, `Compression`/`AppleArchive` or a vendored ZIP reader | See §5 decision 3 on cross-platform archives. |

## 4. Lessons from Android that must carry over

These are bugs Android already paid for. Each becomes a test in the matching iOS package.

1. **Storage reserve (DL-109).** Use the same rule — `max(250 MB, min(5% of volume, 1 GB))` — and check it against `URLResourceKey.volumeAvailableCapacityForImportantUsageKey`, iOS's equivalent of `getAllocatableBytes` (it counts space the OS can purge). `volumeAvailableCapacityKey` is the iOS version of the original bug. Over-2 GB files get their own message.
2. **Duplicate imports (DL-099).** Hash while copying and reuse the existing asset.
3. **Media that disappears (DL-096/100).** Startup integrity sweep; a reminder whose file is gone says so, not "Paused".
4. **Backups that claimed media and had none (DL-102/103).** The round-trip test must compare media SHA-256, not just row counts.
5. **Permission asked twice, burned forever (DL-108).** AlarmKit authorization is one-shot; primer first, never re-prompt automatically.
6. **Missing cancel on import (DL-109).** Already fixed in shared RN code, so it ships on iPhone.
7. **A stranded alarm session silencing a reminder (DL-084).** On iOS the equivalent is a stale "currently alerting" record after Open; the G1-05 duplicate-intent case covers it.

## 5. Decisions that need you

| # | Decision | Recommendation | Why |
|---|---|---|---|
| 1 | Minimum iOS version | iOS 26 (as approved) | AlarmKit only exists from iOS 26; a notification-only fallback would not be a real alarm. |
| 2 | Bundle ID and Apple team | Decide in P0. Suggest `com.aslam.nudgio` (the Android package name does not carry over) | Every signed build and TestFlight depends on it. |
| 3 | Android → iPhone backup import | **Defer, but keep the archive format compatible** | People switching phones is the most likely migration. Today's plan rejects Android archives outright; if the logical ZIP stays shared, a later "import from Android" is a reader change, not a format redesign. |
| 4 | What plays when an alarm fires | System alarm sound + "Open" to play your media (as approved) | iOS will not autoplay video on the Lock Screen. Honest copy: "Tap Open to play your video." |
| 5 | Enabled-reminder cap | 20 to start, re-baseline after G1-09 | AlarmKit capacity is not documented; Android has no equivalent limit, so the iOS editor must explain it when hit. |

## 6. Revised work packages

Same IDs as the approved plan; scope narrowed by §3's reuse decision.

| Package | Work | Exit evidence | Estimate |
|---|---|---|---|
| **S0 — CI compile** (new, Windows-doable) | macOS GitHub Actions job; fix whatever the first real compile reports | Green CI run; 16 XCTests executed | 1–2 days |
| **P0 — Mac and identity** | Mac access, Apple team, bundle ID, signing | Signed install of the feasibility app on your iPhone | 1–3 days, plus purchase/rental time |
| **P1/G1 — Device gate** | Run the 11 G1 cases on a real iPhone | `G1-platform-capabilities.md` filled with real observations | 3–5 days (G1-01 and G1-07 need waiting through recurrences and reboots) |
| **P2 — RN on iOS** | iOS RN host target (Podfile, AppDelegate) beside `ios/Feasibility`; existing `src/` renders on iOS with the `mockNativeModule`; fix iOS-only layout (safe areas, `Platform.OS` branches for Material-only controls) | All screens render on simulator; Jest green; Android APK unchanged | 1–1.5 weeks |
| **P3 — Swift core** | Core Data model mirroring the Room entities; Swift TurboModule implementing the startup/settings/reminders groups of the spec | RN→Swift round-trip test per method group; no mock fallback in Release | 1.5–2 weeks |
| **P4 — First real reminder** | `AlarmCoordinator` behind `saveReminder`; Moment screen via `takePendingMediaOpen` | Create → lock → alarm → Stop/Snooze/Open on device, JS bundle deliberately unavailable during the action | 1 week |
| **P5 — Media** | Import group (multi-select from day one), library/albums, AVKit playback, §4 items 1–3 | Import 5 videos at once → delete originals → airplane mode → alarm → Open → plays | 1.5–2 weeks |
| **P6 — Reliability** | Edit/pause/delete revisions, capacity errors, permission revoked, crash recovery | Fault injection at each journal phase | 1 week |
| **P7 — Backup and privacy** | Archive service, file protection, privacy manifest | Round-trip with media hashes; malformed archive suite | 1 week |
| **P8/P9 — Finish and TestFlight** | Accessibility, dark mode, store disclosures, TestFlight | G2/G3 gates from the approved plan | 2 weeks |

**Rebaselined total:** about 9–12 weeks of focused work after the Mac is available. That's the low end of the original 9–14 weeks, because the RN screens, hooks and multi-select logic are reused. Re-estimate after G1.

## 7. Next five actions, in order

1. Decide §5 rows 2 and 3 (bundle ID; whether the backup format must stay Android-compatible).
2. Land S0: the macOS CI workflow. Fix compile errors until the 16 XCTests run.
3. Get a Mac session and your iPhone together; install the signed feasibility app.
4. Run G1 and record real results. Any FAIL changes the spec before P2 starts.
5. Start P2 by getting the existing RN screens rendering on the simulator against the mock module. Visual iOS polish waits until P4 works on a device.
