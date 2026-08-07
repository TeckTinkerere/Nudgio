---
title: "Testing, Quality and Device Matrix"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Define automated and manual quality strategy, device/API coverage, reliability simulations, security tests, evidence and release gates."
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
| Document ID | MR-14 |
| Version | 1.0 |
| Status | Approved baseline |
| Last updated | 2026-08-05 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Define automated and manual quality strategy, device/API coverage, reliability simulations, security tests, evidence and release gates. |

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

# Quality objective

Testing must prove the app is safe under Android lifecycle pressure, not only that screens render. The highest-risk surfaces are native alarm actions, adaptive presentation, scheduling reconciliation, file transactions and backup restore. Test architecture mirrors those boundaries.

# Test layers

| Layer | Scope | Tools/approach |
|---|---|---|
| Pure unit | Recurrence, DST, conflict plan, validators, ID factories | Kotlin/JVM and TypeScript unit tests |
| Database | DAO constraints, transactions, migrations, query plans | Room in-memory/file tests and migration fixtures |
| Native component | receivers, services, activity, notification, permissions | Android instrumentation and fake system adapters where possible |
| React component | forms, a11y semantics, state rendering | React Native Testing Library |
| End-to-end | import-create-trigger-act-export-restore | Physical/emulated device automation plus manual checkpoints |
| Security/fuzz | ZIP/media/intent malformed inputs | Curated malicious fixtures, property tests, fuzz harnesses |
| Performance/battery | latency, wakeups, memory, storage | Android profiling/dumpsys, scripted measurements |
| Visual/accessibility | themes, scale, TalkBack, rotation | Screenshot diff plus human review |

Coverage percentage is informative. Release confidence comes from requirement traceability and risk-based evidence.

# Required API matrix

| API | Android generation | Primary purpose |
|---:|---|---|
| 26 | Android 8.0 | Minimum SDK, channels, background limits baseline |
| 28 | Android 9 | legacy lifecycle/storage behavior and common older device |
| 31 | Android 12 | exact-alarm special access, PendingIntent mutability |
| 33 | Android 13 | notification runtime permission, modern media picker path |
| 34 | Android 14 | exact access default changes, full-screen eligibility restrictions, FGS declarations |
| 36 | Android 16 | initial target behavior and Play deadline baseline |
| 37 | Android 17 | compile/current compatibility, background audio hardening verification |

Emulators cover deterministic API permutations. Physical devices are mandatory for lock screen, audio routing, vibration, Doze, reboot, OEM notifications and battery.

# Physical device matrix

Minimum release evidence:

- one current Pixel/reference Android device;
- one Samsung device with current One UI;
- one older API 26-28 physical device or verified lab device;
- one aggressive-background-management OEM family such as Xiaomi, Oppo, Vivo or equivalent available device;
- one foldable/tablet width test, physical or high-fidelity emulator;
- one low-memory 4 GB-class device.

Document exact model, OS build, security patch and channel settings in QA report. A device unavailable for a release is explicitly marked with risk acceptance; critical adaptive alarm tests cannot be waived on both reference and Samsung.

# Test data

Use synthetic/original fixtures:

- short MP4/H.264/AAC;
- long and large sparse/test media within license;
- MP3/AAC/Opus where supported;
- JPEG/PNG/WebP with varied dimensions/rotation;
- corrupt headers, truncated files, extension/MIME mismatch;
- Unicode/RTL/Tamil/emoji titles;
- 10,000-reminder generated database;
- 5 GB streaming backup fixture;
- every prior public schema/archive version;
- malicious ZIP fixtures: traversal, absolute, duplicate, case collision, symlink, bomb ratio, bad checksum, deep JSON, unresolved references, higher major version.

No private personal video is committed to the repository.

# Unit suites

## Recurrence

Cover once, daily, weekday masks, leap day, month/year boundary, timezone travel, 30/45-minute offsets, DST gap/overlap, clock rollback cursor, grace window and snooze beyond base occurrence. Property: returned occurrence is strictly after cursor and unique per occurrence key.

## Conflict planning

Combinations of same/different UUID, hash, normalized names, profile built-ins, semantic reminders and entity-version changes. Property: every archive record is mapped to import, reuse, skip, replace or explicit conflict; no unresolved reference reaches commit.

## Validators

String length, UUID, MIME header, storage key, URI token, ZIP path normalization, ratio/size arithmetic overflow, JSON depth and action nonce.

# Native alarm test plan

## Presentation matrix

For Gentle/Standard/Persistent, test:

- screen off + secure lock;
- screen on + lock screen;
- unlocked home screen;
- unlocked while another app foreground;
- Nudgio foreground;
- full-screen permission eligible/ineligible;
- notification permission granted/denied;
- channel high/default/blocked;
- exact access granted/denied;
- TalkBack on;
- portrait/landscape;
- Doze and battery saver.

Assertion: no unlocked case launches `AlarmActivity`; locked eligible cases do; all fallbacks are visible and actionable.

## JS independence

Build/instrument a mode that prevents React Native initialization. Trigger an occurrence and verify native Play, Snooze, Dismiss, timeout, service stop and reschedule. This is P0 evidence.

## Lifecycle

Kill process, swipe app away, reboot, package update, timezone change, manual clock change, rotate alarm, service recreation and low-memory pressure. Force-stop is tested for correct limitation copy after manual reopen, not impossible wake behavior.

## Soak

Run at least 100 scheduled trigger/action cycles across profiles with random process kills and actions. Assert no duplicate occurrences, stale notifications, service leaks, wake-lock leaks or scheduler generations left unapplied.

# Media and file tests

- Delete original after import; playback still works.
- Cancel at each copy phase.
- Fill storage during copy.
- Crash after temp complete, after rename and before/after DB commit.
- Change/delete internal file through debug harness and run repair.
- Decode thumbnail failure while source remains valid.
- Unsupported codec restore on another device.
- Two simultaneous import attempts are serialized/bounded.
- FileProvider share grants read only and expires.

# Backup tests

## Round trip

Export fixture, clean app data, import Replace, compare logical canonical JSON and every media SHA-256. Repeat across supported app versions and devices.

## Merge

Run every conflict class and verify reviewed plan exactly matches committed mapping. Change local data after preview and assert token invalidation.

## Fault injection

Terminate process at every restore phase, restart, and assert documented rollback/forward recovery. Simulate provider removal and disk full.

## Security

No malicious fixture modifies current data or writes outside private staging. Peak memory remains bounded. Parsing time has a security timeout/complexity budget.

# Accessibility and visual tests

Automated scanner/lint checks are supplemented by manual TalkBack scripts. Screenshot baselines cover key screens at light/dark, compact/medium, English/RTL pseudo-locale and 100/200% scale. Visual diffs are reviewed, not auto-approved solely by threshold.

Alarm action labels, focus order, announcement repetition and vibration/audio alternatives receive manual signoff.

# Battery and performance tests

- 24-hour no-due-reminder idle comparison against clean baseline;
- 24-hour with representative 8 due reminders;
- inspect `dumpsys alarm`, service state, wake locks and battery attribution;
- receiver-to-alert timestamp instrumentation;
- action-to-sound-stop instrumentation;
- cold/warm startup on reference low/mid device;
- 2 GB import and 5 GB backup streaming memory;
- 10,000 reminders query/reconciliation.

Measurements follow MR-15 and include at least three runs after warm-up where applicable.

# Release regression suite

P0 automated suite includes:

1. database migrations;
2. recurrence and DST properties;
3. alarm action idempotency;
4. manifest permission/exported-component checks;
5. backup malicious fixtures;
6. clean round trip;
7. native alarm JS-disabled instrumentation;
8. locked/unlocked presentation;
9. wake/service leak assertions;
10. accessibility smoke.

A tagged release cannot be built from a commit that did not pass the release workflow. Manual evidence is attached to the release QA record.

# Defect policy

| Severity | Release rule |
|---|---|
| Critical | Zero open; release artifact withdrawn if discovered |
| High | Zero open for data, alarm action, privacy, adaptive presentation or a11y; exceptional cosmetic high requires owner signoff |
| Medium | May ship only with documented workaround and no requirement breach |
| Low | Triaged into backlog |

Flaky tests are defects. Quarantining a P0 alarm/backup/security test requires explicit issue, owner and replacement evidence; it cannot remain silently skipped.

# Test environment controls

Record notification permission, exact access, FSI eligibility, channel importance, DND, battery saver, timezone, locale, lock type, charger state and manufacturer optimization settings. Reset these between cases. Test notification channels use versioned IDs to avoid previous user choices contaminating results.

# QA evidence package

Each release produces:

- requirement traceability results;
- device matrix and OS builds;
- automated test summary;
- migration/archive compatibility matrix;
- battery/performance measurements;
- accessibility checklist;
- security scan/SBOM summary;
- known limitations;
- release APK/AAB hashes and source commit.

# Exit criteria

P0 traceability is green, all critical/high blockers closed, physical locked/unlocked tests passed, 100-cycle soak passed, round-trip backup passed, no excluded permission present, idle architecture evidence passed and representative PDFs/docs correspond to the release design.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

