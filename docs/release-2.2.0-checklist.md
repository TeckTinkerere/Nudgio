# Nudgio 2.2.0 — release record

Artifact: `releases/v2.2.0/Nudgio-2.2.0.apk`
SHA-256: `89b161d315451c2849560d2f727e0cf7a55533c5a109f52814f05339e649da2f`
Size: 32,393,917 bytes (30.9 MiB), +2,244 over 2.1.2

A minor release, not a patch: the exact-alarm permission model changed
(DL-107) and the onboarding permission flow was restructured (DL-108).

## Verified against the artifact, not the source

| Check | Result |
|---|---|
| Version identity | `versionCode=18`, `versionName=2.2.0`, `com.aslam.mediareminder` |
| Signing certificate | `4acfa5e6…501c` — unchanged since 2.1.0 |
| `INTERNET` permission | **count 0** |
| Exact-alarm pair | `SCHEDULE_EXACT_ALARM maxSdkVersion='32'` + `USE_EXACT_ALARM`, both present in the built manifest |
| **`USE_EXACT_ALARM` granted at install** | `dumpsys package` → `granted=true`, with no user interaction. `SCHEDULE_EXACT_ALARM` does not appear at all on API 36, confirming the cap works |
| Exact alarm in-app | Capability row reads **Ready**, action `none` — no redirect affordance anywhere |
| Artifact matches HEAD | No source file newer than the APK; working tree clean at `5a2c896` |
| Automated verification | typecheck ✓, lint ✓, prettier ✓, **134/134** tests |

## First-run flow, driven end to end on Android 16 (API 36)

Splash → intro → adaptive → primer → native dialog → review → Home, with
`pm clear` between runs for a genuine first launch.

- The primer's button fires `GrantPermissionsActivity` directly (confirmed as
  top resumed activity).
- **Denial does not block.** The review step renders with Notifications
  "Action needed" and an in-place `Allow` retry; `Create my first reminder`
  stays enabled.
- The Home banner reads "Notifications are off", appears **with no reminders
  present**, and its action lands on `Settings$AppNotificationSettingsActivity`.

## Two defects found on device that review did not catch

**1. A double-ask that permanently denied the permission.**
`useRequestNotificationPermissionOnLaunch` fired as soon as
`hasCompletedOnboarding` flipped true, re-prompting seconds after the primer
was declined.

| | after denial | 10 s on Home |
|---|---|---|
| before the fix | `USER_SET` | `USER_SET` + **`USER_FIXED`** |
| after the fix | `USER_SET` | `USER_SET` |

`USER_FIXED` means both of the two dialogs Android ever shows were spent, and
the permission was left Settings-only — worse than the problem this release
set out to solve. The hook is deleted; see DL-108.

**2. The Home banner never rendered.** It was wired only into the list's
`ListHeaderComponent`, and with no reminders the list never mounts — which is
exactly the state a user is in right after declining. Now rendered in both
branches.

## API 31–32, verified after release

Listed below as uncovered when 2.2.0 shipped, and since closed. A fresh
`system-images;android-32;google_apis;x86_64` AVD (Android 12, API 32) was
created for it — API 32 specifically, because it is the exact boundary of the
`maxSdkVersion="32"` cap and an off-by-one there would silently drop the
permission.

| Check | API 32 | API 36 (for contrast) |
|---|---|---|
| `SCHEDULE_EXACT_ALARM` | requested, **`granted=true`** | absent — capped away |
| `USE_EXACT_ALARM` | requested but ignored (does not exist) | **`granted=true`** |

Each range ends up with exactly one working exact-alarm permission, which is
what the pair was written to achieve.

Behaviour on API 32, driven end to end:

- Default state: exact alarm reports **Ready**.
- With the appop denied (`cmd appops set … SCHEDULE_EXACT_ALARM deny`): the row
  reports **Limited timing** with an **Open settings** action, and that action
  lands on `Settings$AlarmsAndRemindersAppActivity` — the contextual
  `open_special_access` path, intact on the one range that still needs it.
- The onboarding primer degrades correctly: `POST_NOTIFICATIONS` does not exist
  below API 33, so no dialog appears and the review reads "All set".

**One defect found and fixed.** The primer was shown on Android 12 even though
there was nothing to ask for — a dead tap whose copy ("Nudgio needs your
permission to show reminders") is false where Nudgio already has it. The
permissions step now starts at the review stage when notifications already
report ready, which also covers a reinstall on any API level that retains the
grant. Not in 2.2.0; see the follow-up release.

Caveat on the AVD: the default profile was 320×640 at 160 dpi, on which the
permissions review is badly clipped — only the first row is visible without
scrolling. That is an unusually small/low-density profile rather than real
Android 12 hardware, and the run above used an override of 640×1280 at 160 dpi
(400×800 dp). **Whether 320×640 clipping predates this release was not
established**, so it is recorded here as an open question rather than a
regression or a non-issue.

## Not covered by this pass
- `BrandLogo`, `SplashScreen`, `CapabilityBanner` and the onboarding primer
  have no unit tests; nothing in the suite renders onboarding or Home's empty
  state. The device run is the verification.
- Device-size matrix and TalkBack, uncovered since 2.1.0, were not re-run.

## Play Store note

`USE_EXACT_ALARM` is review-gated: restricted to apps whose "core, user facing
functionality requires precisely-timed actions", and apps that do not qualify
are "disallowed from publishing on Google Play." Nudgio qualifies on the
alarm-clock case. Moot while sideloaded; recorded in
`docs/APK_RELEASE_CHECKLIST.md` as the first thing to re-check before any
listing.
