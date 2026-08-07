---
title: "Edge Cases, Failure Recovery and Conflict Handling"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Define expected behavior for platform, timing, media, storage, concurrency, backup, interaction and lifecycle edge cases."
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
| Document ID | MR-11 |
| Version | 1.0 |
| Status | Approved baseline |
| Last updated | 2026-08-05 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Define expected behavior for platform, timing, media, storage, concurrency, backup, interaction and lifecycle edge cases. |

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

# Failure philosophy

The preferred outcome is not “never fail”; it is **fail visibly, stop harmful side effects, preserve user data, and offer a deterministic next action**. Alert failures stop sound first. Import failures preserve current data. Scheduling failures preserve user intent and expose Needs setup. Unknown device state chooses the less intrusive presentation.

# Severity model

| Severity | Definition | Examples |
|---|---|---|
| Critical | Data loss, unbounded resource use, inaccessible stop action, security boundary escape | ZIP traversal writes outside staging; alarm cannot be silenced |
| High | Core reminder wrong or misleading, repeated duplicate, privacy promise broken | Full-screen over unlocked app; duplicate snooze events |
| Medium | Recoverable feature failure with workaround | Thumbnail missing; custom tone falls back |
| Low | Cosmetic or rare inconvenience | Sort order resets; harmless animation glitch |

# Device and lifecycle cases

## App process killed normally

Expected: system alarm remains; native receiver starts; actions work; RN UI later reflects Room state. No user message needed.

## User force-stops app

Expected: Android may suppress alarms and broadcasts until manual relaunch. On next launch, reconcile and show a one-time Health notice: “Android paused Nudgio after it was force-stopped. Reminders are scheduled again now.” Do not claim the app can self-recover before relaunch.

## Device reboot

Expected: direct-boot envelope reschedules generic next alert; after first unlock, full Room reconciliation restores detail. If the app was installed on external/adoptable storage with delayed availability, show generic notification and retry after unlock/storage available.

## App update

`MY_PACKAGE_REPLACED` triggers reconciliation. Database migration completes before active scheduling. If migration fails, no continuous alert starts; show recovery screen and retain old files/database copy.

## App data cleared/uninstalled

All internal content is gone by Android design. There is no recovery without an external backup. About/Backup copy explains this before it happens; the app cannot intercept uninstall.

# Time cases

## Timezone changes while traveling

Daily/weekday schedules follow new device local time. Once reminders retain absolute instant. Today list refreshes. Avoid alerting twice for the same occurrence key.

## DST spring gap

A nonexistent local time shifts to the first valid instant after the gap by default, with editor disclosure. Alternative Skip policy is P1. Tests cover zones with 30-minute and nonstandard transitions, not only one-hour changes.

## DST fall overlap

Default uses the first occurrence. A persisted overlap policy prevents different recalculation after reboot. The same base occurrence key cannot fire twice.

## Manual clock moved backward

Already resolved occurrences inside the idempotency horizon do not replay. Future wall-clock schedules recalculate. Diagnostics record time-change reconciliation, not personal labels.

## Manual clock moved forward

Due items within grace may alert once; older ones become Missed. Never avalanche many full-screen activities.

## Time changes while an alarm is active

Active session uses elapsed realtime for timeout and remains stable. Displayed clock updates, but the session does not restart or extend.

# Alarm collision cases

## Multiple reminders at same instant

One sound owner and one activity. Queue ordered by scheduled time and UUID. UI shows count. Each action resolves one item unless user explicitly chooses Dismiss all due.

## Snooze collides with another reminder

Whichever is earlier becomes global next. At same instant, base occurrences precede retries/snoozes only if product policy says so; v1 orders by scheduled instant, then user-created base before retry, then UUID. No sound overlap.

## Reminder due while another media item is playing

Show due notification. Locked full-screen behavior is evaluated from actual device state, but active Nudgio playback counts as foreground; use in-app strip and notification. Do not stop accepted media automatically. User can pause and switch.

## Reminder due during system alarm/call/navigation audio

The app requests appropriate audio focus and follows system/channel policy. It does not demand phone permissions or DND bypass. If communication mode is observed, reduce alert to noncompeting notification/vibration by default. Record Limited audio, not failure.

## Rapid repeated actions

Native action nonce and database idempotency guarantee one result. All duplicate intents return resolved state and never create multiple snoozes.

# Lock and presentation cases

## Screen on but lock screen showing

Treat as locked. Full-screen eligible according to profile and platform.

## Screen off but device not keyguard-secured

Treat non-interactive as locked-style presentation because the user is not actively using the phone.

## Device is unlocked but user is idle

Still no forced full-screen. Android notification heads-up is the compliant surface. “Smart Presence” based on inferred idle time is deferred because it can surprise users and require unreliable heuristics.

## Full-screen eligibility revoked

Post normal high-importance notification, start only compliant alert behavior, mark Health Limited and provide system-settings link/test. Do not repeatedly prompt at every occurrence.

## Heads-up not shown

The notification remains in shade. Possible reasons include channel importance, DND, OEM ranking or user settings. Health test explains that app cannot control exact heads-up rendering. Persistent profile MAY re-alert within bounded policy but cannot launch full screen while unlocked.

## Notification permission denied

Do not start an invisible ringing service. Reminder moves to Needs setup or, for a currently due previously active reminder, records BlockedByNotification and becomes visible next launch. No deceptive background audio.

# Media cases

## Original gallery file deleted

No effect after successful import because app owns a copy.

## App-owned file missing

Integrity state Missing; disable attached reminders; due event stops alert and shows Media unavailable. Offer Locate replacement, Restore backup or Delete.

## File changed/corrupted

Hash/probe mismatch marks Changed/Unsupported. Do not overwrite expected hash silently. Playback fails safe. User may replace and update expected hash through explicit repair.

## Unsupported codec on new device

Import/restore can retain the file but mark Unsupported on this device. Reminder remains disabled until replacement or compatible player support. Export preserves original bytes.

## Very long video

Playback is user-controlled. Alarm acceptance does not hold wake lock for entire video beyond normal media playback behavior. Completion semantics remain Accepted unless natural-end tracking is enabled.

## Video contains loud audio

Alarm tone stops before media. Playback volume follows media stream. Preview and Play are explicit. No normalization in v1.

## Media is private on lock screen

User setting can hide title/thumbnail and show “Media reminder.” Full content appears only after unlock/Play. Direct-boot alert is generic.

# Storage cases

## Insufficient space during import

Stop streaming, delete temp, clear operation, preserve original library. Report estimated additional bytes. Do not partially insert media row.

## Insufficient space during export

Destination may retain incomplete file depending provider. Mark operation incomplete, attempt cleanup, and clearly name the partial destination only when provider returns safe display name.

## Insufficient space during restore

Reject before commit after considering staging, current data and rollback reserve. If space changes during commit, rollback. Never delete current media first to “make room” unless Replace plan and rollback are already safe.

## SD card/document provider removed

App-owned media stays internal. Export/import stream fails with provider unavailable and current data remains intact. Custom tone URI fallback uses packaged tone.

## Cache cleared

Regenerate thumbnails; no reminder or source media loss.

# Backup cases

## ZIP renamed or extension removed

Inspect content signature and manifest. Extension is not trusted.

## Archive modified after inspection

Import token binds to staged archive digest. Commit rejects changed bytes/token expiry and requires reinspection.

## Duplicate paths or case variants

Reject archive to avoid ambiguous extraction.

## Checksum missing

v1 requires checksum file; reject as unsupported/incomplete, even when ZIP opens.

## Some media missing

Reject before commit if manifest references absent files. A future partial-recovery tool may import valid independent records, but normal restore remains all-or-nothing.

## Backup from newer version

Inspect and show counts only if safe manifest parse is possible, then block commit with update message. Never guess at unknown required semantics.

## Merge conflict changed during review

Optimistic entity versions invalidate plan. Re-run inspection against current data.

## Crash during replace

Startup sees operation journal, prevents normal mutation and completes rollback/forward recovery. Alarm scheduler is reconciled only after consistent data state.

# Permission and settings cases

## Exact access revoked after reminders scheduled

Permission-change receiver/startup check cancels exact pending alarm, marks affected reminders Limited/Needs setup, schedules an inexact fallback only if user preauthorized Limited mode, and shows one Health notice.

## Notification channel sound changed by user

Treat system choice as effective. Profile page displays mismatch. Do not recreate channel.

## App notification permission reset by hibernation

Health detects blocked notifications on next launch. No silent ringing. Active reminder intent remains preserved.

## Battery saver/Doze

Exact path uses authorized system alarm. Limited path may delay. No battery exemption demand.

# Interaction cases

## Accidental Play then immediate Back

Alarm is already accepted and sound stopped. Returning does not restart alarm. History records Accepted; user can manually mark Dismissed only through details if desired.

## Snooze duration crosses next base occurrence

Warn when custom snooze extends beyond next recurrence. Default behavior creates snooze and still preserves base occurrence, which may result in two future items; user can choose Skip next base for this cycle.

## Delete reminder while due notification exists

Deletion transaction invalidates occurrence/session, stops service and cancels notification. Stale action returns already resolved.

## Edit reminder while active

Active occurrence snapshot keeps its label/profile for current session; edits apply to future occurrences. Delete/disable explicitly resolves current session after confirmation.

## System locale changes

Native alarm strings come from Android resources and update on next component creation. Stored user labels remain unchanged. Weekday display reorders; persisted ISO mask does not.

## Font scale changes during active alarm

Activity recreates and restores session. Controls remain accessible; sound is not restarted.

# Recovery screen

When an invariant prevents safe normal startup, show a native/React recovery screen with:

- what is affected;
- whether media/files remain present;
- Retry repair;
- Export recoverable backup where safe;
- Restore backup;
- Reset app as last resort;
- diagnostic code.

Reset is never the first action. Recovery export excludes known corrupt records and lists omissions.

# Edge-case acceptance

Every scenario in this document has at least one automated or manual test ID in MR-21. Critical and high cases are release-blocking on all required API levels. OEM-only uncertainty is documented with observed devices and user-visible fallback rather than marked “not reproducible” without evidence.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

