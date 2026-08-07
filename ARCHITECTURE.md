# Architecture

Engineering-level map of how the code is actually organized, one level below
the product/requirements spec. For the binding design decisions and the
"why", read [`specs/Markdown/07_Technical_Architecture.md`](specs/Markdown/07_Technical_Architecture.md)
and [`specs/Markdown/17_Architecture_Decision_Records.md`](specs/Markdown/17_Architecture_Decision_Records.md)
first — this document does not repeat their reasoning, only orients you
inside the code.

## Two runtimes, one contract

```
┌─────────────────────────────┐        TurboModule bridge        ┌──────────────────────────────┐
│   React Native (src/)        │  <───── MediaReminderSpec ─────>  │   Kotlin (android/app/.../   │
│   UI, navigation, state       │        (typed, versioned)         │   mediareminder/)             │
└─────────────────────────────┘                                    └──────────────────────────────┘
        no alarm/Room access                                          owns Room, AlarmManager,
        renders whatever the                                          NotificationManager, boot,
        bridge/mocks return                                           ringing service, backup
```

- **React Native never touches an alarm, Room row or notification directly.** Every mutation goes through `MediaReminderClient` (`src/native-client/MediaReminderClient.ts`), which wraps the TurboModule (`MediaReminderModule.kt`) in `Result`, runtime-decodes the payload, and checks the bridge contract version.
- **Play/Snooze/Dismiss work with the JS bridge disabled.** `AlarmActionReceiver` (notification tap) and `MediaReminderModule.resolveAlarmAction` (in-app tap) both call the *same* `AlarmActionProcessor.process()` — one nonce-checked, idempotent implementation, two entry points, never duplicated logic.
- **The UI never calculates the next occurrence.** `OccurrenceCalculator` (pure Kotlin, JVM-testable, no Android dependency) is the sole authority; the JS `ReminderEditorScreen` preview is an explicit best-effort approximation, documented as such in its own code.

## React Native layer (`src/`)

```
app/            composition root: DI container (AppContainer), providers, navigation, bootstrap
design-system/  tokens (spacing/typography/shape/motion) → theme (brand + Material You) → components
core/           errors (AppError/Result), logging, config, storage, repositories, services, state (React Query)
native-client/  typed bridge client + mock double for Metro-only dev/tests
features/       one folder per screen area (today, library, reminders, settings, backup, ...)
hooks/          glue between core/design-system and features (useHaptics, usePreferences, ...)
localization/   MR-13 string resources; no concatenated sentences
testing/        renderWithProviders(), createTestContainer() — fakes every service/repository
```

Dependency direction is one-way and enforced by `.eslintrc.js`: `design-system` never imports from `core`, `app`, or a service — it is a pure presentation layer. Anything that needs a service (haptics, preferences, the DI container) lives in `hooks/` or `features/`, not inside a `design-system` component.

**Errors and results.** Every bridge call returns `Result<T, AppError>` (`core/result/Result.ts`), never throws for an expected failure. `AppError` is a runtime-decoded version of the Kotlin-side `NativeErrorEnvelope` (code, message key, category, correlation ID) — `toAppError.ts` never trusts the wire shape blindly.

**State.** React Query owns *server truth* (bridge responses) via `useAppQuery`/`useAppMutation`. Zustand (`core/state/sessionStore.ts`) owns ephemeral, disposable UI state that arrives from native events outside React's render cycle (the in-app due banner) — deliberately never the alarm session's truth itself, which is always re-fetched from `StartupSnapshot` on cold start.

**Dev/test double.** With no native module registered (Metro-only preview, or before a real Android build exists), `demoNativeModule.ts` seeds a mock implementation from `mocks/fixtures.ts` so every screen renders real-looking data instead of empty states. This only runs under `__DEV__`; a real registered module is never displaced by it.

## Kotlin layer (`android/app/src/main/java/com/aslam/mediareminder/`)

```
alarm/          SchedulerCoordinator, AlarmDispatchReceiver, AlarmActionReceiver, AlarmActionProcessor,
                 AlarmRingingService, AlarmActivity, SystemEventReceiver, OccurrenceCalculator,
                 DevicePresentationState, ExactAlarmAccess, DirectBootEnvelopeStore
bridge/         MediaReminderModule (the TurboModule), NativeErrorEnvelope, BuildVariant
notifications/  NotificationCoordinator (channels, due/generic/test notifications)
data/db/        Room: entities, DAOs, Migrations, MediaReminderDatabase
data/           PreferencesRepository (DataStore), DynamicColorProvider, ReminderProfileSeed
reminders/      ReminderMutationService, ReminderDtoWriter, ScheduleRuleBridge, ActionResultWriter
backup/         BackupExporter, BackupImporter, structural/semantic validators, conflict planner
capability/     CapabilitySnapshotProvider
diagnostics/    NativeLogger
```

### The alarm pipeline (ADR-005/006/007)

One globally-earliest alarm is ever registered — never one per reminder, never a repeating `AlarmManager` entry, never a polling loop.

1. **`SchedulerCoordinator.reconcile(reason)`** — called after any reminder save/enable/delete/action, after boot, after a `TIME_SET`/`TIMEZONE_CHANGED` broadcast. Serialized by an in-process `Mutex`. Ensures every active reminder has a pending occurrence (batched queries, not N+1), reads the single earliest eligible one, and calls `AlarmManager.setAlarmClock()` (exact, when `SCHEDULE_EXACT_ALARM` is granted) or `setAndAllowWhileIdle()` (Limited fallback — transparent, never silently unscheduled).
2. **`AlarmDispatchReceiver`** — the manifest receiver `AlarmManager` actually wakes. Rejects a stale broadcast (generation mismatch), atomically claims the occurrence (`UPDATE ... WHERE state IN (...)`, zero rows claimed = someone else already handled it), computes `DevicePresentationState` (locked/full-screen vs. unlocked notification), posts the notification, starts `AlarmRingingService` if the profile wants continuous ringing, then reconciles the *next* occurrence before finishing.
3. **`AlarmActionProcessor`** — the one implementation of Play/Snooze/Dismiss resolution, called identically by `AlarmActionReceiver` (notification tap, no RN) and `MediaReminderModule` (in-app tap). Idempotency is a real DB row (`idempotency` table), not just an in-memory guard.
4. **Boot/direct-boot (`SystemEventReceiver`, `DirectBootEnvelopeStore`)** — before first unlock, Room is unreadable; a label-free envelope (due instant + generation only, mirrored into device-protected storage on every successful `AlarmManager` apply) is all this path has to work with. Once `BOOT_COMPLETED` fires, real Room reconciliation replaces it.

### The backup pipeline (MR-10)

Export: snapshot Room → build ZIP entries in memory (no media assets exist yet, so this is small) → write STORED entries with per-entry SHA-256 → write `checksums.sha256` last → verify the archive reopens → return the file + hash.

Import: **stage** (stream the chosen URI into private storage) → **inspect** (`BackupZipStructuralValidator`: entry-count/size caps, path-traversal/absolute-path/drive-prefix rejection, compression-ratio-bomb detection, duplicate/case-variant names — all before a single byte of content is trusted; then `BackupSemanticValidator`: manifest/checksum verification, FK resolution, UUID uniqueness) → **commit** (token re-validated against the staged digest, `Merge` or `Replace` inside one Room transaction, phase-tracked in `operation_journal` so a crash mid-restore rolls forward on next startup, never leaves partial state).

### DI (both sides)

- **Kotlin**: no framework. `MediaReminderModule`'s `init` block wires `PreferencesRepository`, `MediaReminderDatabase.getInstance()`, and `ReminderMutationService` by hand.
- **React Native**: `AppContainer` (`src/app/di/AppContainer.ts`) is the single factory-function wiring point — every service/repository is an interface + a factory, no decorators or reflection. `createTestContainer()` (`src/testing/`) mirrors it with fakes (recording logger, recording haptics, in-memory KV store, mock native module) so a screen test never touches Android or Room.

## Cross-cutting invariants worth knowing before you touch either side

- **No polling, no timer, no repeating alarm.** `SchedulerCoordinator` runs only when explicitly invoked. If you find yourself wanting a background loop, that is very likely the wrong shape (ADR-007).
- **Domain calculation has no Android dependency.** `OccurrenceCalculator` and `DevicePresentationState` are plain Kotlin objects, unit-testable on the host JVM with no emulator. Keep new pure logic there, not inside a receiver/service.
- **A component fails safe, never silently un-arms the alarm.** Every dispatch path (`AlarmDispatchReceiver`, `AlarmActionReceiver`, `SystemEventReceiver`) wraps its work in a bounded wake lock + coroutine, and its failure branch still calls `SchedulerCoordinator.reconcile()` so a crash never leaves the app with nothing registered.
- **Runtime-decode anything crossing the bridge.** Codegen validates shape, not semantics (MR-18) — see `toAppError.ts`, `decodeDynamicColorPayload()`, and every `BackupSemanticValidator` check for the pattern.
