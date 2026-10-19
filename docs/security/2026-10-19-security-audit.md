# Nudgio security audit — 19 October 2026

**Scope:** `main` at `a8e45f4` (Android v2.3.1). Android Kotlin core (`android/`), React Native UI (`src/`), the download site and waitlist function (`web/`), the build and release setup, and npm advisories (`npm audit`, 19 Oct 2026).
**Method:** Manual source review of every entry point that takes outside input (manifest components, share intents, backup import, media import, FileProvider, waitlist API), the build config, and git history scanned for secrets. Nothing was run on a device. No fixes are applied in this change.

## Summary

The shipped Android app has a strong baseline. There are **no critical or high-severity issues in the APK**. The real findings are about where backups are stored, restore paths that trust size fields in the archive, and a waitlist endpoint that reveals whether an email is already on the list. The npm advisory count looks alarming (63), but almost all of it is in the build and test tools, which never ship in the APK.

| ID | Severity | Area | Finding |
|---|---|---|---|
| SEC-01 | **Medium** | Backup | Plaintext backups live in external app storage. Other apps can read them on Android 8–9 (and legacy-mode apps on 10), and they are visible over USB. They are never cleaned up. |
| SEC-02 | **Medium** | Backup restore | Restoring media does not limit how many bytes it unpacks, so a crafted backup can fill the phone's storage. |
| SEC-03 | Medium | Website | The waitlist API tells anyone whether an email is already on the list. |
| SEC-04 | Low–Medium | Backup restore | A media file with no checksum line is restored without being verified. |
| SEC-05 | Low | Website | Waitlist: no length limit on emails, GET requests are not rate limited, the IP comes from a header, parse and Redis errors are not handled. |
| SEC-06 | Low | Backup restore | JSON entries are read fully into memory, up to about 800 MB in total, so a crafted archive can crash the app. |
| SEC-07 | Low | Distribution | The SHA-256 checksum file is hosted beside the APK, so it does not prove the APK is genuine. The signing-certificate fingerprint is not published. |
| SEC-08 | Low | Supply chain | No CI and no automated dependency scanning for npm or Gradle. |
| SEC-09 | Low (dev only) | npm | 63 advisories (1 critical, 56 high), almost all in Metro, Jest and the RN CLI tools. |
| SEC-10 | Low | Backup restore | `storageKey` values from the archive are not checked against the expected format. |
| SEC-11 | Info (known) | Backup restore | ZIP symlink entries are not rejected (DL-031, KNOWN_ISSUES). |
| SEC-12 | Low | Website | No security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`) on the static site. |

## Findings

### SEC-01 — Plaintext backups in external app storage (Medium)

**Where:** `android/app/src/main/java/com/aslam/mediareminder/backup/BackupExporter.kt:211-214`

```kotlin
/** App-private, no permission required (`getExternalFilesDir` is app-scoped on API 26+, ..., never visible to other apps ...) */
val base = context.getExternalFilesDir(null) ?: context.filesDir
val dir = File(base, "backups")
```

The comment is wrong for part of the supported range (minSdk 26). Scoped storage only arrived in Android 10 and was enforced in 11. On **Android 8–9**, any app holding `READ_EXTERNAL_STORAGE` can read `Android/data/com.aslam.mediareminder/files/backups/`, and on Android 10 so can apps that opted into legacy storage. On every version the folder is also visible to a computer connected over USB/MTP. A backup contains every reminder label and note plus **every media file, unencrypted**. Exports are never deleted after they are shared, so they pile up.

**Fix:**
1. Write exports to `filesDir/backups` (internal storage) and change `file_paths.xml` to a `files-path`. FileProvider sharing works the same way.
2. Delete the export once the share sheet returns, or keep only the newest one.
3. Optional: let the user set a passphrase that encrypts the archive (AES-GCM with a PBKDF2/Argon2-derived key). Unencrypted stays the default, so the format stays readable.

### SEC-02 — Media restore does not limit unpacked size (Medium)

**Where:** `backup/BackupImporter.kt:450-458` (`promoteMediaFiles`)

The structural validator checks per-entry and total sizes plus the compression ratio, but it checks them against the **sizes the archive itself declares**. The JSON reader re-checks the real decompressed stream (`BackupSemanticValidator.readEntryBytes`). The media copy loop does not: it writes until EOF. A crafted entry can declare `size = compressedSize`, which passes the ratio check, while really unpacking at roughly 1000:1, the most DEFLATE allows. The checksum mismatch is only found after the whole file is written. The user has to choose to import the file, but a full disk can also break Room writes and alarm scheduling.

**Fix:** In the loop, stop with an error once `copied > entry.uncompressedSize` or `copied > MAX_MEDIA_ENTRY_BYTES`. Before promoting, check the declared total against free space, using the same reserve rule as DL-109.

### SEC-03 — Waitlist reveals whether an email is on the list (Medium, privacy)

**Where:** `web/api/waitlist.js` (POST returns `alreadyJoined: added === 0`)

Anyone can POST an email and learn whether that person is already on the list. Rate limiting slows this down, but rotating IPs gets around it.

**Fix:** Always return the same response (`{ ok: true, count }`). If you want a "you're already on the list" message, send it by email, not in the HTTP reply.

### SEC-04 — Media without a checksum line is restored unverified (Low–Medium)

**Where:** `backup/BackupImporter.kt:461-464`: `if (declared != null && !declared.equals(actual, ...))`

JSON entries fail when their checksum is missing (`verifyAgainstDeclared` treats `null` as invalid). Media entries skip verification when it is missing, so the two rules disagree. Note also that `checksums.sha256` is **not authenticated**: it catches corruption, not tampering. Document that in MR-10.

**Fix:** Treat a missing checksum for a declared media entry as `media_entry_corrupt`, the same as a mismatch.

### SEC-05 — Waitlist endpoint hardening (Low)

**Where:** `web/api/waitlist.js`

- The email regex has no length cap, so long strings are stored as they are. Reject anything over 254 characters.
- `GET` makes a Redis `SCARD` call on every request with no limit, which is a way to run up Upstash costs. Cache the count, for example with `Cache-Control: s-maxage=60`.
- The rate-limit key uses the first `X-Forwarded-For` value. That holds on Vercel, which sets the header, but anywhere else it can be spoofed. Use `x-real-ip` or `ipAddress()` from `@vercel/functions`.
- The honeypot branch and the 400 branch skip the rate limiter.
- `JSON.parse(req.body)` and the Redis calls have no `try/catch`, so bad input or an outage gives an unhandled 500.

### SEC-06 — Restore can exhaust memory through JSON entries (Low)

**Where:** `backup/BackupSemanticValidator.kt:263-285`

Each JSON entry can be up to 100 MB (`MAX_AGGREGATE_JSON_BYTES`), and about eight are read into `ByteArray`s and then parsed by `org.json`, which takes several times more memory again. A crafted archive will cause an OOM crash. It is recoverable, but a crash all the same.

**Fix:** Enforce the 100 MB as a **total across entries**, as the constant's name suggests, and lower the per-entry cap (realistic archives are far below 10 MB of JSON).

### SEC-07 — Users cannot prove the APK is genuine (Low)

**Where:** `web/app.js`, `scripts/release/checksums.js`, GitHub Releases

Users sideload the APK. `SHA256SUMS.txt` is uploaded to the same release as the APK, so anyone who can replace the APK, such as someone who has taken over the GitHub account, can replace the checksum too. What actually proves an APK is genuine is its **signing certificate**.

**Fix:** Publish the release certificate's SHA-256 fingerprint in `README.md` and on `web/index.html`, with `apksigner verify --print-certs Nudgio.apk` instructions. Make sure 2FA is on for the GitHub account. Back up the release keystore offline: if it is lost, existing users can never be updated in place.

### SEC-08 — No CI or dependency scanning (Low)

There is no `.github/` directory. Nothing re-runs the manifest permission check, the tests or the advisory checks before a release.

**Fix:** Add a workflow that runs `npm run verify`, `./gradlew test lintDebug`, and a release-manifest assertion (no `INTERNET`, exported components = `MainActivity` only). Add Dependabot or OSV-Scanner for npm and Gradle.

### SEC-09 — npm advisories (dev tooling, Low)

`npm audit` reports 63 issues: 1 critical, 56 high, 6 moderate. Traced through `package-lock.json`:

| Package | Pulled in by | In the APK? |
|---|---|---|
| `shell-quote` 1.10.0 (**critical**, GHSA-pqg4-j6r4-53mv) | `launch-editor`, `react-devtools-core` | No. Dev server / debugger only. |
| `compression` 1.8.1 (high, DoS) | `@react-native-community/cli-server-api` | No. Metro dev server. |
| `image-size` 1.2.1 (high, DoS) | `metro` | No. Bundler. |
| `micromatch`/`braces`/`brace-expansion`/`js-yaml`/`joi` (high) | Jest, Metro, RN CLI | No. |
| `query-string` 7.1.3 → `decode-uri-component` (moderate, DoS) | `@react-navigation/core` | **Yes**, but only reachable through deep-link parsing, which the app does not configure. |
| `nanoid` 3.3.17 (high, custom generator with size 0) | React Navigation | Yes, but the vulnerable path (custom alphabet, size 0) is not used. |

The real exposure is a developer machine running Metro on a shared network. **Fix:** run `npm audit fix` (the non-breaking fixes cover shell-quote, compression, image-size, nanoid, joi, js-yaml and qs). Schedule Jest 29 → 30. Do not take audit's suggested `react-native@0.72` "fix"; it is a downgrade. `web/` has **0** advisories.

### SEC-10 — `storageKey` format not validated (Low, defence in depth)

**Where:** `backup/BackupSemanticValidator.kt:140`. The archive's `storageKey` becomes `File(mediaDir, storageKey)`. Traversal is blocked today only indirectly: the key must match a ZIP entry name, and entry names with `..` are rejected. Add a direct check (`^[0-9a-f-]{36}\.[a-z0-9]{1,5}$`) so that safety does not depend on the order of checks in another class.

### SEC-11 — ZIP symlink entries (Info, already known)

Already documented in DL-031, `docs/KNOWN_ISSUES.md` and `TODO.md`. `java.util.zip` writes symlink entries out as ordinary files containing the link target text, so this is not exploitable today. Keep it as a known gap. The Flutter/iOS archive reader (see the migration plan) must reject symlinks explicitly, because some ZIP libraries *do* follow them.

### SEC-12 — No security headers on the site (Low)

`web/` has no `vercel.json`. Add `Content-Security-Policy` (move the inline theme bootstrap script into a file, or use a hash), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy`.

## Checked and found sound

- **No `INTERNET` permission in release.** It is debug-only with a loopback-only cleartext config (`src/debug/`), and TODO.md records a check of the merged release manifest.
- **Exported components:** only the `MainActivity` launcher and share target. Every receiver, service, `AlarmActivity`, `AlarmOpenActivity` and the FileProvider are `exported="false"`.
- **All `PendingIntent`s use `FLAG_IMMUTABLE`** (Scheduler, SystemEvent, TestAlarm, Notification coordinators).
- **`allowBackup="false"`**, with `dataExtractionRules` and `fullBackupContent` excluding everything (ADR-015).
- **FileProvider** is limited to `backups/` and `media/`, read-only temporary grants, never a directory grant.
- **Share intake** (`IncomingShare`) accepts only `content://` URIs, rejects its own authority, filters MIME types and caps the batch size.
- **Media import:** storage keys are random UUIDs and the provider's display name is never used as a path. Size is checked against both declared and actual streamed bytes. Hash while copying.
- **Direct-boot store** keeps only the next due time and a generation counter. No labels or paths are readable before first unlock.
- **Backup ZIP structure checks:** traversal, absolute paths, drive prefixes, NUL bytes, duplicates and case variants, entry count, compression method, ratio, and total size.
- **Release logging:** `info`/`debug` are off outside debug, and warn/error fields carry IDs, not titles.
- **Secrets:** git history scanned, and the only matches are `changeme` placeholders in `keystore.properties.example`. Keystores, `.env` and signing files are gitignored.
- **Signing** reads environment variables or a gitignored properties file. R8 minification is on for release.

## Recommended order

1. SEC-02 and SEC-04: small, local fixes in `BackupImporter` with unit tests.
2. SEC-01: move exports to internal storage and clean them up. Update MR-10.
3. SEC-03 and SEC-05: one PR to `web/api/waitlist.js`.
4. SEC-07 and SEC-08: publish the certificate fingerprint, add CI with Dependabot.
5. SEC-09: `npm audit fix`, then re-run `npm run verify`.
6. SEC-06, SEC-10, SEC-12: hardening.

All of these fixes are needed in the Flutter version too. The Kotlin core is kept (see `docs/plans/2026-10-19-flutter-migration-plan.md`), so fixing them now fixes them for both.
