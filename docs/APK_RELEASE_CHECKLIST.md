# APK / Play Store Release Checklist

Concrete, specific to this app's actual current state — not a generic
Android checklist. Cross-check against `specs/Markdown/20_Release_Distribution_Portfolio_and_Maintenance_Guide.md`
(MR-20) for the full policy; this is the executable version.

## Blocking — nothing below is possible without these

- [x] **A local Android SDK + JDK 17(+).** Available and exercised for the first time 2026-08-07 (JDK 21 via Android Studio's bundled JBR; AGP 8.12.0 accepts it despite the `sourceCompatibility 17` target). No build has ever *succeeded* though — see the next item.
- [ ] **Run `cd android && ./gradlew assembleRelease` at least once** and confirm it succeeds with `minifyEnabled true`. Currently impossible: `assembleDebug`/`assembleRelease` both fail at `:app:generateCodegenSchemaFromJavaScript` before Kotlin ever compiles — see `docs/KNOWN_ISSUES.md` "Open — Critical" (the TurboModule bridge's TypeScript contract isn't Codegen-compatible). `proguard-rules.pro` is still empty either way (relying on React Native's bundled consumer rules) — watch for `ClassNotFoundException`/reflection failures in the TurboModule (`MediaReminderModule`) or Room-generated code once a build can actually run.
- [x] **Signing.** `scripts/release/` now exists — `android/app/build.gradle` reads `RELEASE_STORE_FILE`/`RELEASE_STORE_PASSWORD`/`RELEASE_KEY_ALIAS`/`RELEASE_KEY_PASSWORD` env vars, falling back to gitignored `android/keystore.properties` (template: `android/keystore.properties.example`). See `scripts/README.md`. You still need a real keystore generated and stored *outside* this repo — nothing here creates one for you — and this is unverified against an actual `assembleRelease` run since that's currently blocked (see above).
- [x] **Version stamping.** `scripts/release/stamp-version.js` writes `android/version.properties` (`versionCode` monotonic, `versionName` semver-validated); `android/app/build.gradle` reads it instead of hardcoding. See `scripts/README.md`.

## Manifest / permissions audit

Current manifest declares exactly: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK`, `USE_FULL_SCREEN_INTENT`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. No `INTERNET`, no `SYSTEM_ALERT_WINDOW`, no broad media/gallery access, no battery-exemption request, no location/contacts/camera/microphone/phone-state.

- [ ] Re-confirm this list is still exactly true before every release — a transitive dependency bump is the most likely way a new permission sneaks in unnoticed. `grep -A2 uses-permission android/app/src/main/AndroidManifest.xml` and diff against the list above.
- [ ] Confirm every receiver/service/activity except `MainActivity` is still `exported="false"` (the manifest's own comment says every exported component gets a manifest test — check that test exists and passes, or add it).
- [ ] Confirm `SCHEDULE_EXACT_ALARM` usage still matches Play's exact-alarm permission policy for your target API level at release time — this is a policy area Google has changed before and may change again; re-read the current Play Console policy, don't assume MR-06's text is still current (MR-22's own instruction: "refresh current platform facts, don't assume").

## Play Console data-safety form

This should be the easy part, given the product's actual scope — confirm it stays that way:

- [ ] "Data collected": none (no accounts, no analytics SDK, no ads SDK, no `INTERNET` permission at all).
- [ ] "Data shared with third parties": none.
- [ ] Backup export is user-initiated and local-only (a ZIP the user explicitly creates and shares themselves) — this is not "data collection" by the app and should be described as such, not left ambiguous.

## Direct-boot / reboot testing (do this on a real device, not an emulator if possible)

- [ ] Set a reminder, reboot the device with the screen locked, and confirm the generic direct-boot notification appears if the reminder was due while off, or that a real notification appears after unlock reconciliation runs.
- [ ] Confirm `MY_PACKAGE_REPLACED` handling (`SystemEventReceiver`) by reinstalling an updated build over an existing one with a pending reminder — confirm the alarm re-registers.
- [ ] Force-stop the app while an alarm is actively ringing (`AlarmRingingService` foreground service) and confirm `START_STICKY` recovery re-promotes the session correctly.

## Battery / OEM testing

- [ ] Test on at least one aggressive-battery-management OEM device (Xiaomi/MIUI, Oppo/ColorOS, Samsung, or similar) with default battery settings (the app never requests exemption — confirm the alarm still fires reliably under each OEM's default restrictions, since `battery_environment` capability is report-only).
- [ ] Confirm the app does not appear in the device's "apps running in background" battery drain lists under normal use (no polling, no persistent service outside an actively-ringing session — verify this is still true, not just documented).

## Functional smoke test (manual — no automated coverage exists for most of this, see `docs/KNOWN_ISSUES.md`)

- [ ] Create, edit, delete a reminder of each repeat type (once/daily/weekly/monthly/yearly/custom).
- [ ] Let an alarm fire in each profile (Gentle/Standard/Persistent), locked and unlocked, and exercise Play/Snooze/Dismiss from both the notification and the in-app card.
- [ ] Confirm the notification actually displays for a Gentle-profile reminder that fires as the very first alarm after a fresh install (regression check for the `ensureChannels()` fix in this pass).
- [ ] Export a backup, then import it (Merge, then separately Replace with the typed confirmation) and confirm reminders survive round-trip.
- [ ] Toggle dark/light/system theme, Material You on/off, 200% font scale, and TalkBack — confirm every screen this app currently ships (Today, Library, Reminders, Settings, Reminder Editor/Detail, Media Detail, Statistics, Backup, Import, About, Health, Onboarding) still reads and operates correctly.

## Listing

- [ ] Screenshots, feature graphic, short/long description — none of this exists yet in the repo; needs to be produced separately.
- [ ] Privacy policy URL (`about.privacyDetails` currently just displays a bare link string, not a live one — confirm the destination page exists and is accurate before publishing).
