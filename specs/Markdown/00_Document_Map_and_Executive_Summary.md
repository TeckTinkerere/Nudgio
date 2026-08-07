---
title: "Document Map and Executive Summary"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Orient readers, declare the binding product baseline, and map every source-of-truth document."
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
| Document ID | MR-00 |
| Version | 1.0 |
| Status | Approved baseline |
| Last updated | 2026-08-05 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Orient readers, declare the binding product baseline, and map every source-of-truth document. |

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

# Executive summary

Nudgio is an Android-first, offline-only application that lets a person import local media and schedule it as a reminder. The app adapts the interruption to device state:

- a locked or non-interactive device may wake into a full-screen alarm activity;
- an unlocked device uses Android's system heads-up notification and never forces a full-screen takeover;
- while Nudgio itself is foregrounded, an in-app strip provides the least disruptive interaction.

The reminder does not autoplay its attached video merely because it is due. Alert sound and vibration may begin according to the selected profile, but the reminder media begins only after the user selects **Play**. The application is local-only: no account, server, advertising, telemetry, or Internet permission is required. It is scheduled by Android rather than by an always-running loop.

![Product context](../Diagrams/01_product_context.png)

# Binding baseline

| Area | Approved baseline |
|---|---|
| Product name | Nudgio |
| Initial platform | Android phones and foldables; tablets are supported with responsive layouts but are not the primary alarm surface |
| App framework | React Native 0.86.x, TypeScript, New Architecture |
| Reliability core | Kotlin native module, Android components, Room, DataStore, AlarmManager, Media3 |
| SDK baseline | `minSdk 26`, `compileSdk 37`, `targetSdk 36` for the first public release; retest and move target to 37 when required by distribution policy |
| Connectivity | No backend and no `INTERNET` permission in the production manifest |
| Persistence | App-owned files plus Room; system settings are discovered, not treated as app-owned data |
| Scheduler | One next due system alarm, recalculated after every relevant state change; no second-by-second polling and no resident idle service |
| Locked-device presentation | Full-screen intent/activity only when the device is locked or non-interactive and Android permits it |
| Unlocked-device presentation | High-importance heads-up notification; exact visual height is controlled by Android and the OEM |
| Backup | Versioned logical ZIP containing JSON records and media with SHA-256 checksums; never a raw database copy |
| Distribution | Signed APK and checksums through GitHub Releases; Play distribution remains optional |
| License | Apache License 2.0 for application source, excluding user-provided media and brand assets identified separately |

# Product boundaries

Nudgio is suitable for personal duas and adhkar, study clips, exercise demonstrations, routines, language practice, and other rich-media reminders. It is **not** certified as a medical device, emergency warning system, safety-of-life alarm, or guaranteed exact-timing service. Android permissions, Doze policy, OEM modifications, device shutdown, force-stop, and user-disabled notification channels can prevent or alter an alert. The product MUST explain those states rather than claiming impossible certainty.

The application MUST NOT:

1. upload or analyze a person's media;
2. request overlay permission to draw over other apps;
3. ask for unrestricted battery optimization exemption as a default setup step;
4. keep a foreground service running while idle;
5. silently enable a reminder whose exact scheduling prerequisites are unavailable;
6. restore operating-system permissions, notification channel choices, or ringtone URIs from a backup as though they were portable app data.

# Source-of-truth map

| ID | Document | Authoritative for |
|---|---|---|
| MR-00 | Document Map and Executive Summary | Scope map, precedence, fixed baseline |
| MR-01 | Vision and Product Charter | Purpose, principles, goals, non-goals |
| MR-02 | Product Requirements Document | Users, outcomes, scope, requirements, success criteria |
| MR-03 | User Experience and Interaction Specification | Screen flows, adaptive alarm interaction, copy, states |
| MR-04 | Visual Design System | Tokens, components, responsive behavior, motion |
| MR-05 | Functional Feature Specification | Feature-level behavior and acceptance rules |
| MR-06 | Android Alarm, Notification and Battery Specification | Native scheduling, alerts, permissions, lifecycle |
| MR-07 | Technical Architecture | Components, dependency direction, deployment architecture |
| MR-08 | Internal Module and Data Contracts | Typed boundaries, commands, events, error contracts |
| MR-09 | Database and Local Storage Specification | Tables, relationships, migrations, files and transactions |
| MR-10 | Backup, Export and Import Specification | Portable archive format and restore algorithm |
| MR-11 | Edge Cases, Failure Recovery and Conflict Handling | Failure taxonomy, degradation and recovery rules |
| MR-12 | Security, Privacy and Threat Model | Assets, trust boundaries, misuse controls, secure defaults |
| MR-13 | Accessibility, Localization and Inclusive Design | WCAG-informed behavior, TalkBack, scaling, RTL and copy |
| MR-14 | Testing, Quality and Device Matrix | Test strategy, devices, release evidence and defect gates |
| MR-15 | Performance, Battery and Operational Budgets | Quantitative budgets and measurement procedure |
| MR-16 | Roadmap, Release and Success Metrics | Release increments, metrics and change control |
| MR-17 | Architecture Decision Records | Binding architectural choices and their rationale |
| MR-18 | Contribution Guide and Engineering Standards | Repository rules, code review and implementation quality |
| MR-19 | AI Agent Guide and Master Loop Prompt | Safe AI-assisted development loop and stop conditions |
| MR-20 | Release, Distribution, Portfolio and Maintenance Guide | Signing, APK publication, support and portfolio evidence |
| MR-21 | Requirements Traceability and Acceptance Catalog | Requirement-to-test mapping and release acceptance |
| MR-22 | Research Baseline and Official Sources | Current official platform facts and refresh policy |

# Requirement taxonomy

Requirement identifiers use a prefix and a sequence. The catalog in MR-21 is authoritative.

| Prefix | Domain | Example |
|---|---|---|
| `PRD` | Product outcome or scope | `PRD-012` |
| `UX` | Interaction or presentation | `UX-041` |
| `FUN` | Feature behavior | `FUN-103` |
| `AND` | Android/native behavior | `AND-057` |
| `DAT` | Persistence and integrity | `DAT-026` |
| `BKP` | Backup/restore | `BKP-044` |
| `SEC` | Security/privacy | `SEC-018` |
| `ACC` | Accessibility/localization | `ACC-021` |
| `NFR` | Performance/battery/reliability | `NFR-034` |
| `REL` | Release/distribution | `REL-015` |

Every implemented requirement MUST have at least one verification method: automated test, instrumented test, manual test, static inspection, or measured evidence. A requirement is not complete because a screen exists; the mapped acceptance evidence must pass.

# Product state model

The app separates four kinds of state:

1. **Intent state** - reminders, schedules, profiles, categories and user settings.
2. **Derived state** - next occurrence, notification content and calculated recurrence.
3. **Runtime state** - active alarm session, bounded ringing service, wake state and action idempotency.
4. **Platform state** - notification permission, exact-alarm access, channel importance, full-screen eligibility, battery policy and device lock state.

Only the first three are persisted as app state. Platform state is probed and displayed. This distinction prevents backup restore, migrations, and UI assumptions from overwriting choices owned by Android.

# Release definition

A public v1 release is acceptable only when:

- all P0 requirements in MR-21 pass;
- there are no open critical or high-severity security, data-loss, alarm-action, or accessibility defects;
- locked, unlocked, Doze, reboot, timezone-change, force-stop explanation, denied-permission and backup recovery flows have been tested on the required device matrix;
- idle operation shows no resident foreground service and no periodic wake loop;
- import/export round trips preserve every supported logical record and media checksum;
- the APK is reproducibly built from a tagged commit, signed, checksum-published and accompanied by a privacy statement and known-limitations page;
- included screenshots and demo media are original, licensed, or intentionally synthetic.

# Change control

A proposed change that affects alarm timing, permission scope, backup compatibility, native module contracts, file ownership, or public security posture MUST update the ADR log before implementation. Schema and backup changes MUST include migration and compatibility tests in the same pull request. Product copy changes that alter a promise about reliability MUST be reviewed against MR-06 and MR-11.

# Implementation reading order

A developer or coding agent starts with MR-00, MR-17, MR-06, MR-07 and MR-09, then reads the relevant feature and UX documents. A designer starts with MR-01 through MR-05 and MR-13. A tester starts with MR-21, MR-14, MR-11 and MR-06. A release manager starts with MR-20, MR-14, MR-15 and MR-22.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

