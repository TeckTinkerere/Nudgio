---
title: "Requirements Traceability and Acceptance Catalog"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Map normative requirements to priorities, verification evidence and critical release acceptance scenarios."
keywords:
  - Nudgio
  - Android
  - React Native
  - offline-first
  - alarm
  - product design
---

## Document control

| Field | Value |
|---|---|
| Document ID | MR-21 |
| Version | 1.0 |
| Status | Approved baseline |
| Last updated | 2026-08-05 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Map normative requirements to priorities, verification evidence and critical release acceptance scenarios. |

> **Reading rule:** This pack specifies a production-oriented Android application, not a promise that third-party devices will behave identically. Where Android or an OEM controls presentation, timing, sound, or permissions, the app provides transparent status and the strongest compliant fallback.


## Document conventions

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. A requirement ID is stable once published. Requirement IDs may be retired but MUST NOT be reassigned to a different meaning.

| Term | Meaning |
|---|---|
| Reminder | A user-authored instruction that connects content, a schedule, and a presentation profile. |
| Occurrence | One calculated due instance of a reminder. |
| Alarm session | The bounded runtime state created when an occurrence is actively alerting. |
| Media asset | An app-owned local video, audio, image, or text item. |
| Profile | Reusable alert behavior such as Gentle, Standard, or Persistent. |
| Exact-alarm access | Android special app access that allows exact scheduling where the platform requires it. |
| Full-screen intent | Android notification mechanism for urgent, time-sensitive activity presentation. It is not a general overlay. |
| Heads-up notification | System-rendered high-priority notification shown temporarily over the current app when Android permits it. |
| Source of truth | The authoritative specification or local persisted record for a decision or state. |

# Purpose

This catalog is the release-facing index of normative requirements. It does not replace the detailed rationale and algorithms in MR-01 through MR-20. The verification ID points to a test, inspection or review artifact. P0 is required for public v1; P1 may be deferred only when the roadmap explicitly places it after v1.

# Requirement summary

| Domain | Total | P0 | P1 |
|---|---:|---:|---:|
| Product and scope | 39 | 39 | 0 |
| Experience and design | 14 | 12 | 2 |
| Functional behavior | 18 | 17 | 1 |
| Android native and battery | 18 | 18 | 0 |
| Data and storage | 12 | 12 | 0 |
| Backup and migration | 15 | 14 | 1 |
| Security and privacy | 12 | 11 | 1 |
| Accessibility and localization | 10 | 9 | 1 |
| Non-functional budgets | 12 | 12 | 0 |
| Release and maintenance | 10 | 10 | 0 |

# Requirement catalog

## Product and scope

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `PRD-001` | P0 | Core import, scheduling, alert actions, playback and backup work in airplane mode. | `E2E-OFFLINE-001; static manifest` |
| `PRD-002` | P0 | Production manifest contains no INTERNET permission. | `SEC-MANIFEST-001` |
| `PRD-003` | P0 | No account, advertising, analytics or remote configuration is required. | `SEC-STATIC-002; privacy review` |
| `PRD-004` | P0 | Onboarding explains that imported media is copied into app storage and removed on uninstall. | `UX-ONBOARD-001` |
| `PRD-005` | P0 | User-facing copy never promises guaranteed delivery or exact heads-up size. | `COPY-AUDIT-001` |
| `PRD-010` | P0 | Users can import supported video, audio and image through system pickers. | `E2E-IMPORT-001..003` |
| `PRD-011` | P0 | Deleting the original gallery/provider file after import does not break app playback. | `IT-FILE-004` |
| `PRD-012` | P0 | Users can rename, categorize, tag, preview and delete media. | `E2E-LIB-001..005` |
| `PRD-013` | P0 | Deleting referenced media requires an explicit dependency policy. | `E2E-LIB-DELETE-006` |
| `PRD-014` | P0 | Unsupported, corrupt, oversized and low-space imports leave no partial asset. | `IT-FILE-010..014` |
| `PRD-020` | P0 | A reminder combines media, schedule, profile, snooze and label. | `UT-DOMAIN-001; E2E-REM-001` |
| `PRD-021` | P0 | MVP supports once, daily and selected-weekday schedules. | `UT-REC-001..040` |
| `PRD-022` | P0 | Users can create, edit, duplicate, enable, disable and delete reminders. | `E2E-REM-002..008` |
| `PRD-023` | P0 | Editor displays the native-calculated next occurrence before final save result. | `E2E-REM-009` |
| `PRD-024` | P0 | DST gaps and overlaps use documented deterministic policies with disclosure. | `UT-REC-DST-001..020` |
| `PRD-025` | P0 | A reminder is not represented as reliably active when required capability is absent. | `IT-CAP-001..008` |
| `PRD-030` | P0 | Locked or non-interactive devices may use eligible native full-screen alarm presentation. | `IT-PRESENT-LOCKED-001..006` |
| `PRD-031` | P0 | Unlocked interactive devices never receive a forced full-screen activity. | `IT-PRESENT-UNLOCK-001..010` |
| `PRD-032` | P0 | The app does not request or use overlay permission. | `SEC-MANIFEST-002; code search` |
| `PRD-033` | P0 | Play, Snooze and Dismiss work without React Native initialization. | `IT-NATIVE-ACTION-001..009` |
| `PRD-034` | P0 | Attached media begins only after Play. | `IT-PLAY-001` |
| `PRD-035` | P0 | Every ringing path has a visible stop action and finite timeout. | `IT-RING-001..008` |
| `PRD-036` | P0 | Android/OEM ownership of heads-up presentation is explained. | `COPY-AUDIT-002` |
| `PRD-040` | P0 | Idle operation has no resident service, wake lock, JS timer or periodic due worker. | `PERF-IDLE-001..005` |
| `PRD-041` | P0 | Scheduler registers one ordinary globally earliest one-shot alarm. | `IT-SCHED-001..012` |
| `PRD-042` | P0 | Boot, package update, timezone and clock changes reconcile schedules. | `IT-RECON-001..012` |
| `PRD-043` | P0 | Exact-alarm denial/revocation is visible and provides Limited or setup choices. | `IT-CAP-EXACT-001..006` |
| `PRD-044` | P0 | Health accurately explains force-stop limitations after relaunch. | `MAN-FORCESTOP-001` |
| `PRD-050` | P0 | Export creates a local versioned ZIP with logical JSON, media and checksums. | `E2E-BKP-EXPORT-001` |
| `PRD-051` | P0 | Export excludes raw DB, cache, paths, permissions, channels and runtime sessions. | `BKP-CONTENT-001` |
| `PRD-052` | P0 | Import validates path, limits, schema, references, checksums, media and space before mutation. | `SEC-ZIP-001..030` |
| `PRD-053` | P0 | Import provides Inspect only, Merge and Replace. | `E2E-BKP-MODE-001..003` |
| `PRD-054` | P0 | Replace has rollback-ready state and explicit destructive confirmation. | `IT-BKP-ROLLBACK-001..010` |
| `PRD-055` | P0 | Restored reminders re-evaluate device permissions/capabilities before activation. | `E2E-BKP-CAP-001` |
| `PRD-060` | P0 | Critical flows are operable with TalkBack and switch/keyboard access. | `A11Y-TASK-001..010` |
| `PRD-061` | P0 | Critical content/actions remain usable at 200% font scale. | `A11Y-SCALE-001..008` |
| `PRD-062` | P0 | Color is not the sole state indicator. | `A11Y-COLOR-001` |
| `PRD-063` | P0 | Reduced motion removes nonessential movement. | `A11Y-MOTION-001` |
| `PRD-064` | P0 | Alarm actions use explicit verbs and large reachable targets. | `A11Y-ALARM-001..004` |

## Experience and design

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `UX-001` | P0 | Primary navigation is Today, Library, Reminders and Settings. | `UI-NAV-001` |
| `UX-002` | P0 | Permission requests occur at the moment a selected feature needs them, not as a startup wall. | `E2E-ONBOARD-002` |
| `UX-003` | P0 | Today shows next occurrence, today timeline and only capability warnings that affect active reminders. | `UI-TODAY-001..004` |
| `UX-004` | P0 | Reminder editor preserves entered data when capability setup is incomplete. | `E2E-REM-CAP-010` |
| `UX-005` | P0 | In-app due strip is nonmodal and at most min(144dp, 20% usable height). | `UI-STRIP-001..004` |
| `UX-006` | P0 | Unlocked due alert uses Play, Snooze and Dismiss actions in a system notification. | `IT-NOTIF-001..006` |
| `UX-007` | P0 | Locked alarm displays static context and native Play, Snooze and Dismiss; no autoplay. | `IT-ALARM-UI-001..006` |
| `UX-008` | P0 | Snooze confirmation states the absolute next time. | `UI-SNOOZE-001` |
| `UX-009` | P0 | Multiple simultaneous due reminders are queued in one session, not stacked. | `IT-COLLISION-001..005` |
| `UX-010` | P0 | Health distinguishes Ready, Limited and Action needed with consequence and action. | `UI-HEALTH-001..006` |
| `UX-011` | P0 | Backup import shows inspection and conflict plan before commit. | `E2E-BKP-PREVIEW-001` |
| `UX-012` | P0 | Copy is calm, factual and does not shame missed reminders. | `COPY-AUDIT-003` |
| `UX-013` | P1 | Text cards may be added without changing the alarm core. | `UT-TEXT-001` |
| `UX-014` | P1 | Local history uses factual outcomes and no competitive streak pressure. | `UI-HISTORY-001` |

## Functional behavior

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `FUN-001` | P0 | Import streams to a pending file while calculating SHA-256. | `IT-FILE-TXN-001` |
| `FUN-002` | P0 | Promote media atomically and journal every incomplete file operation. | `IT-FILE-TXN-002..009` |
| `FUN-003` | P0 | Internal filenames use UUIDs and never user path segments. | `SEC-PATH-001` |
| `FUN-004` | P0 | Search matches local title, notes, category and tags. | `UT-SEARCH-001..006` |
| `FUN-005` | P0 | Missing media disables dependent reminders and offers repair choices. | `E2E-REPAIR-001` |
| `FUN-006` | P0 | Next occurrence is strictly after cursor and occurrence key is unique. | `PROP-REC-001..002` |
| `FUN-007` | P0 | Snooze creates a child occurrence and does not mutate base recurrence. | `UT-SNOOZE-001..006` |
| `FUN-008` | P0 | Profiles hold bounded sound, vibration, timeout, retry and grace values. | `UT-PROFILE-001..010` |
| `FUN-009` | P0 | Broken custom tone falls back to packaged tone with safe diagnostic. | `IT-AUDIO-004` |
| `FUN-010` | P0 | Only one active alarm session owns sound/vibration. | `IT-COLLISION-006` |
| `FUN-011` | P0 | Alarm terminal actions are idempotent for duplicate intents. | `IT-NATIVE-ACTION-010..020` |
| `FUN-012` | P0 | Play stops alarm before requesting media audio focus. | `IT-AUDIO-PLAY-001` |
| `FUN-013` | P0 | History is optional, local and defaults to 90-day retention. | `UT-RETENTION-001` |
| `FUN-014` | P0 | Diagnostics exclude content names, paths, notes and exact labels. | `SEC-LOG-001..005` |
| `FUN-015` | P0 | Test reminders use synthetic content and do not write user history. | `IT-TEST-REM-001..004` |
| `FUN-016` | P0 | Notification channels are versioned and never recreated to override user choices. | `IT-CHANNEL-001..006` |
| `FUN-017` | P0 | Deleting/editing an active reminder resolves or snapshots current session safely. | `IT-CONCURRENT-001..005` |
| `FUN-018` | P1 | Duplicate media hash flow can reuse existing bytes. | `IT-DEDUP-001` |

## Android native and battery

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `AND-001` | P0 | Use minSdk 26, compileSdk 37 and initial targetSdk 36, refreshed before release. | `BUILD-SDK-001` |
| `AND-002` | P0 | Use SCHEDULE_EXACT_ALARM with contextual education and canScheduleExactAlarms checks. | `IT-CAP-EXACT-007..012` |
| `AND-003` | P0 | Preferred exact scheduling uses setAlarmClock for user-visible due events. | `IT-SCHED-API-001` |
| `AND-004` | P0 | Inexact Limited mode is explicitly selected and labeled as potentially delayed. | `E2E-LIMITED-001` |
| `AND-005` | P0 | AlarmDispatchReceiver claims occurrence before presentation and rejects stale generation. | `IT-DISPATCH-001..010` |
| `AND-006` | P0 | Unknown device state defaults to nonintrusive notification path. | `UT-PRESENT-UNKNOWN-001` |
| `AND-007` | P0 | Full-screen intent is attached only for locked/non-interactive eligible path. | `IT-FSI-001..010` |
| `AND-008` | P0 | Notification denial never starts invisible continuous ringing. | `IT-NOTIF-DENIED-001` |
| `AND-009` | P0 | Native alarm activity is exported false and reconstructs from active session. | `SEC-COMP-001; IT-ACT-001` |
| `AND-010` | P0 | Ringing foreground service is session-bound, mediaPlayback typed and hard-capped. | `IT-FGS-001..012` |
| `AND-011` | P0 | Wake locks have explicit timeouts and are released on every terminal/failure path. | `IT-WAKE-001..015` |
| `AND-012` | P0 | Android 17 background audio rules are tested; alarm audio uses USAGE_ALARM/exact exemption plus compliant FGS path. | `IT-A17-AUDIO-001..006` |
| `AND-013` | P0 | Direct-boot envelope contains no labels/paths and supports generic pre-unlock alert. | `IT-DIRECTBOOT-001..008` |
| `AND-014` | P0 | Wall-clock rules reconcile after TIME_SET/TIMEZONE_CHANGED without replay. | `IT-TIME-001..010` |
| `AND-015` | P0 | Foreground app receives bridge event but notification remains sufficient fallback. | `IT-FG-001..004` |
| `AND-016` | P0 | Notification visibility defaults private and supports generic secret content. | `IT-LOCKPRIV-001..004` |
| `AND-017` | P0 | No DND-policy, phone-state or battery-exemption permission is requested. | `SEC-MANIFEST-003` |
| `AND-018` | P0 | Stop service/audio within one second of terminal action. | `PERF-ACTION-001` |

## Data and storage

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `DAT-001` | P0 | Room is the sole durable logical source of truth. | `ARCH-STATIC-001` |
| `DAT-002` | P0 | Foreign keys/check constraints and unique occurrence keys enforce invariants. | `DB-CONSTRAINT-001..020` |
| `DAT-003` | P0 | Database stores no absolute filesystem paths. | `DB-STATIC-001` |
| `DAT-004` | P0 | Scheduler desired/applied generations implement an outbox reconciliation pattern. | `DB-SCHED-001..008` |
| `DAT-005` | P0 | At most one active_alarm_session exists. | `DB-SESSION-001` |
| `DAT-006` | P0 | File/restore operations have durable phase journals and startup repair. | `DB-OP-001..015` |
| `DAT-007` | P0 | Destructive Room migration is forbidden in release. | `BUILD-DB-001` |
| `DAT-008` | P0 | Every public schema migration has a fixture and invariant test. | `DB-MIG-001..N` |
| `DAT-009` | P0 | Cache is regenerable and clearing it does not remove media/reminders. | `IT-CACHE-001` |
| `DAT-010` | P0 | Storage reserve is checked before import/restore. | `IT-SPACE-001..004` |
| `DAT-011` | P0 | History, diagnostics and idempotency have bounded retention. | `UT-RETENTION-002..005` |
| `DAT-012` | P0 | Startup does not hash/enumerate the full library on the main path. | `PERF-START-001` |

## Backup and migration

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `BKP-001` | P0 | Archive root includes manifest, README, checksums, data JSON and media. | `BKP-SCHEMA-001` |
| `BKP-002` | P0 | Archive identifiers and media UUIDs are stable across round trip. | `E2E-BKP-ID-001` |
| `BKP-003` | P0 | SHA-256 covers every entry except the checksum file itself. | `BKP-HASH-001` |
| `BKP-004` | P0 | Export uses streaming IO and bounded memory. | `PERF-BKP-001..004` |
| `BKP-005` | P0 | Import rejects absolute, traversal, NUL, symlink, duplicate and case-collision entries. | `SEC-ZIP-001..012` |
| `BKP-006` | P0 | Import enforces entry count, per-entry, total-size, ratio, JSON-depth and string limits. | `SEC-ZIP-013..022` |
| `BKP-007` | P0 | Every reference, count, size, checksum and media header is validated before commit. | `BKP-VALID-001..012` |
| `BKP-008` | P0 | Validated staging is represented by expiring digest-bound import token. | `SEC-TOKEN-001..006` |
| `BKP-009` | P0 | Merge conflict choices are deterministic and serializable. | `UT-CONFLICT-001..040` |
| `BKP-010` | P0 | Replace creates rollback-ready state before removing current data. | `IT-BKP-ROLLBACK-011..020` |
| `BKP-011` | P0 | Crash at each restore phase repairs to old or fully committed state. | `IT-BKP-CRASH-001..N` |
| `BKP-012` | P0 | Unsupported major archive version never modifies current data. | `BKP-COMPAT-001` |
| `BKP-013` | P0 | Permissions, channels, ringtones and platform paths are not restored as app data. | `BKP-EXCLUDE-001` |
| `BKP-014` | P0 | Plain ZIP privacy warning appears before export and import custody is clear. | `UX-BKP-PRIV-001` |
| `BKP-015` | P1 | Encrypted archive uses reviewed authenticated format and new version, never custom crypto. | `SEC-ENC-DESIGN-001` |

## Security and privacy

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `SEC-001` | P0 | Android automatic cloud backup and device transfer exclude all app data. | `SEC-BACKUP-001..004` |
| `SEC-002` | P0 | Android components are exported false unless explicitly documented. | `SEC-COMP-002` |
| `SEC-003` | P0 | PendingIntents are explicit and immutable; state/nonce is verified. | `SEC-PI-001..008` |
| `SEC-004` | P0 | FileProvider exposes only completed export paths with read-only grants. | `SEC-FP-001..006` |
| `SEC-005` | P0 | Selected URIs are treated as untrusted streams with bounded validation. | `SEC-URI-001..006` |
| `SEC-006` | P0 | No archive field becomes SQL or a path without typed validation. | `SEC-INJECT-001..006` |
| `SEC-007` | P0 | Release logs/diagnostics contain no private media metadata. | `SEC-LOG-006..012` |
| `SEC-008` | P0 | Signing key and credentials never enter repository, logs or AI prompts. | `REL-KEY-AUDIT-001` |
| `SEC-009` | P0 | Dependency changes are pinned, licensed, scanned and permission-reviewed. | `SEC-SUPPLY-001..006` |
| `SEC-010` | P0 | Release includes SBOM and third-party notices. | `REL-SBOM-001` |
| `SEC-011` | P0 | Security reporting route does not require users to upload private media/backups. | `DOC-SECURITY-001` |
| `SEC-012` | P1 | Optional screen protection is user-controlled and does not block normal ownership use. | `UI-PRIVACY-001` |

## Accessibility and localization

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `ACC-001` | P0 | Interactive elements expose meaningful name, role, state and enabled status. | `A11Y-SEM-001..010` |
| `ACC-002` | P0 | Touch targets are at least 48dp; alarm actions at least 56dp. | `A11Y-TARGET-001` |
| `ACC-003` | P0 | Initial alarm focus and order are summary, Play, Snooze, Dismiss, more. | `A11Y-FOCUS-001` |
| `ACC-004` | P0 | Alarm title/time is announced once without repeated focus stealing. | `A11Y-ANNOUNCE-001` |
| `ACC-005` | P0 | Swipe-only or long-press-only critical actions have direct alternatives. | `A11Y-MOTOR-001` |
| `ACC-006` | P0 | Progress announces phase/meaningful thresholds, not every byte. | `A11Y-PROGRESS-001` |
| `ACC-007` | P0 | Strings are externalized, plural-aware and not concatenated. | `L10N-STATIC-001` |
| `ACC-008` | P0 | Layouts use start/end and pass RTL pseudo-locale. | `L10N-RTL-001..006` |
| `ACC-009` | P0 | Date/time follows locale and 12/24-hour system preference. | `L10N-TIME-001` |
| `ACC-010` | P1 | Tamil/Arabic release requires native-speaker review of critical copy. | `L10N-REVIEW-001` |

## Non-functional budgets

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `NFR-001` | P0 | Receiver entry to notification is <=500ms p95 and <=2s hard on reference devices. | `PERF-ALERT-001` |
| `NFR-002` | P0 | Action tap to sound stop is <=150ms p95 and <=1s hard. | `PERF-ACTION-001` |
| `NFR-003` | P0 | Cold usable shell is <=2s p95 reference and <=3.5s low class. | `PERF-START-002` |
| `NFR-004` | P0 | Earliest occurrence query at 10k reminders is <=100ms p95 and <=250ms hard. | `PERF-DB-001` |
| `NFR-005` | P0 | Import/export heap growth is bounded and independent of file size. | `PERF-IO-001..004` |
| `NFR-006` | P0 | No-due 24h test has no structural idle violation and <=0.5 percentage-point attributed drain target. | `PERF-IDLE-006` |
| `NFR-007` | P0 | No wake/service leak remains after 100-cycle alarm soak. | `SOAK-ALARM-001` |
| `NFR-008` | P0 | Scheduler supports 10k reminders and 50k retained occurrences. | `PERF-SCALE-001` |
| `NFR-009` | P0 | Diagnostics <=5MB and thumbnail cache <=250MB with eviction. | `PERF-STORAGE-001` |
| `NFR-010` | P0 | Universal APK target <=60MB and arm64 target <=35MB, reviewed exceptions allowed for security. | `PERF-APK-001` |
| `NFR-011` | P0 | Critical/High data, security, alarm-action and accessibility defects are zero at release. | `QA-GATE-001` |
| `NFR-012` | P0 | All operations preserve old or complete state under injected crash. | `QA-ATOMIC-001` |

## Release and maintenance

| ID | Priority | Requirement | Verification |
|---|---|---|---|
| `REL-001` | P0 | Public APK is signed and tied to an immutable source tag. | `REL-SIGN-001` |
| `REL-002` | P0 | Release publishes artifact SHA-256 and signing certificate fingerprint. | `REL-HASH-001` |
| `REL-003` | P0 | Release includes privacy, known limitations, changelog, licenses and documentation. | `REL-ASSET-001` |
| `REL-004` | P0 | Published artifact is independently downloaded, verified and installed. | `REL-PUBLISH-001` |
| `REL-005` | P0 | Upgrade tests cover every supported public database and archive version. | `REL-UPGRADE-001` |
| `REL-006` | P0 | Manifest and current Android/RN/Play policy baseline are refreshed before release. | `REL-RESEARCH-001` |
| `REL-007` | P0 | Portfolio claims use measured achieved evidence, not planned budgets. | `PORT-AUDIT-001` |
| `REL-008` | P0 | Public screenshots/demo use owned, licensed, public-domain or synthetic media. | `PORT-LICENSE-001` |
| `REL-009` | P0 | No debug APK, signing key or private fixture is published. | `REL-SECRET-001` |
| `REL-010` | P0 | End-of-life or withdrawn release is clearly labeled with export/recovery guidance. | `REL-EOL-001` |


# Verification suite dictionary

| Prefix | Evidence type |
|---|---|
| `UT` / `PROP` | Pure unit or property test |
| `DB` | Room constraint, DAO, migration or query test |
| `IT` | Android instrumented integration test |
| `E2E` | User-flow end-to-end test |
| `SEC` | Security/static/fuzz/manifest test |
| `A11Y` / `L10N` | Manual and automated accessibility/localization test |
| `PERF` / `SOAK` | Measured performance, battery or long-run reliability evidence |
| `UI` / `COPY` | Component, screenshot, interaction or content review |
| `BUILD` / `ARCH` | Build-time or dependency-boundary inspection |
| `REL` / `PORT` / `DOC` | Release, portfolio or documentation evidence |
| `MAN` | Controlled manual platform scenario |

A range such as `IT-NATIVE-ACTION-001..009` is a defined group in the test repository/report, not permission to claim unimplemented placeholders. Before release, the generated QA report expands every range into concrete passing cases.

# Critical acceptance scenarios

## AC-01 - First reminder offline

Given a clean install in airplane mode, the user imports a supported local video, creates a daily Standard reminder and sees a correct next occurrence. No network permission or request exists.

## AC-02 - Locked presentation

Given notifications/exact/full-screen eligibility and a locked non-interactive phone, when the reminder is due, a native alarm surface appears, sound/vibration follows profile, and Play/Snooze/Dismiss work with RN disabled.

## AC-03 - Unlocked noninterruption

Given the user is actively using another app, when a reminder is due, no full-screen activity launches. Android receives a high-importance notification without FSI and actions are available. Absence of a heads-up due to system settings is reported as platform behavior, not overridden with overlay.

## AC-04 - Play transition

Given an active alert, when Play is selected, sound/vibration stops within the action budget, the occurrence resolves once, and attached media begins only after the player becomes visible. Missing media fails safe without continued ringing.

## AC-05 - Snooze idempotency

Given duplicate Snooze PendingIntents for one nonce, exactly one child occurrence is created, one next alarm is registered, and every duplicate response returns the same absolute snooze time.

## AC-06 - Process death and reboot

Normal process death does not prevent the due native alert. Reboot restores a generic pre-unlock envelope and full detail after unlock. No labels or paths exist in device-protected storage.

## AC-07 - Exact access revoked

Future exact alarms are canceled/reconciled, active intent is retained, Health shows Limited/Action needed, and no silent inexact downgrade occurs unless preauthorized.

## AC-08 - Notification blocked

No invisible continuous sound service starts. The occurrence is recorded blocked/needs setup and the next app launch explains recovery.

## AC-09 - Import interruption

Crash/cancel/storage loss at each copy phase leaves no partial normal asset and startup repair reaches a documented state.

## AC-10 - Export/import round trip

All supported logical records are canonically equal after clean-device Replace restore and every media hash matches.

## AC-11 - Malicious archive

Traversal, absolute, duplicate, symlink, bomb, invalid checksum and higher-major fixtures are rejected before current data or scheduler changes.

## AC-12 - Replace crash recovery

Termination at every restore phase recovers to the old state or complete new state, never mixed references or missing current data without rollback path.

## AC-13 - Accessibility

A TalkBack user at 200% font completes import, reminder creation, locked alert action, Health recovery and backup inspection without focus trap, clipped action or color-only information.

## AC-14 - Idle battery

With reminders configured and none due, no process/service/wake lock/timer is resident for time monitoring and one ordinary alarm registration exists.

## AC-15 - Public release integrity

The downloaded APK matches published SHA-256, verifies under the published certificate fingerprint, upgrades from prior public version, and contains no prohibited permission/exported component.

# Release acceptance decision

A release is **Accepted** only when every P0 row has passing evidence, all critical scenarios pass, and no Critical/High blocker remains in the domains defined by MR-14. `Not applicable` requires a written reason tied to product scope and reviewer approval; it cannot be used to hide an unimplemented P0 feature. Any platform limitation is accepted only when the specified fallback and user disclosure both pass.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

