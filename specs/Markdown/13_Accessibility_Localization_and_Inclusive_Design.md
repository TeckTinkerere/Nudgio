---
title: "Accessibility, Localization and Inclusive Design"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Define accessible interaction, assistive technology behavior, dynamic layout, language readiness, RTL support and inclusive content."
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
| Document ID | MR-13 |
| Version | 1.0 |
| Status | Approved baseline |
| Last updated | 2026-08-05 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Define accessible interaction, assistive technology behavior, dynamic layout, language readiness, RTL support and inclusive content. |

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

# Accessibility target

Nudgio targets WCAG 2.2 AA principles adapted to native Android and follows Android accessibility guidance. The success condition is task completion, not merely automated scanner scores. Import, reminder creation, permission recovery, alarm action and backup restore must work with TalkBack and non-touch input.

# Core requirements

- **ACC-001:** Every actionable element has a meaningful accessible name, role, state and enabled status.
- **ACC-002:** Minimum target size is 48 x 48 dp; full-screen alarm actions are at least 56 dp high.
- **ACC-003:** Text supports at least 200% system font scaling without loss of critical content or action.
- **ACC-004:** Color is never the sole indicator of enabled, due, completed, error or capability state.
- **ACC-005:** Normal text contrast is at least 4.5:1 and large text/UI boundaries meet applicable contrast requirements.
- **ACC-006:** Reduced-motion preference removes nonessential movement and looping animation.
- **ACC-007:** The application remains operable in portrait, landscape, split screen where permitted and responsive width classes.
- **ACC-008:** Notifications and native alarm controls use localized explicit action labels.
- **ACC-009:** Timeout behavior provides sufficient time and can be extended through profile configuration, while still retaining a hard safety cap.
- **ACC-010:** No content flashes in a seizure-risk pattern.

# TalkBack semantics

## Reminder row

Announce as one logical group: “Morning remembrance. Daily at 6:15 AM. Standard alert. Enabled. Next tomorrow.” Provide separate actions for Open and Toggle. The switch must not be nested ambiguously in a fully clickable row.

## Media card

“Video. Morning remembrance. 1 minute 33 seconds. Two active reminders.” Thumbnail is decorative when the title conveys content; otherwise provide useful alt text entered by user. Do not announce filenames.

## Capability card

“Exact timing. Action needed. Android may deliver reminders late. Button, Open settings.” Status precedes action consequence.

## Progress

Import/export progress announces phase changes and meaningful percentage thresholds, not every byte. Cancellation state and success are live-region announcements. Long operations remain discoverable after navigating away.

# Alarm accessibility

The native alarm activity is the highest-priority accessibility surface.

- Initial focus lands on title/time summary, not Play automatically.
- Time and title are announced once; no repeated focus reset while sound vibrates.
- Focus order: summary, Play, Snooze, Dismiss, more options.
- Buttons have text labels, not icons alone.
- Snooze sheet announces absolute resulting time before confirmation.
- Hardware Back behavior is explained and does not trap the user.
- TalkBack gestures can reach a **Silence sound** action even when the user does not wish to resolve the reminder immediately.
- The screen survives 200% font and display size; if necessary, content scrolls while the three actions remain sticky and reachable.
- Vibration is not the only alert channel; visual and accessible notification content remain.

# Notification accessibility

Notification title is concise and action labels are distinct. Avoid three actions beginning with the same word. When lock-screen privacy hides content, generic copy remains meaningful: “Media reminder due. Play after unlocking, Snooze, or Dismiss.”

Android controls announcement timing and heads-up layout. The app tests with TalkBack but cannot force another app or OEM to announce in a specific order.

# Dynamic type and layout

Text uses `sp`, layout grows vertically, and fixed-height containers are avoided for text. Truncation is allowed only for noncritical metadata and includes a detail view. Times may remain one line where the font role scales down within an accessible minimum; action labels never reduce below body-readable size to fit.

At large font scale:

- bottom navigation labels remain visible or switch to navigation rail/drawer on wider layouts;
- chip rows wrap/scroll with clear focus;
- editor labels remain above fields;
- in-app strip transforms into a compact card rather than clipping;
- dialogs may become full-screen sheets.

# Motor and switch access

All functions have tap/button alternatives; no swipe-only delete, drag-only reorder or long-press-only command. Swipe gestures are enhancements. Focus indicators are visible. Keyboard Tab/arrow/Enter/Back behavior is tested on emulator and hardware keyboard. Reorder actions use Move up/Move down accessibility actions.

# Color and visual perception

Status always combines icon, word and color. Error copy appears next to the field and in an accessible summary on submit. The design avoids low-opacity text for essential content. Dark mode is designed, not mechanically inverted. Thumbnail scrims maintain label contrast independent of image content.

A high-contrast mode may increase outlines and remove translucent surfaces. Android system contrast preference is followed where accessible through platform APIs; otherwise the app offers a setting.

# Hearing and audio alternatives

An alarm can combine sound, vibration and visual presentation. Users may disable sound without disabling the reminder. Videos may not contain captions; the app allows notes/transcript text but does not claim automatic captioning in v1. Demo content used publicly includes captions/transcript where speech is important.

Custom vibration patterns are bounded and previewable. “Stronger haptics” is conditional on device capability and does not imply guaranteed intensity.

# Cognitive accessibility

- One primary action per standard screen.
- Repeat rules are summarized in plain language.
- Permission screens say consequence and next action.
- No guilt, loss aversion, red failure marks for missed personal practices or competitive streaks.
- Destructive dialogs identify exact counts.
- Backup Replace uses two-step confirmation and rollback explanation.
- Technical codes are behind Details.
- Editor preserves entered values after a permission or validation issue.

# Localization architecture

All user-visible strings, including native receivers/services/activities and notification channel names, live in localization resources. Concatenated sentences are prohibited. Use ICU/plural-aware formatting, locale date/time formatting, and translator comments for placeholders.

Persist stable semantic values, never localized display strings. Examples:

- weekday stored as ISO number, displayed locally;
- profile built-in ID stable, name localized;
- status stored `needs_setup`, displayed translated;
- archive wire values remain English stable tokens and are not localized.

# Language roadmap

V1 ships English. The codebase is localization-ready from the first commit. Tamil and Arabic are the first planned additional languages because they align with the creator and originating use case. Release requires native-speaker review; machine translation alone is not accepted for alarm, permission, destructive or backup copy.

Religious terms may be user content. The generic app avoids asserting translations of duas or scripture. Any optional starter content has separate scholarly/content review and provenance.

# RTL support

Arabic testing includes:

- mirrored navigation and directional layouts;
- nonmirrored media playback controls where platform convention requires;
- correct icon mirroring for arrows, not Play symbols;
- mixed Arabic/Latin filenames and times;
- numeral system behavior follows locale preference;
- thumbnail/text alignment and ellipsis;
- notification and native alarm resources;
- backup JSON remains direction-neutral and UTF-8.

Use start/end, not left/right, in layout code except intrinsically directional media controls.

# Date, time and calendar

The app follows system 12/24-hour preference and locale date formatting. Recurrence calculations use Gregorian civil date/time in v1. Islamic calendar display is a future optional layer and MUST not alter schedule semantics without explicit design. The app avoids assuming Sunday or Monday as first day of week in display.

# Content guidelines

Use simple verbs: Play, Snooze, Dismiss, Save, Export, Import. Avoid “Accept alarm.” Explain “exact timing” as a platform capability. Avoid idioms difficult to translate. Error messages state effect and recovery. Sentence case is standard.

# Accessibility test matrix

Every release verifies:

- TalkBack latest on one reference Pixel and one Samsung;
- Switch Access or keyboard navigation for core flows;
- font scale 100%, 130%, 160%, 200%;
- display size default and largest practical;
- light/dark/high contrast;
- grayscale/color-blind simulation for status comprehension;
- reduced motion;
- portrait/landscape/fold width;
- English pseudo-localization with 40% string expansion;
- RTL pseudo-locale and Arabic sample;
- notification actions and full-screen alarm while TalkBack is running.

# Accessibility acceptance

A release cannot waive a blocked Play/Snooze/Dismiss action, clipped alarm control, unlabeled permission action, color-only health state, focus trap or inaccessible destructive confirmation. Automated findings are triaged, but manual task testing is mandatory.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

