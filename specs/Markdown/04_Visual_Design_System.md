---
title: "Visual Design System"
subtitle: "Nudgio - Offline-First Adaptive Media Alarm"
author: "Prepared for Mohamed Aslam Abdul"
date: "2026-08-05"
subject: "Define brand attributes, color, type, spacing, shape, components, responsive behavior, iconography, motion and visual accessibility."
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
| Document ID | MR-04 |
| Version | 1.1 |
| Status | Approved baseline |
| Last updated | 2026-09-27 |
| Product owner | Mohamed Aslam Abdul |
| Package identifier | `com.aslam.mediareminder` |
| Purpose | Define brand attributes, color, type, spacing, shape, components, responsive behavior, iconography, motion and visual accessibility. |

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

# Design intent

Nudgio should look like a quiet, modern utility rather than a loud alarm clock or generic social-media clone. The three brand attributes are **calm**, **intentional** and **dependable**. Material 3 provides the Android interaction foundation. The approved **Ink & Apricot** brand uses ink-blue actions, warm ivory surfaces, small apricot accents and midnight dark-mode surfaces. See `docs/brand-guidelines.md` for usage and the logo brief.

![Design token overview](../Diagrams/13_design_tokens.png)

# Color system

All color pairings MUST meet the contrast requirements in MR-13. The existing opt-in Material You setting remains available, while the fixed brand palette remains the default for consistent screenshots and alarm recognition.

| Token | Light | Dark | Use |
|---|---:|---:|---|
| Primary | `#2D4DB5` | `#BAC8FF` | Primary actions, selected state, key status |
| On primary | `#FFFFFF` | `#172654` | Content on primary |
| Primary container | `#E7ECFB` | `#26314E` | Low-emphasis selected cards and navigation |
| On primary container | `#2D4DB5` | `#BAC8FF` | Text/icons on container |
| Secondary | `#E9B58E` | `#F1BE98` | Decorative apricot accent; not a light-theme outline or text colour |
| On secondary | `#56321C` | `#56321C` | Content on apricot fill |
| Secondary container | `#F8E9DC` | `#392A21` | Snooze and warm supporting cards |
| On secondary container | `#70401F` | `#FFD2AF` | Text/icons on warm containers |
| Surface | `#F7F4EE` | `#11141D` | App background |
| Surface container | `#FFFEFA` | `#1D2230` | Cards, sheets, navigation |
| On surface | `#202638` | `#F3F1EC` | Primary content |
| On surface variant | `#5F6675` | `#BCC2D0` | Secondary content |
| Outline | `#767E90` | `#858FA5` | Meaningful control boundaries |
| Error | `#B42332` | `#FFB5BE` | Destructive actions, blocking errors |
| Error container | `#FCE8E9` | `#421F29` | Blocking-error callouts |
| On error container | `#B42332` | `#FFB5BE` | Text/icons on error containers |
| Warning | `#805600` | `#FFE0A0` | Capability limitations; independent of decorative apricot |
| Warning container | `#FFF0CA` | `#382B12` | Warning callouts |
| On warning container | `#805600` | `#FFE0A0` | Text/icons on warning containers |
| Success | `#2D4DB5` | `#BAC8FF` | Observed completed/healthy state, always with icon/text |
| Scrim | `#000000` at 48% | `#000000` at 64% | Modal and alarm backdrop |

The alarm surface uses dark tonal surfaces even when the app theme is light, reducing glare on a woken screen. Controls retain full contrast. Red is reserved for destructive action or blocking fault, not normal urgency.

Apricot is deliberately too light for a meaningful boundary against ivory. It MUST be used with its brown on-colour and MUST NOT replace the warning role. Native Android resources mirror the fixed palette; wallpaper-based Material You remains an explicit user opt-in. The native alarm retains fixed brand colours. The launcher now uses the user-approved 2026-09-29 blue n/apricot sphere artwork unchanged.

# Typography

Use the Android system sans family or Noto Sans where bundled size and license are acceptable. Arabic localization uses Noto Sans Arabic or platform equivalent after glyph QA. Avoid custom display fonts that increase APK size or impair script support.

| Role | Size/line height | Weight | Typical use |
|---|---|---|---|
| Display small | 36/44 sp | 500 | Locked-screen due time on large devices |
| Headline large | 32/40 sp | 500 | Alarm title |
| Headline medium | 28/36 sp | 500 | Screen title on expanded layouts |
| Title large | 22/28 sp | 600 | Top app bar, major card |
| Title medium | 16/24 sp | 600 | List/card title |
| Body large | 16/24 sp | 400 | Primary body copy |
| Body medium | 14/20 sp | 400 | Supporting copy |
| Label large | 14/20 sp | 600 | Buttons and tabs |
| Label medium | 12/16 sp | 600 | Chips and metadata |

Use tabular figures for times where available. Do not disable system font scaling. At 200%, action labels may wrap to two lines; critical controls MUST not truncate to ambiguous text.

# Spacing and grid

The base unit is 4 dp. Common increments: 4, 8, 12, 16, 20, 24, 32 and 40 dp. Phone screen side padding is 16 dp; compact dialog padding is 24 dp; expanded layouts use a centered content max-width of 840 dp.

- Minimum touch target: 48 x 48 dp.
- Alarm primary actions: minimum 56 dp height and 64 dp preferred.
- List row: minimum 64 dp, expanding with font scale.
- Card internal padding: 16 dp.
- Section gap: 24 dp.
- Bottom navigation height: platform Material baseline plus system insets.

# Shape and elevation

| Component | Corner radius | Elevation |
|---|---:|---:|
| Small chip | 8 dp | 0 |
| Text field / compact control | 12 dp | 0 |
| Standard card | 16 dp | 0-1 |
| Dialog | 24 dp | 3 |
| Bottom sheet | 28 dp top corners | 3 |
| In-app due strip | 20 dp bottom corners | 4 |
| Alarm action button | 20 dp | 1 |

Do not use shadows as the only boundary in dark mode. Combine tonal surface, outline and elevation as needed.

# Iconography

Use Material Symbols Rounded with a consistent optical size. Every icon-only button requires an accessibility label and tooltip where supported. Core concepts:

- Play: filled play arrow;
- Snooze: alarm with plus or schedule icon plus text;
- Dismiss: close icon only when paired with visible `Dismiss` on alarm surfaces;
- Health: shield/check;
- Backup: archive/download-upload directional icon;
- Profile: tune or notifications active;
- Missing media: broken image/file warning.

Religious iconography is optional and attached to user categories; the global brand does not assume a religion. Avoid decorative crescents as generic button symbols because they can be mistaken for dark mode or sleep.

# Component catalog

## Primary button

Filled primary color, verb-first label, optional leading icon. One primary action per surface. Loading replaces icon with progress but preserves width. Disabled state retains readable label and explains validation near the relevant field.

## Secondary and tonal buttons

Outlined or tonal. Snooze on alarm surfaces uses warm secondary tonal treatment, while Play is primary and Dismiss is neutral/destructive depending on context.

## Reminder card

Thumbnail 64 x 64 dp; title; next time; repeat summary; profile glyph; enabled switch with accessible state. Tapping body opens details; switch changes enable state but never propagates tap to the card.

## Capability card

Status icon + `Ready`, `Limited`, or `Action needed`; title; one-sentence consequence; trailing action. Avoid a dashboard filled with green checks; healthy items can collapse.

## Media card

Aspect ratio 16:9 for video, square treatment for image/audio fallback. Duration/type label sits on a high-contrast scrim. Broken preview uses icon and text, never an empty gray rectangle.

## In-app reminder strip

Maximum height is `min(144dp, 20% of usable viewport)`. Content scroll is not allowed within the strip. At high font scale it transitions to a compact card with Play and Snooze, while Dismiss moves to overflow but remains reachable in sequential focus.

## Full-screen alarm

High-contrast static background, safe inset handling, time, label, optional thumbnail, profile status and three actions. No tiny swipe-only affordance. Time and title are announced once; continuous TalkBack focus stealing is forbidden.

# Responsive behavior

| Width class | Layout |
|---|---|
| Compact | Bottom navigation, single-column editors, two-column media grid when space permits |
| Medium | Navigation rail, two-pane Library detail, widened alarm controls |
| Expanded | Navigation rail/drawer, centered max-width content, three-pane optional management layout |

Foldables MUST respond to hinge and posture without placing primary alarm controls across an occluding hinge. Rotation during an active alarm rebuilds the native activity from session state without restarting sound.

# Insets and system UI

All screens honor status, navigation, cutout and gesture insets. Full-screen alarm MAY draw behind system bars but action controls remain inside safe areas. The app does not hide navigation gestures in a way that traps the user. System bar icon contrast follows the actual surface luminance.

# Motion

| Motion | Duration | Easing | Reduced motion |
|---|---:|---|---|
| Navigation transition | 250 ms | standard | Crossfade 100 ms or instant |
| Card expand | 200 ms | emphasized decelerate | Instant size change |
| In-app strip enter | 220 ms | emphasized decelerate | Fade only |
| Snackbar | Material default | standard | Fade only |
| Alarm button confirmation | 120 ms | standard | Haptic/color only |

No looping decorative animations. Vibration is functional feedback and follows profile and accessibility settings. Visual urgency MUST not rely on flashing.

# States

Every interactive component specifies default, pressed, focused, hovered where applicable, disabled, loading and error states. Keyboard/switch focus uses a visible 2 dp primary outline with adequate contrast. Pressed-state overlays MUST not reduce text contrast below threshold.

# Charts and history

Local history uses simple counts and accessible summaries rather than competitive streak visuals. A chart must have a textual equivalent. Completed, dismissed and missed use icon + label + color; no pie chart without values.

# Brand assets

The user-approved 2026-09-29 logo supersedes the initial play/ring direction: a sculptural blue n, apricot sphere and blue arcs on ivory. The exact JPEG source is retained in `assets/brand/`. Do not invent a vector master or monochrome asset from this raster. Adaptive mask and 24 px legibility checks, store exports and an approved monochrome variant remain release design evidence. The logo MUST not contain Arabic scripture or other sacred text that could appear in inappropriate system contexts.

# Content density and writing

Screen titles use sentence case. Buttons use short verbs. Technical identifiers live behind Details. Times use the user's 12/24-hour preference. Dates use locale formatting. Avoid all-caps except generated archive codes. Keep snackbar text to one action and approximately two lines at normal scale.

# Visual QA checklist

Before release, verify light/dark/system themes, contrast, 200% font scale, smallest supported width, landscape, cutouts, gesture navigation, RTL mirrored layouts, selected/unselected states, long labels and missing thumbnails. The locked-screen alarm must be reviewed in a dark room for glare and on OLED/LCD devices for readability.

---

## Governance

This document is part of the **Nudgio Source-of-Truth Pack v1.0**. In case of conflict, apply this precedence order: (1) explicit platform safety and permission rules, (2) Architecture Decision Records, (3) Android specification, (4) data and backup specifications, (5) PRD and feature specification, (6) UX and visual guidance, (7) implementation notes. Record any intentional deviation in the decision log before release.

