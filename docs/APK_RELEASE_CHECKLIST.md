# APK / Play Store Release Checklist

Concrete, specific to this app's actual current state — not a generic
Android checklist. Cross-check against `specs/Markdown/20_Release_Distribution_Portfolio_and_Maintenance_Guide.md`
(MR-20) for the full policy; this is the executable version.

## Blocking — nothing below is possible without these

- [ ] **A local Android SDK + JDK 17.** Not available in any environment this project has used so far (`docs/decision-log.md` DL-004). No build in this repo's history has ever actually been compiled. This is the first gate, before anything else on this list means anything.
- [ ] **Run `cd android && ./gradlew assembleRelease` at least once** and confirm it succeeds with `minifyEnabled true`. `proguard-rules.pro` is currently empty (relying on React Native's bundled consumer rules) — watch for `ClassNotFoundException`/reflection failures in the TurboModule (`MediaReminderModule`) or Room-generated code at runtime, which ProGuard/R8 stripping could theoretically cause and which nothing has verified yet.
- [ ] **Signing.** `android/app/build.gradle` deliberately has no signing config (MR-18: "Release commands are scripted and never request signing secrets from source-controlled files"). `scripts/release` — where this belongs — does not exist yet (see TODO.md). You need: a keystore (generated and stored *outside* this repo), a signing config read from environment variables, and a documented, repeatable release-build command before a Play Console upload is possible at all.
- [ ] **Version stamping.** `versionCode 1` / `versionName "0.1.0"` are currently hardcoded in `android/app/build.gradle`, contradicting its own comment that a release script stamps them. Either wire that script or hand-bump both deliberately before every release — do not ship two builds with the same `versionCode`.

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
