# Nudgio for iPhone — Ink & Apricot

**Status:** Approved colour direction, 27 September 2026. The user accepted Ink & Apricot and requested its application to Android before iPhone implementation. Android source now uses this direction; this document continues to specify the iPhone design assets. See [shared brand guidelines](../brand-guidelines.md).

## Direction

Ink blue creates a recognisable action colour. Warm ivory keeps the interface comfortable for daily use. Apricot adds warmth to snooze and occasional highlights. Dark mode uses midnight surfaces and lighter blue controls so the same hierarchy remains legible.

The character is thoughtful, clear and welcoming. Keep the Nudgio name and system typography. This is a colour refresh, not a new name or a completed logo redesign.

### Core palette

| Colour | Hex | Role |
|---|---|---|
| Ink blue | `#2D4DB5` | Primary actions, active tab, links and focus |
| Warm ivory | `#F7F4EE` | Main light-theme background |
| Paper | `#FFFEFA` | App-owned cards and grouped forms |
| Apricot | `#E9B58E` | Small brand highlights; dark brown text only |
| Deep ink | `#202638` | Light-theme headings and body text |
| Midnight | `#11141D` | Dark-theme background |
| Moon blue | `#BAC8FF` | Dark-theme primary controls and links |

Use approximately 80% neutral surfaces, 15% blue interaction colour and 5% apricot emphasis across a typical app screen. This is a composition guide, not a pixel-count requirement. Media thumbnails retain their original colours.

## Usage rules

- Save, Play and the selected navigation item use blue. Use white on the light blue button; use dark navy on the pale-blue dark-theme button.
- Snooze can use an apricot container with dark brown text in light mode and a warm dark container with pale peach text at night.
- “Scheduled” uses a check icon plus blue text. It is a status, not a promise of delivery; no green dashboard of checks.
- Warning uses a separate amber treatment. Error/destructive actions use a separate red treatment. Apricot is not an error colour.
- Do not put white text on apricot, use pale blue as light-theme body text, or use a subtle divider as the only boundary of an interactive control.
- Generic media tiles may use blue or apricot containers; avoid introducing unrelated saturated colours for each media type.
- Native iOS sheets, keyboards, pickers and AlarmKit surfaces retain system-owned presentation. Apply supported tint only; do not repaint system materials to imitate the app board.
- Keep cards opaque for content legibility. No decorative blue/purple gradients, colour-changing controls or glowing alarm backgrounds.
- Focus and selection must remain visible with Increased Contrast. All states use icon/text or geometry as well as colour.
- The app follows System/Light/Dark. The design board deliberately shows light and dark examples at the same time for comparison.

## Semantic tokens

The machine-readable source is [iphone-brand-tokens.json](iphone-brand-tokens.json). The board consumes the matching [CSS variables](iphone-brand-tokens.css). Implementation should map those semantic roles to iPhone-specific theme tokens rather than scattering literal hex values through components.

| Role | Light | Dark |
|---|---|---|
| Background | `#F7F4EE` | `#11141D` |
| Surface | `#FFFEFA` | `#1D2230` |
| Surface muted | `#ECE9E2` | `#2C3242` |
| Main text | `#202638` | `#F3F1EC` |
| Secondary text | `#5F6675` | `#BCC2D0` |
| Primary | `#2D4DB5` | `#BAC8FF` |
| On primary | `#FFFFFF` | `#172654` |
| Primary pressed | `#233C8D` | `#A7B8F0` |
| Primary container | `#E7ECFB` | `#26314E` |
| On primary container | `#2D4DB5` | `#BAC8FF` |
| Accent | `#E9B58E` | `#F1BE98` |
| On accent | `#56321C` | `#56321C` |
| Accent container | `#F8E9DC` | `#392A21` |
| On accent container | `#70401F` | `#FFD2AF` |
| Control outline | `#767E90` | `#858FA5` |
| Decorative divider | `#DEDDE5` | `#394052` |
| Warning background / text | `#FFF0CA` / `#805600` | `#382B12` / `#FFE0A0` |
| Error background / text | `#FCE8E9` / `#B42332` | `#421F29` / `#FFB5BE` |

## Contrast verification

Calculated with the WCAG sRGB relative-luminance formula for opaque colours. These values validate the declared pairings, not every possible device rendering, overlay or future implementation.

| Pair | Ratio |
|---|---:|
| White label on light primary button | 7.39:1 |
| Blue link on ivory | 6.73:1 |
| Deep-ink body on paper | 14.91:1 |
| Secondary text on ivory | 5.25:1 |
| Secondary text on paper | 5.71:1 |
| Blue text on blue-tinted container | 6.26:1 |
| Brown label on apricot | 6.14:1 |
| Navy label on dark-theme primary button | 8.87:1 |
| Main dark-theme text on surface | 14.05:1 |
| Secondary dark-theme text on surface | 8.89:1 |
| Moon-blue link on midnight | 11.21:1 |
| Dark-theme tinted blue pairing | 7.84:1 |
| Dark-theme apricot container pairing | 9.88:1 |
| Light warning pairing | 5.72:1 |
| Dark warning pairing | 10.79:1 |
| Light error pairing | 5.53:1 |
| Dark error pairing | 8.64:1 |
| Light control outline against paper | 4.03:1 |
| Dark control outline against dark surface | 4.89:1 |

All listed text pairings exceed 4.5:1. The listed meaningful control boundaries exceed 3:1. An expanded check passed all 34 text/control pairings across both themes (including pressed buttons and muted surfaces), with a minimum text ratio of 4.75:1. All 40 theme token values match between JSON and CSS. See the [saved validation results](iphone-brand-validation.json). Decorative dividers are intentionally subtler and cannot be the sole state indicator or control outline.

Before release, repeat visual and accessibility checks on real iPhones with Dynamic Type, Increase Contrast, Reduce Transparency, colour filters and VoiceOver. Mathematical colour contrast does not establish overall accessibility compliance.

The browser's local-file policy prevented a rendered HTML review in this session. The saved design board was checked structurally; it has six phone mockups and local stylesheet/document links. No real-device UI validation is claimed.

## Implementation handoff

1. Use these tokens for the proposed iPhone design system in P2.
2. Preserve native system surfaces; use named semantic colours in SwiftUI/UIKit and semantic roles in RN.
3. Check every text/background pair, including pressed, selected, error and empty states.
4. Keep platform token implementations separate while maintaining the same approved brand roles; Android now uses this palette through its own theme and resource mirror.
5. Treat this palette as the approved brand direction. Cross-device sync and payment remain deferred.
