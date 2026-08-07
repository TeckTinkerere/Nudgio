# TODO

Actionable, ordered by priority. Details and rationale live in
`docs/KNOWN_ISSUES.md` and `docs/FUTURE_IMPROVEMENTS.md` — this is the
checklist form.

## Before any real-device testing

- [x] Gradle wrapper (`gradlew`/`gradlew.bat`/`gradle-wrapper.jar`) — was missing from the repo entirely, fetched and confirmed it bootstraps (`./gradlew --version` works).
- [x] `@react-native-community/cli` devDependency — was missing, added; `react-native.config.js`'s now-invalid `platforms: { ios: null }` removed for the new CLI's schema.
- [ ] Get a local Android SDK + JDK 17 set up (`ANDROID_HOME`, `adb`/`emulator` on `PATH`, an AVD created) and run `cd android && ./gradlew assembleDebug test lintDebug` — this has never been done in any environment this project has used so far. Confirms the two Kotlin fixes below actually compile.
- [ ] Verify `ensureChannels()` fix: fresh install, create a Gentle-profile reminder, let it fire without ever tapping "Test reminder" first — confirm the notification appears. (Fixed in `NotificationCoordinator.kt`; unverified by build.)
- [ ] Verify `commitImport` mode validation: send a request with a missing/garbage `mode` from the JS side and confirm it now rejects with `MR_VALIDATION_FAILED` instead of silently merging. (Fixed in `MediaReminderModule.kt`; unverified by build.)

## Bugs (see `docs/KNOWN_ISSUES.md` for full detail)

- [ ] Decide what a due notification's body should show before media exists (currently duplicates the title).
- [ ] Add Robolectric/instrumentation tests for `SchedulerCoordinator`, `AlarmActionProcessor`, `AlarmDispatchReceiver`, `AlarmRingingService`, and the backup import/export pipeline.
- [ ] Stand up `scripts/release`: version stamping (MR-20), keystore-backed signing from environment variables, checksum generation. Remove the hardcoded `versionCode 1`/`versionName "0.1.0"` in `android/app/build.gradle` once it exists.
- [ ] Run one real `release` build with `minifyEnabled true` and smoke-test it — ProGuard/R8 behavior against the reflection-registered TurboModule and Room has never been confirmed.

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
