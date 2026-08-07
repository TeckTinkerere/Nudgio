---
title: "Performance, Battery and Operational Budgets"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Define measurable latency, battery, memory, storage, scalability and reliability budgets with evidence procedures."
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
| Document ID | MR-15 |
| Version | 1.0 |
| Status | Approved baseline |
| Last updated | 2026-08-05 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Define measurable latency, battery, memory, storage, scalability and reliability budgets with evidence procedures. |

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

# Budget philosophy

Battery efficiency is a product requirement. The strongest evidence is structural and measured: no resident idle service, no polling loop, one next system alarm and bounded work at trigger. Percentage battery readings alone are noisy, so release evaluation combines architecture assertions, system wake/service inspection and controlled comparisons.

# Reference device classes

- **Low:** API 26-28, 4 GB RAM, midrange storage.
- **Reference:** current supported Pixel/Samsung-class device, 6-8 GB RAM.
- **High:** current flagship used only to identify headroom, not set minimums.

Budgets apply to release builds with synthetic local data. Thermal throttling, charging and external background activity are controlled or recorded.

# Latency budgets

| Operation | Target | Hard ceiling | Measurement |
|---|---:|---:|---|
| Alarm receiver entry to notification posted | <= 500 ms p95 | 2,000 ms | Native monotonic timestamps |
| Play/Snooze/Dismiss tap to alarm sound stopped | <= 150 ms p95 | 1,000 ms | Action receiver/service timestamp |
| Locked activity visible after receiver entry | <= 900 ms p95 | 2,500 ms | Instrumented frame/activity callback |
| Cold launch to usable shell | <= 2.0 s p95 reference | 3.5 s low | Macrobenchmark/frame metrics |
| Warm launch to usable shell | <= 750 ms p95 | 1.5 s | Macrobenchmark |
| Today query, 1,000 reminders | <= 50 ms p95 | 150 ms | Repository benchmark |
| Earliest occurrence query, 10,000 reminders | <= 100 ms p95 | 250 ms | Room benchmark |
| Full scheduler reconciliation, 10,000 reminders | <= 250 ms p95 | 1 s | Native benchmark |
| Notification action state visible in UI after app open | <= 500 ms p95 | 1.5 s | End-to-end |

The alert is posted before nonessential logging, thumbnail lookup or React events. Personal media metadata cannot block a stop action.

# Idle battery budgets

## Structural invariants

- zero foreground services when no alarm/media/explicit export is active;
- zero held wake locks when idle;
- zero JavaScript intervals used to observe time;
- zero periodic WorkManager jobs for due delivery;
- at most one ordinary next reminder AlarmManager registration;
- no network sockets because Internet permission is absent;
- no startup full-library hash scan.

Any violation is a release blocker regardless of battery percentage.

## Measured target

In a controlled 24-hour test with active reminders configured but none due, Nudgio SHOULD show no statistically meaningful additional battery drain compared with the same device/app-data state without scheduled reminders, and MUST remain below 0.5 percentage points of device battery capacity attributable to the app on reference devices. Because attribution is noisy, failure requires repeated runs and system wake evidence; pass still requires structural invariants.

With eight representative due reminders resolved within one minute, incremental energy is expected only around alert/playback. Media playback energy is reported separately from scheduler idle cost.

# Wakeup budgets

- No periodic wakeups.
- One OS alarm wake per due occurrence, plus one per explicit snooze/retry/test.
- Boot/time/capability reconciliation occurs only on corresponding broadcasts/startup.
- Deferrable maintenance is opportunistic and constrained; default frequency no more than weekly if enabled.
- A single due event must not create repeated wake alarms unless its profile retry policy explicitly schedules them, capped at three.

`dumpsys alarm` evidence must show no accidental duplicate alarm identities after stable state.

# Wake-lock and service budgets

| Resource | Budget |
|---|---|
| Receiver bridge wake lock | <= 10 seconds absolute; normally < 2 seconds |
| Active alarm wake lock | Only while ringing; <= profile timeout; hard cap 10 minutes |
| Ringing foreground service | Starts only for continuous alert; stops <= 1 second after terminal action |
| Import/export foreground service | Avoid in MVP by foreground modal operation; if later used for user-initiated long work, bounded to operation and cancelable |
| Media playback service | Not persistent in MVP; playback activity owns player lifecycle unless background playback is explicitly added later |

Static/runtime tests verify acquisition and release in `try/finally` or session coordinator.

# Memory budgets

| Scenario | Budget |
|---|---:|
| Usable app shell PSS on reference device | <= 220 MB p95 |
| Library with 100 visible thumbnails | <= 260 MB p95; thumbnail cache bounded |
| Native alarm path without RN | <= 90 MB incremental process PSS target |
| Media player 1080p local video | <= 350 MB p95 excluding platform codec variation |
| Import/export additional heap | <= 32 MB regardless of file size |
| Backup JSON parse | streaming or bounded; <= 64 MB additional at 20k records |

Out-of-memory prevention is more important than exact PSS across OEMs. Large byte arrays of media/ZIP are forbidden by code review/lint patterns.

# Storage budgets

- Signed arm64 APK target <= 35 MB; universal APK <= 60 MB, excluding user media.
- Installed code/native libraries target <= 120 MB.
- Database at 10,000 reminders and 90-day history target <= 50 MB.
- Thumbnail cache <= 250 MB and clearable.
- Diagnostics <= 5 MB.
- Pending/rollback storage is visible during backup and cleaned after completion/recovery.
- Imports maintain 250 MB or 5% free reserve after operation.

If React Native/Media3 version changes exceed package budget, release notes explain and optimization issue is opened; functionality/security updates can justify reviewed exceptions.

# File throughput

No universal speed target is promised because document providers and storage vary. Requirements:

- streaming buffer 256 KB-1 MB per active stream, bounded;
- UI progress at least every 500 ms and not more than 10 updates/sec;
- cancellation checked between chunks;
- hashing occurs in the same streaming pass where possible;
- 2 GB import and 5 GB export/restore complete without heap growth proportional to file size;
- no main-thread file I/O.

# UI rendering budgets

- scrolling library targets 60 Hz on reference device with no repeated full-size image decode;
- slow/frozen frames tracked in benchmark screens;
- initial Library loads first page, not all media;
- thumbnails use size-aware decoding and LRU cache;
- forms avoid unnecessary bridge round trips per keystroke;
- alarm activity is native and renders from a compact session snapshot.

# Database scaling

Supported design target:

- 10,000 reminders;
- 20,000 media records subject to storage;
- 50,000 retained occurrences;
- 5,000 categories/tags combined;
- 20,000 ZIP entries.

Pagination is keyset/cursor-based where stable. Search may use Room FTS after P1 profiling; MVP `LIKE` must remain within tested budgets at target scale or FTS is pulled forward.

# Reliability budgets

| Measure | Target |
|---|---:|
| Duplicate terminal action per occurrence | 0 |
| Unresolved active session after timeout/relaunch | 0 |
| Backup round-trip hash mismatch | 0 |
| Data-loss crash-injection cases | 0 |
| Open wake/service leaks in 100-cycle soak | 0 |
| Alarm action native availability | 100% scripted tests |
| Unsupported archive modifying current data | 0 |

# Measurement procedure

1. Use release/QA build with fixed fixture and diagnostics enabled locally.
2. Reset device state, channel settings and app data as defined per test.
3. Run warm-up where relevant.
4. Capture at least three runs; latency reports p50/p95/max where enough samples exist.
5. Record model, OS build, charger, thermal state, battery saver, DND and network state.
6. Inspect AlarmManager registrations, service list and wake locks before/after.
7. Store raw reports in release evidence; publish summarized nonpersonal numbers.

# Regression thresholds

A change fails performance CI/manual gate when a load benchmark regresses more than 15% and crosses a target, when any hard ceiling is exceeded, or when structural battery invariants break. Security/correctness fixes may receive a documented temporary exception with follow-up issue, but never for an unbounded service/wake lock or inaccessible stop action.

# Optimization priorities

1. Stop/action latency and correctness.
2. Idle wake/service elimination.
3. File streaming and memory bounds.
4. Startup shell and capability snapshot.
5. Library scrolling and thumbnail cache.
6. APK size and noncritical animation polish.

This order prevents visible benchmark chasing from weakening alarm safety.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

