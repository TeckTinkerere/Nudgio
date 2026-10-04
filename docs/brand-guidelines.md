# Nudgio — Ink & Apricot

Approved colour direction, 27 September 2026. Applied to the Android source and the iPhone design plan. iPhone implementation and cross-device sync remain deferred.

| Colour | Hex | Purpose |
|---|---|---|
| Ink blue | `#2D4DB5` | Light-theme primary actions, selected navigation and links |
| Warm ivory | `#F7F4EE` | Light background |
| Paper | `#FFFEFA` | Light cards and grouped content |
| Apricot | `#E9B58E` | Small highlights and warm supporting treatments |
| Deep ink | `#202638` | Light-theme text |
| Midnight | `#11141D` | Dark background |
| Moon blue | `#BAC8FF` | Dark-theme primary actions |

## Application rules

- The default theme uses blue to identify the primary action and selected navigation. Apricot supports Snooze and occasional warm cards.
- Light blue buttons use white text; dark moon-blue buttons use navy `#172654`. Apricot uses brown text, never white.
- Capability warnings use separate amber tokens; destructive/blocking errors use red. Status messages always retain icon and text labels.
- Native alarm screens remain dark, with moon-blue Play, a warm Snooze treatment and neutral Dismiss/Silence controls.
- Android Material You remains opt-in. Users who enabled wallpaper colours keep that choice; switching it off restores the new fixed brand.
- Keep Android's native control shapes, sizes and behaviour. This change does not apply iPhone navigation or typography to Android.
- The approved 2026-09-29 logo is the sculptural blue n with apricot sphere, supplied by the user. `assets/brand/nudgio-logo.jpg` is its provenance record — see `assets/brand/README.md` for the checksum — but nothing renders it any more.
- **`assets/brand/nudgio-mark.svg` is the master every surface draws from.** It was reconstructed by measuring that JPEG, so its coordinate space *is* the JPEG's 2048px space and every number is checkable against it. The Android launcher icon, the in-app `BrandLogo` (About and onboarding) and the website mark are all this geometry; `scripts/build-brand-assets.py` regenerates the launcher drawables, the web SVG and the PNGs from it, and **fails if the master, the generated outputs or `BrandLogo.tsx` disagree**. Change the master, re-run the script, never hand-edit a generated file.
- The mark is flat by intent. The JPEG is a soft-3D render; the master is the canonical form behind it, which is what stays legible at 16px. The launcher icon's colours are fixed (cream plate, cobalt mark, apricot sphere) and do not follow the app's day/night setting — the Android 13+ monochrome layer is what adapts. The website mark is the one surface that recolours, to the brand's own dark-mode cobalt `#BAC8FF`, because fixed cobalt measured 2.49:1 on the dark ground.

## Sources of truth

- [MR-04 visual specification](../specs/Markdown/04_Visual_Design_System.md)
- [Android/React Native palette](../src/design-system/tokens/palette.ts)
- [Native Android resource mirror](../android/app/src/main/res/values/colors.xml)
- [Detailed colour roles and measured pairings](plans/iphone-brand-guidelines.md)
- [Gemini logo prompt](gemini-logo-prompt.md)

The iPhone token JSON/CSS in `docs/plans/` remain design artifacts. Android consumes its existing TypeScript theme and native XML resources. The native-palette regression test checks their independent copies.

No scheduling, media, database, archive, permission, privacy or background-execution contract changes with this recolour. Device appearance remains subject to native rendering and any user-selected dynamic theme.
