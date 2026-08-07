# TODO

Actionable, ordered by priority. Details and rationale live in
`docs/KNOWN_ISSUES.md` and `docs/FUTURE_IMPROVEMENTS.md` — this is the
checklist form.

## Before any real-device testing

- [x] Gradle wrapper (`gradlew`/`gradlew.bat`/`gradle-wrapper.jar`) — was missing from the repo entirely, fetched and confirmed it bootstraps (`./gradlew --version` works).
- [x] `@react-native-community/cli` devDependency — was missing, added; `react-native.config.js`'s now-invalid `platforms: { ios: null }` removed for the new CLI's schema.
- [x] Get a local Android SDK + JDK 17 set up and run `cd android && ./gradlew assembleDebug test` — **succeeds as of 2026-08-07**, first time in this project's history. `app-debug.apk` exists on disk; all 70 Kotlin unit tests pass. Took 4 fixes to get there: `compileSdk 37`->`36` (DL-041), AGP `8.12.0`->`8.10.0` for IDE compatibility (DL-044), the TurboModule bridge contract redesign (DL-045), 5 real Kotlin bugs the first compile surfaced (DL-046), a missing `autolinkLibrariesWithApp()` call (DL-047), and one test-authoring bug (DL-048).
- [x] **App now actually launches and renders on a physical device (V2446, Android 16 / API 36) — first time, 2026-08-08.** Took three fixes, all launch blockers, none of which `npm run verify` or `./gradlew test` could have caught: `SoLoader.init(this, false)` -> `OpenSourceMergedSoMapping` (DL-049, native `UnsatisfiedLinkError` before any JS), a missing `src/debug/` source set so the debug build could reach Metro at all (DL-050), and a module-scope `new Intl.PluralRules('en')` that Hermes does not implement, which nulled the whole `features/library` barrel (DL-051). Today + Library tabs verified rendering with no JS errors.
- [ ] `./gradlew lintDebug` now runs successfully (an earlier `react-native-safe-area-context` lint-analysis crash didn't reproduce on a fresh daemon — likely JVM Metaspace exhaustion, not a real bug) and found **5 real errors + 29 warnings** in our own Kotlin code (re-counted from `lint-results-debug.xml` on 2026-08-08; the earlier "6" was wrong). Not a build blocker (`assembleDebug`/`test` don't depend on it) — triage and fix separately. Full report: `android/app/build/reports/lint-results-debug.html`. The 5:
  - `NotificationCoordinator.kt:133`, `:177`, `:208` — `MissingPermission`: all three `manager.notify()` calls are unguarded against a denied `POST_NOTIFICATIONS` on Android 13+. Fix once, in a single private posting helper, rather than three times at the call sites.
  - `AlarmActivity.kt:98` — `MissingSuperCall` **and** `GestureBackNavigation` on the same `onBackPressed()` override; both are resolved by the `OnBackPressedDispatcher` migration already listed under Housekeeping, so do them together.
- [ ] Verify `ensureChannels()` fix on a real device/emulator: fresh install, create a Gentle-profile reminder, let it fire without ever tapping "Test reminder" first — confirm the notification appears. (Fixed in `NotificationCoordinator.kt`, now compiles — never yet run on a device.)
- [ ] Verify `commitImport` mode validation on a real device/emulator: send a request with a missing/garbage `mode` from the JS side and confirm it now rejects with `MR_VALIDATION_FAILED` instead of silently merging. (Fixed in `MediaReminderModule.kt`, now compiles — never yet run on a device.)

## Bugs (see `docs/KNOWN_ISSUES.md` for full detail)

- [x] Bottom safe-area insets (DL-052, 2026-08-08). `Screen`'s non-scrollable branch applied no bottom inset at all despite the header claiming otherwise, so fixed-layout and list screens put content and buttons under the gesture bar; `SettingsScreen` meanwhile reserved it twice and showed a dead gap above the tab bar. Fixed in `Screen.tsx` plus a `screenLayout` on `TabNavigator` that zeroes the inset for tab screens, with no per-screen edits. Verified on device.
- [ ] Audit remaining screens for **top** inset correctness: `hasAppBar` tells `Screen` the app bar consumed `insets.top`, so any screen passing it without actually rendering an `AppBar` draws under the status bar / camera cutout. `LibraryScreen` is a confirmed case and is being fixed separately; grep `hasAppBar` across `src/features` and check each one renders an `AppBar`.

- [ ] Decide what a due notification's body should show before media exists (currently duplicates the title).
- [x] JVM unit tests for the backup module's pure-Kotlin pieces (`BackupZipStructuralValidator`, `BackupChecksums`, `BackupFormat`, `BackupManifest`, `BackupScheduleRuleCodec`, `BackupConflictPlanner`) — ~40 cases added 2026-08-07, `android/app/src/test/java/com/aslam/mediareminder/backup/`.
- [ ] Add instrumentation tests (`android/app/src/androidTest/`, using the already-declared `androidx.test`/`espresso-core`/`room-testing` deps — no new dependency needed) for `SchedulerCoordinator`, `AlarmActionProcessor`, `AlarmDispatchReceiver`, `AlarmRingingService`, and `BackupExporter`/`BackupImporter` — all Room/Context-dependent, can't run as plain JVM tests.
- [x] Stand up `scripts/release`: version stamping (`stamp-version.js`) and checksum generation (`checksums.js`) added and verified 2026-08-07 — both are plain Node, no Gradle dependency, tested directly. Env-var/`keystore.properties`-based signing wired into `android/app/build.gradle`. `versionCode`/`versionName` now read from `android/version.properties` instead of being hardcoded. See `scripts/README.md`.
- [ ] Run one real `release` build with `minifyEnabled true` and smoke-test it — ProGuard/R8 behavior against the reflection-registered TurboModule and Room has never been confirmed. **No longer blocked**: the `:app:preBuild` Codegen failure this item cited was fixed by DL-045/047, and `assembleDebug` has been green since 2026-08-07.
- [x] Verified `INTERNET` is absent from the **merged release manifest** (2026-08-08). `./gradlew :app:processReleaseManifest` then read `android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml`: exactly 8 permissions (`POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK`, `USE_FULL_SCREEN_INTENT`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`), no `INTERNET`, and no `usesCleartextTraffic`/`networkSecurityConfig` — DL-050's debug-only additions do not leak into release. The single "INTERNET" string match is the header comment's own MR-06 exclusion list.
- [ ] Turn that release-manifest check into an automated CI gate (MR-18 "repository rules prevent prohibited permissions"). It is currently a manual command whose result is only recorded in this file, so it cannot fail a build.

## Features (see `docs/FUTURE_IMPROVEMENTS.md` for full detail)

- [ ] Media import + library persistence (native side) — the largest gap between built UI and working backend.
- [ ] Backup-import document picker — unblocks the already-real `inspectBackup`/`commitImport`.
- [ ] User-defined reminder profiles (`saveProfile`/`resetBuiltInProfile`).
- [ ] `openCapabilitySettings` deep-links from Settings/Health.
- [ ] Onboarding pages 2-3.
- [ ] Health screen per-item capability rows + Test reminder wiring.
- [ ] Full-screen alarm consent / explicit Limited-mode opt-in UI.

## Housekeeping

- [ ] Symlink-entry rejection in `BackupZipStructuralValidator` (needs Apache Commons Compress — new dependency, needs an ADR per AGENTS.md).
- [ ] If/when predictive back is enabled, migrate `AlarmActivity.onBackPressed()` to `OnBackPressedDispatcher`.
