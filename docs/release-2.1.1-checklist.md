# Nudgio 2.1.1 — release record

Artifact: `releases/v2.1.1/Nudgio-2.1.1.apk`
SHA-256: `c00e480c3c6aaaddc3b69b3b2f674449627d26b5fbd6a01e9036fb45418c5de1`
Size: 33,909,601 bytes (32.3 MiB), from 2.1.0's 35,428,229 — **−1,518,628 bytes**

A patch release. The only app change is the launcher icon (DL-104); the
website's theme control (DL-105) ships alongside but is not in the APK.

## Verified against the artifact, not the source

| Check | Result |
|---|---|
| Version identity | `versionCode=16`, `versionName=2.1.1`, `com.aslam.mediareminder` |
| Signing certificate | `4acfa5e6…501c` — **byte-identical to 2.1.0**, so upgrades install |
| Upgrade path | Installed over the running 2.1.0 on the emulator; `Success`, version read back as 16 / 2.1.1 |
| `INTERNET` permission | **count 0.** Permission set unchanged from 2.1.0 — the only extra entry is the AndroidX signature-level `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` |
| Adaptive icon layers | `aapt2 dump xmltree` on the shipped `res/BW.xml` shows **all three**: `background`, `foreground`, `monochrome` |
| Duplicate artwork removed | Exactly **one** JPEG left in the APK, 1,518,429 bytes — the React Native `BrandLogo` asset. The size delta (−1,518,628) is that file plus 199 bytes |
| Icon renders on device | Screenshotted from the app drawer. Ink is centred on the plate to **±0.0 px** in both axes (gaps left 23 = right 23, top 18 = bottom 18); furthest ink reaches **93.1%** of the plate radius with 5.0 px clear, matching the 67dp-inside-72dp the geometry predicted |
| Automated verification | `npm run verify`: typecheck ✓, lint ✓, **134/134** tests |

## Decisions

**Cobalt on cream, not inverted.** Measured contrast argued for a cobalt
plate — the apricot sphere reaches 1.67:1 on cream against 4.04:1 on cobalt.
Rendering both schemes at 192/96/48px through circle and squircle masks showed
the figure was misleading: the sphere sits in the notch framed by the shoulder
and the upper chime, so it reads against cobalt ink rather than open ground.
The on-device screenshot confirms it. Cream keeps the icon identical to the
logo and the website header, and 2.1.0's icon was already effectively
cobalt-on-white, so this is continuity. Inverting is two lines in
`values/colors.xml`.

**Generated, not hand-maintained.** `scripts/build-brand-assets.py` emits the
foreground and monochrome drawables and refuses to run unless the SVG master
contains the exact path data it is about to write. Nudging `SPHERE` from r73 to
r74 makes it exit 1 naming the mismatch, so the guard is not vacuous.

## Not covered by this pass

- ~~**The themed (monochrome) icon was not seen rendered.**~~ **Closed after
  release.** The wallpaper picker's black screen was transient; reopening it
  from the home-screen long-press menu worked. The themed icon was then
  exercised on Android 16 and renders correctly — see the 2.1.2 record for the
  procedure and what it showed. The layer shipped in 2.1.1 is the same one.
- Device-size matrix and TalkBack, both already listed as uncovered for 2.1.0,
  were not re-run. No UI changed in this release.
- `src/features/moment/__tests__/ReminderMoment.test.tsx` failed once during
  verification on a 5 s timeout while a native build saturated the CPU. It
  passes isolated at 3,614 ms — only 28% headroom — so it is flaky under load
  rather than broken. Tracked separately; not caused by this release, which
  changed no application source.
