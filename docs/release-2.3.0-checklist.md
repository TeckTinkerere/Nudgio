# Nudgio 2.3.0 — release record

Artifact: `releases/v2.3.0/Nudgio-2.3.0.apk`
SHA-256: `884e5db9fe4cac7633963cffe44b8ef16b9329d622e11e2aaea736d7eda6285e`
Size: 32,428,221 bytes (30.9 MiB), +33,960 bytes over 2.2.1

A minor release: schema migration 7→8, a new intent-filter surface (Share to
Nudgio), and a fix for a reported bug. See `docs/decision-log.md` DL-109/DL-110
for full rationale.

## What changed

- **Fix:** the free-space reserve before an import had no upper cap, so a
  large-capacity phone could be asked to keep 12+ GB free while the shown
  error still said 250 MB (DL-109). Now capped at 1 GB, and other apps'
  clearable cache counts via `StorageManager.getAllocatableBytes`.
- Multi-select media import (up to 20 files), from Library and the alarm
  editor.
- Share to Nudgio — import photos/videos/audio shared in from other apps
  (`SEND`/`SEND_MULTIPLE`), with no new permission; guarded against a hostile
  app sharing this app's own private files back at it.
- Lossless image compression — PNG/BMP imports re-encoded as lossless WebP
  only when verified pixel-identical and ≥10% smaller; every other format and
  all video/audio is stored exactly as picked.
- Large-file warning (MR-09's 500 MB soft limit, previously unused).
- Undo on reminder delete; Skip next for repeating reminders; Pause all
  reminders; a chosen video/audio start point; a storage-cleanup filter for
  media unused by any reminder; Cancel wired onto every import progress bar.
- Additive DB migration `MIGRATION_7_8` (`reminders.media_start_ms`,
  `media_assets.source_sha256`); backups gain two optional keys, so older
  archives still restore.

## Verified against the artifact, not just the source

| Check | Result |
|---|---|
| Version identity | `versionCode=20`, `versionName=2.3.0`, `com.aslam.mediareminder` |
| Signing certificate | `4acfa5e6…501c` — unchanged since 2.1.0 |
| `INTERNET` permission | **count 0** |
| Full permission list | Identical to 2.2.1: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` (maxSdkVersion 32), `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK`, `USE_FULL_SCREEN_INTENT`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` — Share to Nudgio added an intent-filter, not a permission |
| `SEND`/`SEND_MULTIPLE` intent filters | Present on `MainActivity` in the built manifest, `category.DEFAULT`, `image/*` \| `video/*` \| `audio/*` |
| Artifact matches HEAD | Built from a clean tree at `2cf72aa` (version-stamp commit); no source file newer than the APK |
| Automated verification | typecheck ✓, lint ✓, **148/148** Jest tests, **180/180** Kotlin unit tests, manifest merge ✓ |

## Not yet verified on a physical device

This build has not been installed or exercised on hardware. Before relying
on it:

- The reported storage-reserve bug, on a device with a large volume and
  single-digit GB free (the real motivating case for DL-109).
- Multi-select import (Library and the reminder editor), including Cancel
  mid-batch and a file that fails partway through a batch.
- Share to Nudgio from a cold start and a warm start; confirm a `file://`
  share is silently ignored, not imported.
- A PNG/screenshot import: stored smaller, visually identical, and a
  re-import of the same file reuses the existing asset.
- Skip next → fires the following occurrence, not the skipped one; Undo skip
  restores it; editing the reminder's time clears any pending skip.
- Pause all (each duration) → nothing rings until it ends; Resume early
  restores a one-time reminder that fell inside the pause.
- Delete a reminder → Undo within 6 s restores it with the same media and
  schedule.
- Choose a start point in the editor's preview → the moment opens the video
  there.
- Upgrade install over an existing 2.2.1 install: `MIGRATION_7_8` runs
  cleanly and existing reminders/media are unaffected.

The full checklist lives in `TODO.md`'s "On-device checks for DL-109/DL-110"
section; this release should not be treated as device-verified until that
list is worked through.
