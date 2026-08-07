# Future Improvements

Feature/scope work — distinct from `docs/KNOWN_ISSUES.md`, which is bugs and
gaps in what already exists. Everything here is a deliberate, documented cut
(see `docs/decision-log.md`), not an oversight.

## Product surface

- **Media import and library persistence.** `listMedia`/`getMedia`/`beginMediaImport`/`updateMedia`/`deleteMedia` are all native no-ops today; `LibraryScreen`/`MediaDetailScreen` are fully built against mock fixtures. This is the largest single gap between what the RN UI already shows and what the app can actually do (DL-012, DL-026).
- **Backup import file picker.** `BackupImporter.stage()`/`inspect()`/`commit()` are real; nothing yet turns a user's file choice into the `content://`/`file://` URI they need. Likely `ACTION_OPEN_DOCUMENT` via a small native intent, or a picker RN package if one is added deliberately (new dependency — needs the usual ADR per AGENTS.md). Unblocks `ImportScreen` end-to-end (DL-027).
- **User-defined reminder profiles.** Only the three built-ins (Gentle/Standard/Persistent) exist; `saveProfile`/`resetBuiltInProfile` reject not-implemented.
- **Capability deep-links.** `openCapabilitySettings` rejects not-implemented — Settings/Health's "fix this" actions (e.g. opening the exact-alarm special-access screen) don't work yet.
- **Onboarding pages 2-3** (adaptive-behavior illustration, permission-by-intent explainer) — page 1 only, deliberately, per the screen's own scope note.
- **Health screen per-item capability rows + Test reminder wiring** — overall status only today.
- **Full-screen alarm consent UI / explicit Limited-mode opt-in.** `SchedulerCoordinator` always falls back to `setAndAllowWhileIdle()` transparently rather than blocking on a consent screen; MR-06 describes an explicit choice UI that doesn't exist yet (DL-010).
- **Notification body content once media exists** — replace the current duplicated title/body (see Known Issues) with something that actually differs, once there's a real media title to show.

## Engineering

- **Kotlin test coverage.** Add Robolectric (or instrumentation) tests for `SchedulerCoordinator`, `AlarmActionProcessor`, `AlarmDispatchReceiver`/`AlarmActionReceiver`, `AlarmRingingService`'s queue/promotion logic, and the backup import/export pipeline end-to-end. `OccurrenceCalculator`/`DevicePresentationState` already show the pattern for the pure-Kotlin half; the Room/AlarmManager/NotificationManager half has none.
- **Release tooling** (`scripts/`, MR-20): version stamping, keystore-backed signing read from environment (never committed), checksum generation for release artifacts. See `docs/APK_RELEASE_CHECKLIST.md` for what a first release needs even before this tooling exists.
- **A real Gradle build, at least once**, to confirm ProGuard/R8 doesn't strip anything the reflection-based TurboModule registration or Room needs — currently unverified in every development environment this project has used so far (DL-004).
- **ZIP symlink-entry rejection** for backup import — needs Apache Commons Compress or an equivalent; deliberately not added yet to avoid an unverifiable new dependency (DL-031).
- **Notification-ID collision instrumentation test** — the 32-bit hash scheme is reasoned about, never tested against a real device's `NotificationManager`.

## Explicitly out of scope for now (per user direction this pass)

- Completing onboarding pages 2-3's content/copy.
- Building out Health's per-item capability rows.
- Wiring the still-stubbed taps in `RemindersScreen`/`MediaDetailScreen` (list row press, enable toggle, play/edit/export buttons) — each is documented in its own file as deferred pending the backend it depends on, not a UI oversight.
