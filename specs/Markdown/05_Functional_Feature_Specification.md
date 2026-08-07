---
title: "Functional Feature Specification"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Define feature behavior, validation, state transitions and acceptance rules independent of UI implementation details."
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
| Document ID | MR-05 |
| Version | 1.0 |
| Status | Approved baseline |
| Last updated | 2026-08-05 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Define feature behavior, validation, state transitions and acceptance rules independent of UI implementation details. |

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

# Feature model

A reminder is a composition rather than a copied bundle:

`Reminder = Media asset + Schedule rule + Reminder profile + Snooze policy + Label metadata`

A media asset can have many reminders. A shared profile can have many reminders. An occurrence is derived from a reminder, and an active alarm session is derived from one occurrence at a time.

# Media import and ownership

## Supported MVP types

| Kind | Accepted source | Validation | Playback |
|---|---|---|---|
| Video | Photo Picker or document picker | MIME sniff, extension advisory, size, readable stream, Media3 probe | Native Media3 player |
| Audio | Document picker | MIME sniff, size, readable stream, Media3 probe | Native Media3 player |
| Image | Photo Picker or document picker | Decode bounds and image header | Native image viewer |
| Text | App editor, P1 if deferred | UTF-8 length and safe rendering | Native/React Native text card |

The allowlist is finalized by instrumented codec tests. File extensions MUST NOT be trusted as the sole type check.

## Import transaction

1. Create a `pending_file_operations` record and random temporary filename.
2. Open the content URI through `ContentResolver`.
3. Stream into app-specific temporary storage with a bounded buffer while calculating SHA-256.
4. Abort if declared and actual size exceeds product limits or storage reserve.
5. Probe media and extract safe metadata.
6. `fsync` as appropriate, then atomically rename into `files/media/<uuid>.<ext>`.
7. Insert the media record and complete the pending operation in one logical commit.
8. Generate thumbnail as derived cache; thumbnail failure does not invalidate the source asset.

A crash leaves either no committed media row or a recoverable pending operation. Startup repair removes expired temporary files and reconciles operations.

## Asset deletion

Deletion is two-phase: mark pending-delete and disable/deal with dependencies in a transaction, delete physical file, then finalize the row. If file deletion fails, keep a repair record and hide the asset from normal views only after the user-selected dependency policy is durable.

# Library management

- **FUN-001:** Search MUST match normalized title, notes, category and tags locally.
- **FUN-002:** Filters and sort order MUST survive navigation and MAY persist as user preference.
- **FUN-003:** Categories are single-valued per asset in MVP; tags are many-to-many.
- **FUN-004:** Renaming an asset changes metadata only, never its internal filename.
- **FUN-005:** File integrity check recalculates hash on demand and marks Missing, Changed or Healthy.
- **FUN-006:** A missing asset disables attached reminders and offers Locate replacement, Delete, or Restore from backup.

# Reminder lifecycle

States:

- Draft - editor not committed;
- Disabled - persisted but not considered by scheduler;
- Needs setup - enabled intent exists but a required platform capability is missing;
- Active - eligible and has a calculable next occurrence;
- Snoozed - one child occurrence is scheduled while base rule remains unchanged;
- Archived - hidden from default lists, retained for history;
- Deleted - tombstoned only during backup/import transaction, then removed under retention policy.

Enabling runs validation in this order: media availability, schedule validity, profile validity, notification capability, exact-alarm mode decision, full-screen eligibility if requested. The UI MUST report all applicable issues, not stop at the first.

# Schedule rules

## Once

Stores a timezone-aware instant plus the originating zone and local representation for display. Once fired and resolved, it becomes inactive unless snoozed.

## Daily

Stores local wall-clock time and time zone behavior. Default policy is **follow current device timezone**, suitable for a person traveling. An advanced fixed-zone option is P1. Calculation always returns the first valid future occurrence after the scheduling cursor.

## Selected weekdays

Stores a 7-bit weekday mask and local wall-clock time. Locale affects display order only; persisted weekday identity is ISO Monday=1 through Sunday=7.

## Recurrence invariants

- The next occurrence MUST be strictly later than the calculation cursor.
- A resolved occurrence MUST NOT be regenerated with the same occurrence key.
- Snooze MUST NOT mutate the recurrence rule.
- Clock rollback MUST not replay an already resolved occurrence inside the idempotency horizon.
- Timezone change recalculates wall-clock schedules; once schedules remain tied to their instant.

# Profiles

A profile contains notification behavior, sound source reference, vibration pattern, locked-screen full-screen eligibility, timeout, retry policy, grace window and default snooze. Built-in profile identifiers are stable. Users can edit safe values but cannot delete a built-in profile; they may reset it.

Sound sources:

- built-in packaged alarm tone;
- Android default alarm tone resolved per device;
- user-selected document URI only when persistable access is valid;
- no media video's audio before Play.

A broken custom tone falls back to packaged tone and logs a local diagnostic event.

# Alert actions

## Play

Atomic effects:

1. acquire action idempotency key;
2. stop ringtone/vibration and release wake resources;
3. mark occurrence Accepted and active session TransitioningToMedia;
4. launch or reveal the native media player with asset UUID;
5. start media only after the activity is visible and audio focus is granted;
6. calculate next occurrence and reschedule global alarm;
7. mark session MediaPlaying.

If media is missing, stop alert first, show a clear error, mark outcome AcceptedMediaUnavailable and offer to open Library. Never continue ringing because playback failed.

## Snooze

Stops active alert, validates duration, creates one snoozed occurrence with a new occurrence UUID and parent pointer, recalculates the globally earliest event, then confirms absolute time. Multiple identical intents with the same session/action nonce return the original result.

## Dismiss

Stops alert, records Dismissed, clears active session and recalculates. Dismiss does not disable future recurring occurrences.

## Timeout

Stops all active resources. The occurrence becomes Missed unless a profile explicitly records TimedOut. Persistent retry logic is bounded by retry count and absolute session lifetime.

# Notification behavior

Notification channels are stable and user-owned once created:

- `reminder_gentle_v1` - default importance, no full-screen intent;
- `reminder_standard_v1` - high importance, sound/vibration defaults;
- `reminder_persistent_v1` - high importance, alarm-oriented defaults;
- `reminder_status_v1` - low importance for background operation status, used only when legally required;
- `reminder_errors_v1` - default importance for import/export completion or repair, not alarm delivery.

Because channel sound/importance cannot be silently overridden after creation, profile screens must distinguish app preference from channel-effective behavior and link to Android channel settings.

# Foreground in-app behavior

When the app is foregrounded, the same native due event is persisted and posted as a notification for system history/action resilience. React Native receives an event and shows an in-app strip. If the event bridge fails, the notification remains sufficient. The strip and notification share an action nonce so double taps cannot produce duplicate snoozes.

# Reminder collision policy

Only one active alarm session owns sound/vibration. Due occurrences are placed in a native queue ordered by scheduled instant then stable UUID. The visible activity shows “1 of N” when more exist. Dismissing one advances to the next; **Dismiss all due** is available behind an explicit overflow action. No overlapping services play competing audio.

# History

MVP history is optional and local. It stores scheduled time, actual trigger time, action and completion time; it does not store media frames or content. Default retention is 90 days. The user can clear history without deleting reminders. No streak language, rankings or remote analytics.

# Categories and tags

Category names are unique under Unicode case-folded comparison within a user profile. Deleting a category moves assets to Uncategorized. Tags are reusable and deletion removes relationships only. Import conflict handling is specified in MR-10.

# Settings

Settings groups:

- Reminder defaults: default profile, snooze choices, timeout;
- Appearance: theme, thumbnail autoplay off, 12/24-hour follows system;
- Accessibility: reduce motion follows system, stronger haptics toggle where supported, announce due time;
- Storage: usage, orphan repair, clear derived cache;
- Health: permissions and test reminders;
- Backup: export/import and backup warning;
- Privacy: local-only statement, history retention, diagnostic export;
- About: version, licenses, source, limitations.

# Diagnostics

A local diagnostic ring buffer stores technical event codes, timestamps, app version, OS version, device manufacturer/model, permission state snapshots and timing deltas. It MUST NOT include media bytes, titles, notes, category names, file names, exact reminder labels or selected paths. Export is user-initiated JSON and previewable before sharing.

# Test reminder

The Health screen can schedule a one-shot test 15 seconds ahead. It uses a synthetic label, packaged tone and no personal asset. The user selects Locked test or Unlocked test and receives instructions. Test events never alter history, streaks or recurring schedules and are clearly distinguishable in notification IDs.

# Import/export features

Export supports all data or selected assets/reminders. The all-data path is P0; selection export MAY be P1. Share is invoked only after archive closure and checksum calculation using FileProvider read-only URI grants. Import never trusts internal absolute paths or filenames.

# Feature acceptance invariants

- Every user action that stops an alert is native-first and idempotent.
- Every file operation is staged and recoverable.
- Every schedule change triggers deterministic next-event recalculation.
- Every destructive action identifies dependent data.
- Every system-owned capability is displayed as observed state, not silently assumed.
- Every background component has a bounded lifetime and documented reason.
- Every archive is fully validated before modifying current data.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

