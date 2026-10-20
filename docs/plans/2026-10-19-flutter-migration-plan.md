# Nudgio → Flutter: cross-platform migration plan (Android + iPhone)

**Date:** 19 October 2026
**Status:** Direction accepted 20 Oct 2026 as [ADR-023](../../specs/Markdown/17_Architecture_Decision_Records.md) (reason: long-term stability over an earlier iPhone release). Execution not started; phase F0 and decisions 2-5 in §13 are still to confirm. Rationale is logged as [DL-111](../decision-log.md), acceptance as [DL-117](../decision-log.md).
**Baseline:** `main` at `a8e45f4`, Android v2.3.1.
**Supersedes, if accepted:** the "React Native remains the chosen production UI" sentence in [ADR-IOS-001](../ios/ADR-IOS-001.md), and the RN-on-iOS packages (P2–P5) of the [iPhone plan](2026-09-27-iphone-v1-implementation-plan.md) and its [6 Oct re-baseline](2026-10-06-iphone-next-steps.md). The iPhone product scope, the brand, the AlarmKit decision, the G1 device gate and the "Android lessons" list in those documents all stay in force.

---

## 1. Why: so iPhone users can use Nudgio too

Nudgio is Android-only today. Everyone with an iPhone, including friends and family of current users who want to share the "media alarm" idea, is shut out. The goal of this migration is **one app, built and maintained once, that ships on both Android and iPhone with the same features, look and behaviour.**

### 1.1 What the app is written in today

The app is not only Kotlin. It has two layers:

| Layer | Today | Lines (approx.) | Cross-platform? |
|---|---|---|---|
| UI (every screen, navigation, design system, state, localization) | **React Native + TypeScript** (`src/`) | ~25,000 incl. tests | Could run on iOS, but never has been: no iOS host, no iOS native module |
| Reliability core (alarms, Room DB, scheduling, ringing, notifications, media storage, backup) | **Kotlin** (`android/`) | ~13,700 | No. Android-only by nature |
| Bridge | One TurboModule spec, `src/native-client/NativeMediaReminder.ts` | 46 methods (44 at the time of writing, plus `shareLibrarySelection` and `saveLibrarySelectionToGallery`, DL-115) | Android implementation only |

### 1.2 Why Flutter rather than finishing the RN-on-iOS plan

The existing approved plan would also reach iPhone, by running the current RN screens on iOS over a new Swift core. This plan chooses Flutter instead, for these reasons:

1. **One UI codebase that renders the same on both phones.** Flutter draws its own widgets with its own engine (Impeller), so a screen looks and behaves the same on a Pixel and an iPhone. RN maps to each platform's native views, so iOS-only layout bugs need separate fixes.
2. **Fewer native third-party modules to keep working on two platforms.** Today's UI depends on seven npm packages with their own native Android *and* iOS code (`react-native-screens`, `-gesture-handler`, `-reanimated`, `-worklets`, `-safe-area-context`, `-svg`, `-video`). Each must compile and behave on iOS 26 with the New Architecture. In Flutter, navigation, gestures, animation, safe areas and SVG are pure Dart. Only video playback needs a plugin, and it is a first-party one.
3. **One typed bridge for both platforms.** Pigeon generates matching Dart, Kotlin and Swift code from one schema. RN's iOS path needs Codegen plus an Objective-C++ adapter around Swift (iPhone plan §4), which is an extra layer to build and debug without a Mac on hand.
4. **A much smaller JavaScript toolchain.** Metro, Babel, Jest and the RN CLI account for 62 of the 63 npm advisories in the [security audit](../security/2026-10-19-security-audit.md) (SEC-09). The Dart toolchain replaces all of that.
5. **Built-in Material 3 and Cupertino widget sets.** iPhone-specific controls (pickers, switches, sheets, navigation bars) come with the framework, which matters because iPhone users expect iPhone conventions.
6. **Hot reload and a single test runner** (`flutter test`, golden tests, `integration_test`) for UI on both platforms.

### 1.3 What it costs (stated plainly)

- **The UI is rewritten.** About 25k lines of TypeScript and Jest tests become Dart and `flutter_test`. Nothing in `src/` carries over as code. Only the designs, the logic and the test cases carry over.
- **It takes longer to reach iPhone.** The RN path was estimated at 9–12 weeks after Mac access. This plan is about **20–27 weeks** in total (§10), because it rebuilds the Android UI first.
- **The Mac blocker is the same.** Flutter still needs a Mac, Xcode, an Apple Developer account and iOS 26 for AlarmKit. Flutter does not remove the need for native Swift alarm code.

The alarm itself can never be "written once". Android's `AlarmManager` with a full-screen intent and iOS's AlarmKit are different OS services, and the app's hard rule is that alarms must work **without the UI engine running**. So the migration is:

> **Flutter for all UI, shared by both platforms. Kotlin stays as the Android alarm core. A new Swift core for iPhone. One Pigeon contract between them.**

---

## 2. What does not change

| Kept as is | Why it matters |
|---|---|
| Kotlin reliability core: `alarm/`, `data/` (Room + migrations), `media/`, `backup/`, `notifications/`, `library/`, `reminders/`, `statistics/` | Proven alarm reliability (DL-001…DL-110) is not re-earned from scratch |
| `AlarmActivity`, `AlarmRingingService`, notification actions | Already native XML/Kotlin and independent of React Native. They stay independent of Flutter |
| Room schema v8 and the `schemas/` JSON | **Existing Android users upgrade in place with no data migration** |
| `applicationId com.aslam.mediareminder` and the release signing key | Required for an in-place update of the sideloaded APK |
| Backup ZIP format | Old backups keep importing, and the format becomes the Android ↔ iPhone transfer path (§8) |
| Product rules in AGENTS.md (no Internet, no analytics, one earliest alarm on Android, explicit Play, etc.) | Flutter must not weaken any of them; checked again in §9 |

## 3. Target architecture

```text
                    ┌─────────────────────────────────────────────┐
                    │        Flutter app (Dart) — shared UI       │
                    │  screens · design system · go_router ·      │
                    │  Riverpod state · l10n · video_player       │
                    └──────────────────┬──────────────────────────┘
                                       │  NudgioHostApi / NudgioEvents
                                       │  (Pigeon-generated, typed)
                 ┌─────────────────────┴─────────────────────┐
                 │                                           │
     ┌───────────▼───────────┐                   ┌───────────▼───────────┐
     │  Android (Kotlin)     │                   │  iOS (Swift)          │
     │  NudgioHostApiImpl    │                   │  NudgioHostApiImpl    │
     │  └─ existing services │                   │  └─ NudgioKernel      │
     │     Room · Scheduler  │                   │     Core Data store   │
     │     AlarmManager      │                   │     AlarmCoordinator  │
     │     AlarmActivity     │                   │     AlarmKit · Intents│
     │     Backup · Media    │                   │     Backup · Media    │
     └───────────────────────┘                   └───────────────────────┘
       ▲ fires with no Flutter engine              ▲ fires with no Flutter engine
```

- **The native side owns durable state.** Dart caches snapshots; Dart state never decides whether an alarm exists (same rule as today's React Query cache).
- **Alarm actions (Play, Snooze, Dismiss, Stop) never wait for the Flutter engine.** On Android this is already true. On iOS, `LiveActivityIntent` and AlarmKit actions call the Swift kernel directly.
- **The moment screen.** Flutter reads `takePendingMediaOpen()` on start and resume, exactly as `usePendingMediaOpen.ts` does now.

### 3.1 Repository layout after migration

```text
lib/                      Flutter app (replaces src/)
  app/                    bootstrap, DI (Riverpod providers), router, shell, error boundary
  core/                   AppError, Result, logging, config/feature flags, clock, ids
  design_system/          tokens, theme (brand + dynamic colour), icons, components, layout
  features/               home, library, reminders, moment, settings, backup, onboarding,
                          statistics, about, capability, health
  native/                 generated Pigeon Dart + NudgioClient wrapper + mock/demo impls
  l10n/                   app_en.arb (from src/localization/resources/en.ts)
pigeons/nudgio_api.dart   THE contract (input to Pigeon)
android/                  existing Gradle project; MainActivity → FlutterActivity
ios/                      Flutter Runner + NudgioKernel Swift package + AlarmKit extension
                          (existing ios/Feasibility, ios/Countdown and ios/Shared reused)
test/  integration_test/  Dart unit, widget, golden and on-device tests
```

The Android Kotlin package paths stay the same. Only `bridge/` changes (§5).

## 4. Technology mapping

| Concern | Today (RN) | Flutter | Notes |
|---|---|---|---|
| Language | TypeScript | Dart 3 (sound null safety) | `analysis_options.yaml` with strict lints, which is the equivalent of today's ESLint `--max-warnings=0` |
| Bridge | TurboModule + Codegen (`NativeMediaReminder.ts`) | **Pigeon** `@HostApi` + `@EventChannelApi` | One schema produces Dart, Kotlin and Swift |
| Navigation | React Navigation (stack + bottom tabs) | `go_router` with `StatefulShellRoute` (3 tabs) | Same route names as `constants/routes.ts` |
| Server/native state cache | TanStack React Query | Riverpod `AsyncNotifier` / `FutureProvider` with explicit invalidation | Port `queryKeys.ts` to provider families |
| Client state | Zustand (`sessionStore`) | Riverpod `Notifier` | |
| DI | `AppContainer` context | Riverpod `ProviderScope` overrides | `createTestContainer()` becomes `ProviderContainer(overrides: …)` |
| Animation | Reanimated + Worklets | Implicit/explicit animations, `AnimationController` | Respect `MediaQuery.disableAnimations` (today's `useReduceMotion`) |
| Gestures / swipe rows | Gesture Handler | `Dismissible` / `GestureDetector` | |
| SVG / brand mark | react-native-svg | `flutter_svg` | |
| Video / audio preview | react-native-video (ExoPlayer) | `video_player` (ExoPlayer on Android, AVPlayer on iOS) | Local `file://` only. Confirm it adds no network permission (§9) |
| Material You | `DynamicColorProvider.kt` via bridge | Keep the bridge method **or** `dynamic_color` package | Prefer keeping the native method so the contract stays the single source |
| Safe areas | safe-area-context | `SafeArea` / `MediaQuery.padding` | |
| Localization | `en.ts` + custom provider | `flutter_localizations` + `intl` ARB, `gen-l10n` | Keep message keys so translations map 1:1 |
| Tests | Jest + RNTL | `flutter_test`, golden tests, `integration_test`, `mocktail` | Kotlin JUnit tests stay; XCTest for Swift |
| Lint/format | ESLint + Prettier | `dart analyze`, `dart format` | |

Avoid community plugins that own reliability-critical paths: no `flutter_local_notifications` or `android_alarm_manager_plus` for due delivery, and no `image_picker` that copies whole files into memory. Those stay in the native core, as AGENTS.md requires.

## 5. The contract: port `NativeMediaReminder.ts` to Pigeon first

The 46-method TurboModule spec and `src/native-client/types.ts` are the seam. Translating them into `pigeons/nudgio_api.dart` is the **first** engineering step, because Android, iOS and Dart all build against it.

| Group | Methods | Android impl | iOS impl |
|---|---|---|---|
| Startup & settings | `getStartupSnapshot`, `getCapabilitySnapshot`, `getPreferences`, `setPreferences`, `setPausedUntil`, `getDynamicColorScheme`, `openCapabilitySettings`, `requestNotificationPermission` | Existing `PreferencesRepository`, `CapabilitySnapshotProvider`, `DynamicColorProvider` | Core Data singleton; `AlarmManager.shared.authorizationState`; dynamic colour returns null |
| Reminders | `listReminders`, `getReminder`, `saveReminder`, `setReminderEnabled`, `deleteReminder`, `skipNextOccurrence`, `scheduleTestReminder`, `listProfiles`, `saveProfile`, `resetBuiltInProfile`, `getStatistics` | `ReminderMutationService`, `SchedulerCoordinator`, `StatisticsProvider` | `AlarmCoordinator` over AlarmKit recurring schedules. **Do not port the one-earliest-alarm scheduler** |
| Due actions | `playDueSession`, `snoozeDueSession`, `dismissDueSession`, `takePendingMediaOpen` | `AlarmActionProcessor`, `PendingMediaOpen` | AlarmKit Stop/Snooze, `LiveActivityIntent` Open |
| Library | `libraryCommand`, `listMedia`, `getMedia`, `updateMedia`, `deleteMedia`, `replaceMediaSource`, `getMediaStorageUsage`, `exportMediaAssets`, `shareLibrarySelection`, `saveMediaCopyToGallery`, `saveLibrarySelectionToGallery` | `LibraryService`, `MediaLibraryService`, `MediaStoreExporter` | Core Data + Application Support files; `UIActivityViewController`; `PHPhotoLibrary` add-only |
| Import & share | `pickDocument(s)`, `beginMediaImport`, `cancelOperation`, `takeSharedDocuments` | `MediaPicker`, `MediaImporter`, `IncomingShare` | `PHPickerViewController` (limit 20), `UIDocumentPickerViewController`, share extension later |
| Ringtone | `pickAlarmRingtone`, `previewAlarmRingtone`, `stopAlarmRingtonePreview` | Existing | Bundled tones list only. Hide "device ringtones" on iOS |
| Backup | `beginExport`, `shareBackupExport`, `inspectBackup`, `commitImport` | `BackupExporter`/`BackupImporter` | Swift port of the same validators (§8) |
| Events | reminder due, operation progress, backup operation | `ReminderEventEmitter`, `OperationProgressEmitter`, `BackupOperationEmitter` → Pigeon event streams | Same streams from Swift |

Rules:
- Errors cross the bridge as the existing `NativeErrorEnvelope` categories (`VALIDATION`, `BACKUP`, `SECURITY`, …) mapped to a Dart `AppError`. Never use a generic `PlatformException` string.
- Every method gets a Dart-side contract test against a fake HostApi, and a Kotlin round-trip test. Port `MediaReminderClient.test.ts`.
- Use `capabilities` fields, not `Platform.isIOS` checks scattered through screens, for platform differences such as "device ringtones available" or "max enabled reminders".

## 6. Screen inventory and port order

15 routes today (`RootNavigator.tsx`, `TabNavigator.tsx`), plus overlays.

| # | Screen / surface | Source | Port notes | iPhone adaptation |
|---|---|---|---|---|
| 1 | Onboarding + permission primer | `features/onboarding` | Keep DL-108 primer (ask once) | AlarmKit authorization is one-shot too |
| 2 | Home (Today) + capability banner, next moment, pause all | `features/home` | | Large-title nav bar |
| 3 | Reminder editor (when / media / alert / action sections) | `features/reminders/editor` | Biggest form; port `AnalogClockPicker`, `WeekdaySelector`, `NumberStepper` | Cupertino time picker; profiles limited to snooze length + sound |
| 4 | Reminder detail | `ReminderDetailScreen` | | |
| 5 | Select media + selection preview | `SelectMediaScreen`, `MediaSelectionPreviewModal` | | |
| 6 | Library (grid, albums, multi-select, delete flush, import progress) | `features/library` | Port `libraryAlbums.ts`, `folderDestinations.ts` logic + tests verbatim | Searchable grid |
| 7 | Media detail + preview player + edit asset | `features/library` | `video_player`, "start from here" (DL-110) | AVPlayer controls |
| 8 | Moment (due content) + in-app due card | `features/moment`, `InAppDueCard` | Explicit Play only | Reached via Open intent |
| 9 | Settings (+ appearance, storage usage, cleanup) | `features/settings` | | Grouped inset list |
| 10 | Backup + Import + Import preview | `features/backup` | | Files app share sheet |
| 11 | Statistics | `features/statistics` | | |
| 12 | About | `features/about` | | |
| 13 | Health (capability/reliability check) | `navigation/placeholders/HealthScreen` | | AlarmKit status |
| 14 | Incoming shares / toasts / error boundary / splash / startup gate | `src/app` | `FlutterError.onError` + `ErrorWidget.builder` replace `ErrorBoundary` | |
| 15 | Design system (~30 components, tokens, theme, contrast tests) | `src/design-system` | Port first; golden-test each component in light/dark | Cupertino variants where iOS convention differs |

## 7. Phased plan

Every phase ends with evidence, as AGENTS.md "Completion report" requires. Android keeps shipping v2.x from the RN code until F5 cuts over.

### F0 — Decide and set up (1 week)
- Accept ADR-023 (§14); amend ADR-003 and ADR-IOS-001; add a superseding note to the iPhone plans.
- Pin the Flutter SDK (FVM, `.fvmrc`) to the stable release current at kickoff; record versions in MR-22.
- Decide the iOS bundle ID (suggested `com.aslam.nudgio`) and Apple team; order Mac access (CI runner and a physical Mac, per the 6 Oct plan §2).
- **Fix SEC-01, SEC-02 and SEC-04 in Kotlin now.** They carry into Flutter unchanged.
- **Exit:** ADR accepted; `flutter doctor` green on Windows (Android); Mac access date known.

### F1 — Contract and Dart foundation (1.5–2 weeks)
- Write `pigeons/nudgio_api.dart` from `NativeMediaReminder.ts` and `types.ts`; generate code.
- Dart `core/` (AppError, Result, Logger with build-variant gating, feature flags), `NudgioClient` wrapper, and a mock HostApi and demo dataset (port `mockNativeModule.ts`, `demoNativeModule.ts`, `mocks/fixtures.ts`).
- Port pure-logic tests: `toAppError`, `reminderStatus`, `reminderActions`, `libraryAlbums`, `folderDestinations`, `formatStorageSize`, `PauseAll`.
- **Exit:** `flutter test` green; Pigeon output compiles in a stub Kotlin module.

### F2 — Android host swap (1–1.5 weeks)
- `MainActivity` changes from `ReactActivity` to `FlutterActivity`. Keep `singleTask`, the share intent filters and `IncomingShare.capture`.
- Replace `bridge/MediaReminderModule.kt` and `MediaReminderPackage.kt` with `NudgioHostApiImpl`, delegating to the **same** services. Event emitters move to Pigeon streams.
- Remove `com.facebook.react` plugins and dependencies, Hermes and autolinking from Gradle; add the Flutter Gradle plugin.
- QA build type with `applicationIdSuffix ".flutter"` so it installs beside the production app.
- **Exit:** Flutter "hello" shell lists real reminders from Room on a device; `./gradlew test lintDebug` green; merged release manifest still has no `INTERNET`.

### F3 — Design system and app shell (2–2.5 weeks)
- Tokens (`palette`, `spacing`, `shape`, `typography`, `motion`, `breakpoints`), theme builder (brand + Material You + contrast checks, porting `contrast.test.ts`), icons, ~30 components, layout primitives, `go_router` shell with 3 tabs and 12 stack routes, l10n ARB, toasts, error boundary, splash and startup gate.
- **Exit:** golden tests for every component in light/dark and at 200% text scale; `TalkBack` pass on the shell.

### F4 — Feature screens (4–5 weeks)
- Port in the order of §6 rows 1–14. Each screen ships with widget tests ported from the matching Jest tests, plus at least one golden test.
- **Exit:** feature parity checklist (every row of MR-05 and DL-080…DL-110 behaviours) ticked on a device.

### F5 — Android parity and cutover (1.5–2 weeks)
- Device matrix (MR-14), cold-start time, APK size (use `--split-per-abi`; compare to today's 32 MB universal APK), battery idle check (no new wakeups).
- **Upgrade test:** install v2.3.1, create real data (reminders, albums, media, skip, pause), upgrade to the Flutter build signed with the same key, verify everything survives and the next alarm still fires.
- Release with `--obfuscate --split-debug-info`; keep the symbol files privately for crash reading.
- Release **Android v3.0.0**.
- **Exit:** v3.0.0 on GitHub Releases; no regressions open at P0/P1.

### F6 — iPhone core in Swift (4–5 weeks, needs a Mac)
- **G1 first.** Compile and run the existing `ios/Feasibility` AlarmKit target, run the 11 G1 device cases and record results in `docs/ios/evidence/G1-platform-capabilities.md`. Any FAIL changes this plan before more work.
- `NudgioKernel` Swift package: Core Data model mirroring Room entities (reminders, schedule rules, occurrences, media assets, albums, profiles, preferences, operation journal); `AlarmCoordinator` (from `ios/Feasibility/AlarmKitBackend.swift`); media store under Application Support with `NSFileProtectionComplete`; serial command actor.
- `NudgioHostApiImpl.swift` implements the Pigeon contract group by group (§5), with an XCTest round trip per group.
- Carry over the 7 Android lessons from the 6 Oct plan §4 (storage reserve with `volumeAvailableCapacityForImportantUsageKey`, duplicate-hash reuse, integrity sweep, media-hash backup round trip, one-shot permission primer, cancellable import, stale alerting session).
- **Exit:** create → lock → alarm → Stop/Snooze/Open on a real iPhone with the Flutter engine deliberately not started.

### F7 — iPhone features and platform polish (2–3 weeks)
- Same Flutter screens on iOS. Adapt with `.adaptive` constructors and Cupertino widgets where iOS convention differs (navigation bars, switches, date/time pickers, action sheets, swipe-back).
- iPhone capability differences surfaced through `getCapabilitySnapshot`: enabled-reminder cap (start at 20, re-baseline after G1-09), no device ringtones, no escalating vibration, system alarm sound plus "Tap Open to play your video".
- Countdown widget / Live Activity (existing `ios/Countdown`).
- **Exit:** every screen passes VoiceOver, Dynamic Type at the largest size, dark mode and Reduce Motion.

### F8 — iPhone release (2 weeks)
- `PrivacyInfo.xcprivacy` (existing `ios/Shared`), App Store privacy label "Data Not Collected", usage strings (AlarmKit, Photos add-only), export compliance, TestFlight external testers, then App Store review.
- **Exit:** TestFlight build used by at least 5 testers for a week with no alarm-reliability defect; G2/G3 from the iPhone plan pass; App Store approval.

### F9 — Remove React Native (0.5–1 week)
- Delete `src/`, `index.js`, `package.json`/lockfile, Metro, Babel, Jest and ESLint configs, `react-native.config.js`. Keep `web/` and `scripts/` (port release scripts to Dart or keep them on Node).
- Update `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/DEVELOPER_GUIDE.md` and the affected spec documents (MR-07, MR-08, MR-14, MR-18, MR-19).
- **Exit:** `git grep -i "react-native"` only matches history and decision records.

## 8. Data and compatibility

| Case | Plan |
|---|---|
| Existing Android user upgrades to v3.0.0 | No migration: same package, same signing key, same Room DB v8, same DataStore. Covered by the F5 upgrade test |
| New iPhone user | Fresh Core Data store |
| Android → iPhone switcher | **Import the Android backup ZIP on iPhone.** Keep the logical ZIP format shared (6 Oct plan, decision 3). The Swift importer ports the Kotlin validators **including the SEC-02/04/06/10 fixes, plus explicit symlink rejection (SEC-11)**. Android-only fields (escalation profiles, device ringtone URIs) are mapped to iPhone defaults and listed in the import preview |
| iPhone → Android | Same format in reverse. Lower priority, after F8 |
| Rollback | Android: v2.3.1 APK stays on GitHub Releases. Because the schema is untouched, downgrading by reinstalling (after uninstall, using a backup) works. iPhone: none needed before release |

## 9. Security and privacy carry-over

- **No Internet in release, on both platforms.** Flutter's template adds `INTERNET` only in `debug`/`profile` manifests, but plugins can add it. Keep the merged-release-manifest assertion (now in CI, SEC-08) and `tools:node="remove"` for anything a plugin adds. On iOS there are no network calls; ATS stays at defaults.
- **Fix SEC-01…SEC-12 from the audit.** Kotlin fixes in F0 carry over automatically; Swift ports must include them.
- **iOS data protection:** Core Data store and media files use `NSFileProtectionComplete`, except the minimal alarm-metadata envelope that must be readable while locked. This mirrors ADR-017's direct-boot envelope (no labels, no paths).
- **Release hardening:** `--obfuscate --split-debug-info` (Dart), R8 (Kotlin), Swift `-O`. Never ship debug symbols.
- **Plugin vetting rule:** every new pub.dev dependency needs a verified publisher or first-party origin, no analytics or telemetry, no network permission, and a pinned version. Record it in the decision log (AGENTS.md "architectural dependency" rule).
- **Logs:** a Dart `Logger` with the same build-variant gating as `Logger.ts` and `NativeLogger.kt`: no titles, notes or paths in warn/error.

## 10. Effort and timeline (one developer, focused)

| Phase | Weeks | Needs a Mac? |
|---|---|---|
| F0 Decide & setup | 1 | No |
| F1 Contract & Dart foundation | 1.5–2 | No |
| F2 Android host swap | 1–1.5 | No |
| F3 Design system & shell | 2–2.5 | No |
| F4 Feature screens | 4–5 | No |
| F5 Android parity & v3.0.0 | 1.5–2 | No |
| F6 iPhone Swift core (incl. G1) | 4–5 | **Yes** |
| F7 iPhone features & polish | 2–3 | **Yes** |
| F8 iPhone release | 2 | **Yes** |
| F9 Remove RN | 0.5–1 | No |
| **Total** | **≈ 20–27 weeks** | |

F0–F5 can all be done on the current Windows machine. **Get the Mac in place during F3/F4** so F6 can start the moment Android v3.0.0 ships. Running F6 alongside F4 is possible if the contract (F1) is frozen. That shortens the total to about 16–20 weeks at the cost of juggling two platforms at once.

Recurring cost: Apple Developer Program membership (annual) for TestFlight/App Store, and Mac access (CI minutes, rental or purchase).

## 11. Testing strategy

| Level | Tooling | Ported from |
|---|---|---|
| Pure Dart logic | `flutter test` | All `src/**/__tests__/*.test.ts` that test logic |
| Widgets | `flutter test` + `mocktail` fake HostApi | RNTL component and screen tests |
| Visual | Golden tests (light/dark, text scale 1.0/2.0, LTR/RTL) | New; replaces manual brand validation docs |
| Contract | Dart fake vs Kotlin/Swift round-trip tests per method group | `MediaReminderClient.test.ts` |
| Native core | Existing 23 Kotlin JUnit tests (unchanged) + new XCTests | — |
| On device | `integration_test` (create reminder → alarm → Play → Moment) on Android and iPhone | Manual release checklists |
| Alarm without engine | Kill the Flutter engine / do not start it; fire the alarm; Stop/Snooze must work | AGENTS.md hard rule |

## 12. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rewrite regressions in behaviour fixed over DL-080…DL-110 | High | High | Parity checklist built from the decision log; port tests before screens; side-by-side `.flutter` QA build |
| AlarmKit behaviour differs from assumptions | Medium | High | G1 gate before F6 scope is fixed; plan already treats iOS profiles as reduced |
| Mac access keeps slipping | Medium | High (blocks iPhone) | Android v3.0.0 has value on its own; macOS CI runner for compile signal early |
| `video_player` gaps (start offset, audio-only UI) | Low–Medium | Medium | Prototype in F1. Fall back to a thin native player behind Pigeon if needed |
| Flutter engine cold start slows opening the Moment screen | Low | Medium | Alarm surface is native; Flutter only shows after Open; measure in F5 |
| APK size grows | Medium | Low | `--split-per-abi`; RN/Hermes removal offsets the Flutter engine |
| A plugin quietly adds `INTERNET` or telemetry | Low | High (breaks product promise) | CI merged-manifest assertion; plugin vetting rule |
| Spec pack and ADRs drift from code | High | Medium | F0 ADR changes; F9 doc sweep; AGENTS.md updated in F2 |

## 13. Decisions needed from you

| # | Decision | Recommendation |
|---|---|---|
| 1 | Accept Flutter over the approved RN-on-iOS path, given ≈ 2× longer time to iPhone | **Decided 20 Oct 2026: accepted.** Long-term stability matters more than an earlier iPhone release (ADR-023) |
| 2 | Android first (F2–F5) or iPhone core in parallel (F6 alongside F4) | Android first. It de-risks the rewrite on the platform with real users |
| 3 | iOS bundle ID and Apple team | `com.aslam.nudgio` |
| 4 | State management | Riverpod (closest to today's React Query + DI container) |
| 5 | Android → iPhone backup import in iPhone v1 | Yes. It is the main way people will switch |

## 14. ADR-023 — Flutter as the shared UI for Android and iPhone

**Status:** Accepted as the direction (20 Oct 2026). The authoritative copy is in `specs/Markdown/17_Architecture_Decision_Records.md`; this is the draft it was taken from.
**Context:** Nudgio ships on Android only. iPhone users cannot use it. The UI is React Native/TypeScript over a Kotlin core; the approved iPhone path would run RN on iOS over a Swift core.
**Decision:** Replace the React Native UI with a single Flutter (Dart) application used on both Android and iPhone. Keep the Kotlin reliability core on Android unchanged; build a Swift/AlarmKit core on iPhone. Both implement one Pigeon-generated contract derived from `NativeMediaReminder.ts`. Alarm actions on both platforms run without the Flutter engine.
**Consequences:** UI rewrite (~25k lines incl. tests); removal of the npm/Metro toolchain; same Android package, key and schema (no user data migration); ADR-003 (RN UI) is superseded and ADR-IOS-001's RN sentence is amended; every new pub.dev dependency needs a decision-log entry; time to first iPhone release rises to about 20–27 weeks.
**Alternatives rejected:** (a) RN UI on iOS + Swift core: faster to iPhone, but keeps two native-module ecosystems and the Codegen/ObjC++ adapter. (b) Two native UIs (Compose + SwiftUI): best platform fidelity, but doubles UI work forever. (c) A generic cross-platform alarm plugin: hides lifecycle limits behind a shared API, which is unacceptable for an alarm app.
