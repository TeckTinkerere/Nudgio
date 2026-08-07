# scripts/

Build, schema, checksum and release tooling (MR-07 repository layout,
MR-20 release pipeline).

## `release/`

Two standalone Node scripts (no build/Gradle dependency — safe to run and
verify on their own).

### `stamp-version.js` — version stamping (MR-20 "Application identity")

```bash
npm run release:stamp-version -- 0.2.0
# or an explicit versionCode, only for recovering a skipped release's numbering:
npm run release:stamp-version -- 0.2.0 5
```

Writes `android/version.properties`, which `android/app/build.gradle` reads
for `versionCode`/`versionName` (ADR-019). Refuses to run if the new
`versionName` isn't a strictly-greater `X.Y.Z`, or the resulting
`versionCode` isn't strictly greater than the current one — Android's
upgrade identity depends on `versionCode` only ever increasing, and there is
no way to walk it back after a release ships.

### `checksums.js` — release artifact checksums (MR-20 "Release assets")

```bash
npm run release:checksums -- path/to/release-dir
```

Writes `SHA256SUMS.txt` into that directory (or a path given as a second
argument) covering every other file in it, in the same `<hex>  <name>`
format `sha256sum` itself produces — verifiable with common tools, not just
this script.

### Signing (MR-20 "Signing key management", MR-18)

`android/app/build.gradle` looks for, in order:

1. `RELEASE_STORE_FILE` / `RELEASE_STORE_PASSWORD` / `RELEASE_KEY_ALIAS` /
   `RELEASE_KEY_PASSWORD` environment variables (CI — MR-20 "CI signing uses
   protected secret storage only if the threat model is accepted").
2. `android/keystore.properties` (gitignored; copy
   `android/keystore.properties.example` to get the expected keys) — for
   local/offline signing, which MR-20 explicitly allows "for early releases".

With neither present, `./gradlew assembleRelease`/`assembleQa` produce an
**unsigned** APK — the same behavior as before this tooling existed. Never
commit a real keystore, `keystore.properties`, or paste a signing password
anywhere this repository's history or an AI chat can retain it.

### What's still manual

Everything else `specs/Markdown/20_Release_Distribution_Portfolio_and_Maintenance_Guide.md`'s
"Build pipeline" describes — running the full typecheck/lint/unit/migration/
archive-security/instrumentation suite, generating an SBOM and third-party
notices, verifying the signature on a reference device, and writing release
notes — is not scripted yet. See `docs/APK_RELEASE_CHECKLIST.md` for the
current state of each.
