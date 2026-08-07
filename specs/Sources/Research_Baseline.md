# Research snapshot

This document records current external platform facts used to choose the baseline. It is not a substitute for refreshing official documentation before implementation or release. Software versions, distribution requirements and permission policies are temporally unstable.

# Baseline conclusions

- Android 17 is released and API 37 is the current compile/compatibility target.
- React Native 0.86.x is the current active stable production line on 2026-08-05; 0.87 is scheduled but not stable until 2026-08-10.
- Google Play's published 2026 requirement for new apps/updates is target API 36 or higher.
- Exact alarms are appropriate for core user-facing alarm functions, but SCHEDULE_EXACT_ALARM is user-granted and may be denied/revoked.
- Full-screen intent is restricted to genuine calling/alarm cases and is not an overlay substitute.
- Heads-up notification geometry/presentation is owned by Android/OEM and cannot be fixed to exactly 20% of the display.
- Android 17 background audio hardening reinforces a bounded foreground-service/visible-activity lifecycle; alarm audio with exact access and USAGE_ALARM receives a documented exemption from the additional target-37 WIU condition, but still needs a valid lifecycle.
- Photo Picker/SAF and app-specific storage satisfy selected-file import without broad gallery permission.
- Android Auto Backup can move app data unless configured; explicit data extraction exclusions are required for the strict manual local-only promise.

# Official source register
| ID | Official source | Baseline fact and design impact | Recheck |
|---|---|---|---|
| `SRC-001` | [Android 17 is here](https://developer.android.com/about/versions/17/blog-release) - Android Developers, accessed 2026-08-05 | Android 17 was released in June 2026 and is the current platform compatibility baseline. **Impact:** Compile and compatibility test against API 37; do not assume target policy without checking Play requirements. | Before every release or Android QPR compatibility cycle. |
| `SRC-002` | [React Native Releases Overview](https://reactnative.dev/releases/overview) - React Native, accessed 2026-08-05 | React Native 0.86.x is an active stable series on 2026-08-05; 0.87 stable is scheduled for 2026-08-10 and is not yet the production baseline. **Impact:** Pin 0.86.x for initial implementation and reevaluate after 0.87 stabilizes with native dependency compatibility. | Before repository bootstrap and every RN upgrade. |
| `SRC-003` | [Meet Google Play target API level requirement](https://developer.android.com/google/play/requirements/target-sdk) - Android Developers, accessed 2026-08-05 | New apps and updates must target Android 16/API 36 or higher under the published 2026 requirement. **Impact:** Initial targetSdk 36; refresh before Play submission. | Before every store submission. |
| `SRC-004` | [Schedule alarms](https://developer.android.com/develop/background-work/services/alarms) - Android Developers, accessed 2026-08-05 | AlarmManager can operate outside the app lifetime; exact alarms require appropriate access on modern Android and setAlarmClock is the most visible critical exact mechanism. **Impact:** Use one next one-shot alarm, request SCHEDULE_EXACT_ALARM contextually, check revocation and avoid polling. | When target SDK or alarm policy changes. |
| `SRC-005` | [Android 14 behavior changes - exact alarms](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms) - Android Developers, accessed 2026-08-05 | SCHEDULE_EXACT_ALARM is denied by default for many fresh installs targeting Android 13+ on Android 14. **Impact:** Treat exact access as setup state and restore permissions separately from backup. | When minimum/target policy changes. |
| `SRC-006` | [Android 14 behavior changes - full-screen intent](https://developer.android.com/about/versions/14/behavior-changes-14) - Android Developers, accessed 2026-08-05 | For target 34+, full-screen intent eligibility is restricted to calling and alarm use cases and store policy may revoke default access. **Impact:** Use FSI only for genuine locked alarm behavior, probe eligibility and provide notification fallback. | Before Play submission and target SDK update. |
| `SRC-007` | [Display time-sensitive notifications](https://developer.android.com/develop/ui/views/notifications/time-sensitive) - Android Developers, accessed 2026-08-05 | Full-screen intents are for urgent time-sensitive cases and are delivered through notifications, not arbitrary app overlays. **Impact:** Native alarm activity is launched by eligible notification only in locked/non-interactive path. | When notification/full-screen APIs change. |
| `SRC-008` | [About notifications](https://developer.android.com/develop/ui/views/notifications) - Android Developers, accessed 2026-08-05 | Android controls notification surfaces including heads-up behavior. **Impact:** Do not promise precise heads-up height/duration; design compact content and effective channels. | When Material/notification behavior changes. |
| `SRC-009` | [Notification runtime permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission) - Android Developers, accessed 2026-08-05 | Android 13+ uses POST_NOTIFICATIONS runtime permission for nonexempt notifications. **Impact:** Request contextually and never start invisible ringing when blocked. | When target SDK/permission behavior changes. |
| `SRC-010` | [Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby) - Android Developers, accessed 2026-08-05 | Doze defers background work and imposes quotas; exact alarm use must be justified. **Impact:** No polling; explicit exact/limited modes; bounded retries. | When Android background policy changes. |
| `SRC-011` | [Background audio hardening](https://developer.android.com/about/versions/17/changes/bg-audio) - Android Developers, accessed 2026-08-05 | Android 17 restricts background audio unless a visible activity or compliant foreground service exists; exact-alarm permission plus USAGE_ALARM has a documented exemption for the additional target-37 WIU condition. **Impact:** Use bounded mediaPlayback FGS for ringing, USAGE_ALARM, visible notification and explicit stop lifecycle; test API 37 hardening. | Before targeting API 37 and after QPR changes. |
| `SRC-012` | [Photo picker](https://developer.android.com/training/data-storage/shared/photo-picker) - Android Developers, accessed 2026-08-05 | Photo Picker gives access to selected images/videos instead of the whole media library and falls back to ACTION_OPEN_DOCUMENT where unavailable. **Impact:** Avoid broad media permission for visual imports. | When picker/activity dependency changes. |
| `SRC-013` | [Access documents and other files from shared storage](https://developer.android.com/training/data-storage/shared/documents-files) - Android Developers, accessed 2026-08-05 | Storage Access Framework supports user-selected documents and create/open flows. **Impact:** Use for audio/general import and ZIP export/import. | When storage policy changes. |
| `SRC-014` | [Access app-specific files](https://developer.android.com/training/data-storage/app-specific) - Android Developers, accessed 2026-08-05 | Internal app-specific storage is private, needs no storage permission and is removed on uninstall. **Impact:** Copy media into internal app storage and disclose uninstall behavior. | When storage architecture changes. |
| `SRC-015` | [Save data in a local database using Room](https://developer.android.com/training/data-storage/room) - Android Developers, accessed 2026-08-05 | Room provides SQLite abstraction, compile-time query verification and migration support. **Impact:** Use Room as native source of truth with migration tests. | When Room major version changes. |
| `SRC-016` | [Setting up file sharing](https://developer.android.com/training/secure-file-sharing/setup-sharing) - Android Developers, accessed 2026-08-05 | FileProvider supports secure content URI sharing with temporary grants. **Impact:** Share completed exports read-only without exposing internal paths. | When provider/share code changes. |
| `SRC-017` | [Back up user data with Auto Backup](https://developer.android.com/identity/data/autobackup) - Android Developers, accessed 2026-08-05 | Auto Backup can include cloud and device-to-device data; allowBackup=false alone may not disable D2D on every Android 12+ manufacturer implementation. **Impact:** Provide dataExtractionRules and legacy exclusions for all app data; manual ZIP is the supported transfer. | When target SDK or backup policy changes. |
| `SRC-018` | [Native Modules: Introduction](https://reactnative.dev/docs/next/turbo-native-modules-introduction) - React Native, accessed 2026-08-05 | Turbo Native Modules and Codegen provide a typed New Architecture bridge to native platform code. **Impact:** Define coarse-grained typed native use cases and keep alarm path native. | With each RN upgrade. |
| `SRC-019` | [Principles for improving app accessibility](https://developer.android.com/guide/topics/ui/accessibility/principles) - Android Developers, accessed 2026-08-05 | Android accessibility guidance emphasizes labels, accessible actions, non-color cues and accessible media. **Impact:** TalkBack/alternative action/contrast requirements are P0. | Before accessibility audit. |
| `SRC-020` | [Test your app accessibility](https://developer.android.com/guide/topics/ui/accessibility/testing) - Android Developers, accessed 2026-08-05 | Effective accessibility testing combines approaches and user-perspective testing. **Impact:** Manual TalkBack/task evidence supplements automated scanning. | Before release. |

# Source quality rules

1. Use Android Developers, React Native and other primary official documentation for platform/library decisions.
2. Community posts may identify an OEM symptom but cannot define platform guarantees.
3. Record access date and exact target/API affected.
4. When official sources disagree or are ambiguous, choose the safer less intrusive behavior and add a physical-device test.
5. Never cite a future scheduled release as stable before its actual official release date.
6. Refresh this document before selecting dependency versions, changing target SDK, submitting to a store, or publishing reliability claims.

# Known uncertainty

OEM notification ranking, battery policies, lock-screen behavior and audio routing remain partially device-controlled even when the app follows official APIs. The product therefore uses a Health/Test flow and an observed device matrix. This is not treated as a reason to request overlay or unrestricted battery permission.

Android developer verification and sideloading policy is evolving in 2026. Direct APK guidance must be refreshed immediately before public distribution. The technical pack intentionally avoids a promise that any current sideload process remains unchanged indefinitely.

# Baseline refresh checklist

- Confirm latest stable React Native and compatible Gradle/AGP/JDK matrix.
- Confirm current Android release/API and target SDK requirement.
- Re-read exact-alarm and full-screen intent policy plus Play declarations.
- Re-read foreground service types/background audio behavior.
- Confirm Photo Picker/SAF and backup/data extraction behavior.
- Run compatibility tests on current Android/QPR and at least one OEM build.
- Update ADR-019 if baseline changes; update MR-06, MR-14, MR-20 and traceability.
