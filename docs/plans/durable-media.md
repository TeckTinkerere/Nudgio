# Durable managed media — findings and plan

## What the investigation found

The brief's premise is that Nudgio may depend on the original gallery file. **It does not, and never has.**

`MediaImporter` already implements the brief's desired import flow, step for step:

| Brief's requirement | Current implementation |
|---|---|
| Receive source URI | `ContentResolver.openInputStream` |
| Validate source | `MediaKinds.kindOf` group check before any bytes move, `MediaProbe` codec check after |
| Create managed destination | `MediaStorage.newStorageKey` → opaque `<uuid>.<ext>` |
| Stream/copy | 64 KB buffer, hashed in the same pass, running hard cap enforced per iteration |
| Verify copy completed | `fsync`, then atomic `.part` → final `renameTo` |
| Store managed record | `media_assets` row inserted *after* the file is final |
| Reminder references managed copy | `reminders.media_id` → `media_assets.id` → `storage_key` → file |

`MediaAssetEntity` has **no source-URI column at all**, and says why: *"No source gallery URI is required after copy… Storing it would create a path that breaks when the user moves or deletes the original — the exact failure ADR-010 exists to avoid."*

The behaviour is also already specified. `specs/.../11_Edge_Cases...md`:

> **Original gallery file deleted** — No effect after successful import because app owns a copy.

So Scenarios 1, 2, 3, 8 and 10 in the brief pass by construction, and there is **nothing to migrate**: no release ever stored an external URI, so there is no URI-based media record in any user's database.

Also already built, and deliberately so:

- **COPY, not MOVE** — the Photo Picker grant is read-only; the original is never touched.
- **Reference-counted deletion** — `MediaReminderModule.deleteMedia` resolves `attachedReminderIds` first and either deletes each attached reminder through `reminderMutations.delete` (alarm rescheduling included) or disables it, which is exactly what the Library's dependency-aware dialog's two destructive choices select between.
- **Albums are metadata** — `library_memberships` is a join table, so moving media between albums cannot invalidate a reminder.
- **No storage permissions** — Photo Picker (API 33+, permissionless) with SAF fallback for audio. Nothing to widen.
- **Streaming, caps and reserve** — 2 GB per asset, 250 MB/5% free-space reserve, cancellation, journal-based crash recovery, four progress phases.

## The real gaps

Four of these are the same defect species as DL-096: a DAO method written with a doc comment describing its purpose, and no caller.

1. **Duplicate imports are never detected.** `MediaDao.getBySha256` is documented *"Duplicate detection on import (MR-09 indexes `sha256` for exactly this)"* and has **zero callers**. The same photo imported five times is five full copies.
2. **Missing managed media never disables anything.** The spec requires *"Integrity state Missing; disable attached reminders; due event stops alert and shows Media unavailable."* DL-096 made missing media *visible in the Library*; nothing disables the reminders, so a 7:00 AM alarm still fires and plays nothing.
3. **`MediaStorage.sweepPartials()` has zero callers.** Its own doc says *"[sweepPartials] removes them"*. The importer deletes its own `.part` on every failure path it can catch, so the leak is narrow — process death mid-copy — but that is exactly the case the sweep exists for.
4. **Storage cost is invisible.** Nothing anywhere tells the user Nudgio is holding 486 MB of their media.

Plus stale comments now contradicted by the code: `ReminderEntity`'s *"that table does not exist yet"*, `useDeleteMedia`'s *"a cascade delete removes reminder rows outright"* (it is conditional), and `MediaAssetEntity.thumbnailPath`'s claim that reads do not re-check existence (DL-096 changed that).

## Architecture decision: the visible Nudgio album

**The app-private copy stays the single source of truth. MediaStore visibility is an explicit, per-item export — never the alarm's source.**

The brief asks for imported media to appear as a recognisable album under something like `Pictures/Nudgio/`, and asks me to determine the correct Android architecture rather than blindly creating a folder. Determined:

Making the managed copy MediaStore-visible **re-creates the brief's own opening failure**. The scenario that motivates the whole document is *"the user cleans their gallery and deletes the original video."* A gallery cleanup sweeps `Pictures/Nudgio/` exactly as readily as `DCIM/Camera/`. Of the brief's four stated goals, *"Nudgio owns a durable copy"* is first, and MediaStore cannot guarantee it — any app with media permission, any cleaner, any file manager, and the user themselves can delete it.

The brief anticipates this and settles it: *"If Android deliberately allows users to delete visible MediaStore items, respect that. The goal is resilience, not preventing the device owner from controlling their files."* It does, and there is no supported protection mechanism to reach for — `IS_PENDING` covers in-progress writes, and `createDeleteRequest` only *asks* the user. The honest answer to the brief's "OPTIONAL PROTECTION STRATEGY" section is that no such mechanism exists, and fighting the OS was explicitly ruled out.

Two further consequences decide it:

- **Uninstall.** App-private media is removed with the app: clean, no orphans. MediaStore media **survives uninstall** as hundreds of orphaned megabytes of personal photos the user must hunt down themselves.
- **Privacy.** Today Nudgio's imported personal media is readable by no other app on the device. `Pictures/Nudgio/` is readable by every app holding `READ_MEDIA_IMAGES`. For an app whose public pitch is local-first with no Internet permission, silently making the user's chosen personal media world-readable is a regression, not a feature.

The brief's goal 3 — *"the user can understand that Nudgio has preserved the media"* — is real, and is better served directly:

- **Storage visibility in Settings** ("Nudgio media · 24 items · 486 MB") states plainly that Nudgio holds its own copies. A gallery folder only implies it.
- **"Save a copy to gallery"**, per item, opt-in, writing to the correct MediaStore collection per kind (`Pictures/Nudgio`, `Movies/Nudgio`, `Music/Nudgio` — not audio forced into an image folder). The user gets the visible album when they ask for it, and the alarm never depends on it.

## Backups

`BackupFormat` already separates metadata (`data/*.json`) from bytes (`media/` prefix) inside one archive, and labels the archive `contains-private-media`. Restore-with-missing-media accounting is checked against gap 2's work rather than assumed.

## Uninstall

Investigated and chosen deliberately, as the brief asks.

Managed media lives in `context.filesDir/media/`, so **Android deletes it with
the app**. Thumbnails are in `cacheDir` and can be reclaimed sooner. Nothing
Nudgio writes survives an uninstall except what the user exported themselves —
a backup archive (saved through the system file picker) or a per-item "Save a
copy to gallery".

That is the intended outcome, not an oversight: personal media should not
outlive the app the user removed, and the alternative — MediaStore-visible
copies — would leave hundreds of megabytes of someone's photos behind in a
folder they have to find and clear by hand.

Uninstalling still removes imported media from the device — but it is no
longer a one-way door, because a backup now carries the bytes (DL-103). That
is the recovery route, and it is the user's to take deliberately.

## Backups: what they actually contain

**Fixed — see DL-103.** The archive now carries real `media-assets.json`
records and the bytes alongside them at `media/<storage_key>`, streamed in two
passes so peak memory stays at one 64 KB window regardless of asset size.
Verified on device: six assets produced a 6.4 MB archive whose sixteen entries
all verify against `checksums.sha256`, and deleting a 3.2 MB video four
reminders depend on then restoring put it back byte-for-byte.

What follows is the original finding, kept because it is why the uninstall
note above mattered.

`BackupExporter` wrote **no media at all** — `mediaAssets = 0`,
`totalMediaBytes = "0"`, an empty `media-assets.json` and no `media/` entries —
and `BackupImporter`'s file-promotion phase is an explicit no-op. The class
doc explains it as "No media assets exist yet", which was true when written
and is not now.

Meanwhile the product claimed otherwise in three places: Settings offered
"Export your media and reminders", the archive README promised "plus any
media/thumbnails you have added to the app", and restore reported "Restored
{mediaCount} media items". All three are now honest (DL-102). Carrying the
bytes is real work on both sides and is the top remaining item; the format was
designed for it and the hooks are unused.

## Status

| Work | State |
|---|---|
| Missing media fails safe — sweep, reminders disabled, "Media unavailable" | Done, verified on device |
| Duplicate import reuse via `getBySha256` | Done, verified (124 KB reclaimed, 6 files not 7) |
| Storage visibility in Settings | Done, verified ("5 items · 3 MB") |
| `sweepPartials` wired into startup | Done |
| "Save a copy to gallery" per kind via MediaStore | Done, verified (`/sdcard/Pictures/Nudgio/`) |
| "Replace media" recovery | Done, verified (repaired 4 reminders at once) |
| Backup copy made honest about media | Done |
| Media bytes in backups (export + import) | Done, verified end to end |
| Restore repairs an asset whose bytes went missing | Done, verified |
| Import invalidates its caches so a restore shows immediately | Done, verified |

## Original order of work

1. Missing media fails safe — startup integrity sweep marks `missing` and disables attached reminders; the moment and alarm say "Media unavailable" instead of showing nothing. *(gap 2 — highest product impact)*
2. Duplicate import reuse via `getBySha256`. *(gap 1)*
3. Storage visibility in Settings. *(gap 4)*
4. `sweepPartials` wired into the existing startup sweep. *(gap 3)*
5. "Save a copy to gallery" via MediaStore, per kind. *(the visible-album decision)*
6. "Replace media" recovery for a missing asset.
