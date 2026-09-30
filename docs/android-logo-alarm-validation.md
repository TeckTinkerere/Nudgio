# Android logo and alarm-settings pass — 2026-09-29

## Behaviour and requirements

| Requirement | Change | Evidence / remaining acceptance |
|---|---|---|
| MR-04; ACC-003 | Approved blue n/apricot logo in adaptive launcher, onboarding and About; existing Ink & Apricot semantic colours retained. | Exact source/drawable SHA-256 checked. Device mask, small-size and TalkBack checks remain. |
| PRD-001/002/003; FUN-001/002 | User media originals remain unchanged; no lossy compression or upload introduced. | Existing streamed import retained; local quality policy documented. No claim of new media compression savings. |
| FUN-009 | Custom tone failure advances to system alarm tone, then an original packaged PCM tone. Late callbacks cannot restart a stopped player. | `AlarmToneFallbackTest`: 3 JVM cases. Actual decoder/audio-route tests still required. |
| AND-008; PRD-035 | App/channel/group denial prevents continuous ringing at dispatch and promotion. Re-check after reading preferences; Stop/Silence during that suspension cannot start sound afterward. | `NotificationDeliveryPolicyTest`: 3 JVM cases. Permission-revocation and service race scenarios need a device. |
| AND-007; PRD-031 | Presentation previews use the real locked/non-interactive and FSI eligibility decision. | Existing `DevicePresentationStateTest`; native compile. Locked/unlocked device proof outstanding. |
| UX-010; PRD-025 | Health uses scheduler outbox acknowledgement and channel eligibility; distinguishes unknown, pending, idle and inexact. Channel action opens Android notification settings. | `SchedulerHealthTest`: 4 JVM cases; settings round-trip needs device verification. |
| PRD-005; FUN-015 | Profile preview copy accurately describes presentation-only coverage. | Copy inspection. Preview is not a full ringing/retry/Snooze test. |
| MR-03 Settings; MR-13 time formatting | Ringtone success follows persistence; playback state follows native success; failed saves/previews are visible; device-time-format option restored. | `SettingsScreen.test.tsx`: 3 component cases. |

Native preference reads/writes now reject failures through the error envelope rather than leaving promises pending. Native tone previews have a six-second bound independent of JavaScript and cannot let an old timeout stop a newer preview. Profile lists read persisted Room rows (existing defaults are retained during the first-create seeding window). Startup reports the actual media count and schema version.

## Files

- `assets/brand/`, `scripts/import-brand-logo.cjs`, native `drawable-nodpi/nudgio_logo.jpg`, `ic_launcher_foreground.xml`, `BrandLogo.tsx`, `EmptyState.tsx`, onboarding and About.
- `SettingsScreen.tsx`, its component tests and English strings.
- `AlarmToneFallback.kt`, `NotificationDeliveryPolicy.kt`, `SchedulerHealth.kt` and their JVM tests.
- `AlarmDispatchReceiver.kt`, `AlarmRingingService.kt`, `NotificationCoordinator.kt`, `CapabilitySnapshotProvider.kt`, `MediaReminderModule.kt`.
- `res/raw/nudgio_alarm.wav`, reproducible original-tone generator, `scripts/check-android-local.cjs`.

## Compatibility and impact

No Room migration (schema remains 5), archive change, new dependency, permission, background component, sync or network client. Existing reminder IDs, media files and schedules remain intact. Ringtone fallback stays inside the existing bounded ringing service; preview timers exist only during a user-initiated preview. No idle polling or additional scheduled alarm was added. Existing notification channels and user channel choices are retained.

Logo source remains 2048 × 2048, 1,518,429 bytes, byte-identical to the supplied JPEG. It is displayed at UI sizes, not rewritten. Imported originals retain their original detail; thumbnails remain disposable browsing previews. See `local-image-quality-policy.md`.

## Verification status

The final command results are recorded in DL-078. Native tests and component tests are not physical-device acceptance. `adb devices` returned an empty device list. No emulator or phone behaviour was verified.

No APK was built: repository AGENTS.md requires a clean primary checkout up to date with origin/main, and this checkout contains ongoing Android/iOS work. Native compilation, resources, unit tests and manifest processing do not package an APK.

## Required device checks

1. Choose/save a ringtone; restart the app; preview and stop it. Background/leave Settings during preview and confirm sound stops within six seconds.
2. Use an unavailable custom tone; verify system/packaged fallback. Stop/Snooze/Dismiss/Silence while audio prepares; verify no later restart.
3. Deny notifications, disable the alarm channel, and block its group where supported. Verify no invisible continuous ringing and an actionable Health state.
4. Preview and deliver a real reminder while unlocked, locked, screen-off, FSI denied, and exact access denied. Confirm truthful limited-state copy and no forced unlocked takeover.
5. Exercise all three profiles, timeout/retry bounds, reboot, Doze, phone calls and headphones; confirm native actions work with React Native unavailable.
6. Check launcher circle/squircle masks, dark/light themes, large fonts and TalkBack.

The v2 folder foundation now includes the Room 5→6 migration, one-level graph rules, atomic membership commands, optimistic revision checks, bounded moves and a ten-minute undo record. The React Native library surface and archive 2.0 media-byte stream are still release blockers: the bridge/UI must expose the commands, and backup import/export must stream and validate original files before v2.0.0 is stamped. iPhone physical-device G1 and cross-device sync remain unchanged.

## DL-078 evidence update

2026-09-30: Android JVM verification passed 17 suites / 137 tests with zero failures, errors or skips. The release manifest inspection still reports only the approved local alarm permissions; logo source and drawable remain byte-identical (1,518,429 bytes; SHA-256 `2876accf958c3a5053e0dbdd2ae481d5443879031caf3c869361dc39111e5d51`). React Native verification passed typecheck, lint and 13 suites / 66 tests; Jest reports its existing worker-open-handle force-exit warning. `git diff --check` passed. No phone/emulator was connected, and no APK was produced.
