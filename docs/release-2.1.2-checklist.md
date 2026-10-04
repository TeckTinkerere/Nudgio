# Nudgio 2.1.2 — release record

Artifact: `releases/v2.1.2/Nudgio-2.1.2.apk`
SHA-256: `0c58dea85cb527fe7132da0feac00fbf20cc414f73bb74dc7f7ec769a80f1b70`
Size: 32,391,673 bytes (30.9 MiB)

A patch release finishing DL-104. 2.1.1 moved the launcher icon onto the SVG
master; this moves the in-app icon (`BrandLogo`, on About and onboarding) onto
the same master and stops shipping the bitmap (DL-106).

## Verified against the artifact, not the source

| Check | Result |
|---|---|
| Version identity | `versionCode=17`, `versionName=2.1.2`, `com.aslam.mediareminder` |
| Signing certificate | `4acfa5e6…501c` — unchanged since 2.1.0 |
| Upgrade path | Installed over the running 2.1.1; reads back 17 / 2.1.2 with reminders and media intact |
| `INTERNET` permission | **count 0** |
| Adaptive icon layers | `background`, `foreground`, `monochrome` all present |
| Bitmap artwork | **zero JPEGs** remain in the APK |
| In-app icon renders | Screenshotted on the About screen in both light and dark |
| Automated verification | typecheck ✓, lint ✓, prettier ✓, **134/134** tests (50 s on an idle machine) |
| Geometry guard | `scripts/build-brand-assets.py` verifies the master, the generated drawables **and `BrandLogo.tsx`**; breaking `strokeWidth={242}` exits 1 |

## The size claim needed a second build

The first 2.1.2 build came out **728 bytes larger** than 2.1.1 despite removing
the last reference to the JPEG. The cause was not the change: React Native's
asset task copies into `android/app/build/generated/res/react/` but never
prunes it, so `assets_brand_nudgiologo.jpg` from the 2.1.1 build (timestamped
02:08, while the APK was 15:51) was still being packaged. `shrinkResources` is
not enabled — only `minifyEnabled` — so nothing strips an unreferenced
resource, and `raw/keep.xml` is consequently inert today.

Deleting that generated directory and rebuilding produced the real artifact:
**zero JPEGs**, and the size moved as predicted.

| | bytes | MiB |
|---|---|---|
| 2.1.0 | 35,428,229 | 33.8 |
| 2.1.1 | 33,909,601 | 32.3 |
| 2.1.2 | 32,391,673 | 30.9 |

−1,517,928 against 2.1.1 and −3,036,556 against 2.1.0 — both copies of the
1,518,429-byte bitmap, gone.

## The plate is load bearing

`BrandLogo` keeps the launcher's cream plate rather than drawing a bare mark.
Measured against the app's own surfaces:

- plate on the light surface — **1.00:1**, invisible, so the mark reads as
  floating on the page;
- plate on the dark surface — **16.76:1**, reads as the icon tile.

Without it the fixed cobalt mark would sit straight on the dark surface at
**2.49:1**, the same defect DL-105 fixed on the website by making its mark
theme-aware. The plate solves it here instead, which is what lets the app keep
the original "never restyle the artwork" instruction.

## Not covered by this pass

- **The themed (monochrome) icon still has not been seen rendered.** Present in
  the APK and generated from the same geometry as the foreground, but the
  emulator's wallpaper picker renders a black screen, so the Android 13 themed
  toggle remains unexercised — carried over from 2.1.1.
- `BrandLogo` has no test coverage; nothing in the suite renders About or
  onboarding. The device screenshots are the verification.
- Device-size matrix and TalkBack, uncovered since 2.1.0, were not re-run.
