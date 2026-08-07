---
title: "Roadmap, Release and Success Metrics"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Define implementation increments, exit gates, future scope, local success measurement and change management."
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
| Document ID | MR-16 |
| Version | 1.0 |
| Status | Approved baseline |
| Last updated | 2026-08-05 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Define implementation increments, exit gates, future scope, local success measurement and change management. |

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

# Delivery strategy

Build vertical, testable increments that establish the native reliability spine before visual breadth. Each milestone ends with a tagged internal build and evidence. A feature is not moved forward with unresolved data-integrity or alarm-action debt.

# Milestone 0 - repository and decisions

Deliver:

- React Native 0.86.x Android project with New Architecture;
- Kotlin module skeleton and Codegen contract;
- Room/DataStore setup;
- CI for lint, type check, unit tests and manifest policy;
- source-of-truth specs, ADRs, contribution and security files;
- synthetic media fixtures and no Internet permission.

Exit: debug and release variants build; native contract smoke passes; repository rules prevent prohibited permissions.

# Milestone 1 - app-owned media library

Deliver import through system picker, staged copy/hash/probe, Room asset records, thumbnail cache, Library and media detail, delete dependency policy and repair journal.

Exit: original source deletion does not break playback; crash injection passes each import phase; unsupported/low-space cases safe; TalkBack library flow usable.

# Milestone 2 - reminder domain and scheduler

Deliver profiles, reminder editor, once/daily/weekdays recurrence, occurrence calculator, one-global-alarm coordinator, exact access/limited state and Today/Reminders screens.

Exit: DST/timezone unit suite passes; 10,000 reminder reconciliation budget met; stable OS alarm count is one; permission denial preserves intent.

# Milestone 3 - native adaptive alarm

Deliver receiver, action receiver, notification channels, bounded ringing service, native alarm/player activities, device-state decision, foreground in-app strip, boot/time recovery and Test reminder.

Exit: React Native-disabled Play/Snooze/Dismiss passes; no unlocked full-screen launch; locked eligible full-screen works; service/wake lock stops; 100-cycle soak passes on reference and Samsung.

# Milestone 4 - backup and recovery

Deliver logical ZIP export, checksums, inspection, malicious archive validation, Merge/Replace conflict plan, rollback journal, capability re-evaluation and user-selected save/share.

Exit: clean-device round trip equality/hash passes; all malicious fixtures reject; crash at every phase recovers; 5 GB stream stays in memory budget.

# Milestone 5 - accessibility, privacy and polish

Deliver final design tokens/components, dark/system theme, 200% scaling, TalkBack, RTL readiness, local diagnostics, privacy notice, platform backup exclusions and complete Health flows.

Exit: accessibility manual script passes; privacy/manifest audit passes; screenshots contain only safe original/synthetic content; copy makes Android limits clear.

# Milestone 6 - release candidate

Deliver signed candidate, SBOM, release QA package, migration/archive matrix, battery evidence, APK checksums, changelog, portfolio case study and known limitations.

Exit: MR-21 P0 green, no critical/high blockers, physical matrix complete, documentation and source tag aligned.

![Release pipeline](../Diagrams/10_release_pipeline.png)

# Version 1.0 scope lock

V1 contains video/audio/image import, once/daily/weekdays reminders, three profiles, adaptive locked/unlocked presentation, snooze/dismiss/play, offline storage, Health, logical ZIP backup, accessibility baseline and GitHub APK distribution. Text cards may ship if they do not delay the reliability gate; otherwise they move to 1.1.

No cloud sync, accounts, overlay permission, prayer-time calculation, automatic social media downloads, iOS, Wear OS or emergency claims are accepted into 1.0.

# Post-release roadmap

## 1.1 - quality and expression

- text cards;
- custom user profiles;
- richer local search and duplicate hash handling;
- Tamil localization;
- optional local history summaries;
- widget feasibility.

## 1.2 - portability and language

- passphrase-encrypted archive v2 with migration;
- Arabic localization and full RTL signoff;
- selected-item export;
- archive recovery/repair viewer;
- profile export/import choices.

## 2.0 - extensibility review

- playlist/random pool model;
- user-operated cloud document target without app backend, only after privacy ADR;
- Wear OS companion feasibility;
- plugin boundary for prayer-time or external trigger calculators;
- iOS research with honest capability differences.

Major version is not promised until user evidence supports it.

# Success measurement without telemetry

The app does not upload usage. Product success is measured through:

- opt-in moderated usability sessions using synthetic data;
- public issue reports and release downloads at repository level, with privacy limits acknowledged;
- local Health status shown to the user but not transmitted;
- test/QA metrics from controlled fixtures;
- optional anonymous feedback form hosted separately from the app, clearly not embedded core telemetry.

Local history is for the user, not product analytics.

# V1 success criteria

| Dimension | Target |
|---|---|
| Usability | At least 5/6 representative testers import and schedule without facilitator correction |
| Adaptive presentation | 100% scripted locked/unlocked cases choose correct surface |
| Native resilience | 100% action tests pass with RN disabled |
| Battery structure | No idle service/wake lock/polling; one next alarm |
| Backup | 100% logical/hash round trip fixtures; zero malicious mutations |
| Accessibility | All critical task scripts pass TalkBack and 200% scale |
| Release quality | Zero critical/high blockers; signed checksum-published APK |
| Privacy | No Internet/overlay/broad gallery permission; automatic platform backup excluded |

# Feedback triage

Feedback categories:

- reliability/platform;
- data/backup;
- accessibility;
- media compatibility;
- UX/copy;
- feature request;
- security/private report.

Reliability and data-loss reports receive reproduction templates that request device/OS/settings and privacy-safe diagnostics, never private media by default. Platform-specific behavior is added to the observed OEM matrix.

# Change management

A proposal follows:

1. problem and user evidence;
2. scope/non-goal check;
3. permission, battery, privacy and backup compatibility impact;
4. ADR if architectural;
5. spec/traceability update;
6. implementation and migration in same change;
7. release evidence.

“Small” features that add Internet, overlay, persistent service, broad storage, new backup fields or native background entry are architectural changes.

# Deprecation policy

- Public backup major versions receive a stated reader support window.
- Notification channel versions are not removed while active profiles reference them.
- Database migrations are never dropped without an explicit minimum-upgrade path.
- Removed features preserve exported data where possible and state omissions.
- APK direct-download releases remain available unless revoked for security.

# Release cadence and branching

Use trunk-based development with short-lived branches and tagged milestones. Release candidates are immutable tags; fixes produce a new candidate. Stable releases use semantic versions and signed tags where available. Changelog separates Added, Changed, Fixed, Security and Known limitations.

# Stop conditions

Pause feature growth when:

- native alarm actions depend on JS;
- an unresolved data-loss path exists;
- idle battery invariants fail;
- backup reader/writer compatibility is untested;
- Android current policy materially changes full-screen/exact alarm eligibility;
- documentation promises more than test evidence.

# Portfolio milestone

The portfolio case study is published only after a real installable release exists. It includes the originating Islamic reminder problem respectfully, explains generalization to a media reminder engine, shows adaptive presentation and backup architecture, and links source/APK/checksum/docs. It does not use downloaded Instagram reels without permission.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

