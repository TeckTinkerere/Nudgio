# Nudgio 2.1.0 — release convergence record

Artifact: `releases/v2.1.0/Nudgio-2.1.0.apk`
SHA-256: `035de871fb254daf4780cb27f2efdfb327c50766b11eef9df69b00ff8bd4b82f`

## Decisions taken during convergence

**Backup (Phase 3): PATH A — complete media backup.** Chosen because the work
was already implemented and verified end to end before this release phase
began (DL-103), not rushed into it. The archive carries real `media-assets.json`
records plus the bytes at `media/<storage_key>`, streamed in two passes so peak
memory stays at one 64 KB window regardless of asset size; entries are STORED,
hash-verified while extracting, written as `.part` and renamed, and a storage
key that could escape the media folder is rejected on read. Verified: a 6-asset
export produced an archive whose 16 entries all verified against
`checksums.sha256`, and deleting a 3.2 MB video four reminders depended on then
restoring put it back byte-for-byte.

**Version:** 2.0.0 (code 14) → **2.1.0 (code 15)**, via
`scripts/release/stamp-version.js`, matching the repository's existing
convention. Substantial feature work, no breaking change.

## Findings and classification

| | Finding | Decision |
|---|---|---|
| **P0** | Upgrade from v2.0.0 (schema 6 → 7) | **Cleared.** `MIGRATION_6_7` is additive `ALTER TABLE ADD COLUMN` only; no `fallbackToDestructiveMigration` anywhere. Tested by installing the published v2.0.0, creating a reminder + media, then upgrading: no crash, data intact. |
| **P0** | Signing identity must match the published app | **Cleared.** v2.0.0 and 2.1.0 signer certificates are byte-identical (`4acfa5e6…501c`), so upgrades install. |
| **P0** | "No Internet permission" privacy claim | **Cleared.** Proven from the release APK's own merged manifest, not the source: `INTERNET` count is 0. The only additional entry is `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, a signature-level self-permission AndroidX generates. |
| **P0** | Recurring alarm after reboot | **Cleared.** After reboot the boot receiver started the process and the next occurrence was re-registered as an exact `RTC_WAKEUP` for 2026-10-04 06:15, `window=0`, `exactAllowReason=permission`. |
| **P1** | Privacy policy said uninstalling deletes all media | **Fixed.** "Save a copy to gallery" writes outside app-private storage and those copies survive uninstall. `web/privacy.html` now states this, and that backups contain the media bytes. |
| **P1** | A restore did not refresh the app | **Fixed before RC.** `ImportScreen` now invalidates media, reminders and the startup snapshot on commit; previously a restore that had just repaired a missing file still showed "Media unavailable" until relaunch. |
| **P2** | Stale dev JS bundle in `android/app/src/main/assets/` | **Removed before the release build** so the APK carries only the bundle Gradle generated. Confirmed: the RC shows the new onboarding copy, not v2.0.0's. |
| **P3** | `AlarmRingingService.kt:342` "Condition is always 'true'" ×3 | **Ship.** The three null checks are redundant with `willRetry`, which already implies them. No behavioural impact; removing them risks the smart casts inside the block. |
| **P3** | `ReactNativeHost` deprecation warnings | **Ship.** React Native framework API, not ours. |
| **P3** | `package.json` version is `0.1.0` | **Ship.** Not user-visible and not read by the build; the app's version comes from `android/version.properties`. |
| **P3** | One Library item titled "22" | **Ship.** A numeric Photo Picker name predating the `MediaKinds.titleFrom` fix. Rewriting it would be a migration of user-visible data for cosmetics. |

## Known limitations shipped deliberately

- **Uninstall removes imported media.** App-private storage is what makes a
  reminder survive the user clearing their gallery; the trade is that Android
  deletes it with the app. A backup now carries the media, so the recovery
  route exists and is the user's to take.
- **Gallery save needs Android 10+.** Below API 29 it would require
  `WRITE_EXTERNAL_STORAGE`; the share sheet remains the permissionless path
  there, and the UI says so rather than failing silently.
- **Replace mode does not delete existing media.** Documented in
  `BackupImporter.commitReplace`: reminders are recoverable from the archive,
  a photo is not.

## Not covered by this pass

- Device-size matrix beyond the 393×851 emulator this RC was driven on. The
  responsive work was verified in an earlier cycle at 320×568, 360×800,
  430×932, 768×1024, landscape and 1.5× font, but not re-driven against this
  exact APK.
- Screen-reader semantics were not exercised with TalkBack on this RC.
