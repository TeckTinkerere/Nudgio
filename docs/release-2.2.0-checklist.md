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

## Not covered by this pass

- **API 31–32 was not exercised.** That is the only range where
  `SCHEDULE_EXACT_ALARM` still applies and the contextual Settings path
  survives. The emulator used was API 36; the older path is unchanged code,
  but it was not re-tested.
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
