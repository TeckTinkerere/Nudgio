# Developer Guide

Practical, day-to-day notes. Read [`AGENTS.md`](../AGENTS.md) and
[`ARCHITECTURE.md`](../ARCHITECTURE.md) first — this document assumes both.

## Setup

```bash
npm ci
npm run typecheck
npm run lint
npm test
```

`npm run android` and `cd android && ./gradlew test lintDebug` need a local
Android SDK + JDK 17. Neither has been available in every environment this
project has been developed in so far — see `docs/decision-log.md` DL-004.
**Confirm you actually have both before assuming a native change compiles**;
nothing in CI/this repo currently verifies that for you.

Node >= 20.19 (see `package.json` `engines`).

## Where things live day-to-day

- Adding a **screen**: `src/features/<area>/`, export it from that folder's `index.ts`, wire the route in `src/constants/routes.ts` and the relevant navigator under `src/app/navigation/`. Every screen needs loading/empty/error states — copy the pattern from `TodayScreen.tsx` or `LibraryScreen.tsx` (`LoadingState`/`ErrorState`/`EmptyState` from `design-system`, gated on `query.isPending`/`isError`/empty data — use `isPending`, not `isLoading`; see the comment on every screen that does this for why).
- Adding a **design-system component**: `src/design-system/components/`, export from `components/index.ts` and the top-level `design-system/index.ts`. Never read `theme.color.*` literals directly in a component — go through `useTheme()`/`useSurfaceStyle()`/`useRippleConfig()`. Never write a raw spacing/color number — use the tokens in `design-system/tokens/`.
- Adding a **bridge method**: declare it in `src/native-client/NativeMediaReminder.ts` (the RN-side contract), add it to `MediaReminderClient` (typed, `Result`-wrapped), add a matching case to `mockNativeModule.ts` (for Metro-only dev/tests) and implement it in `MediaReminderModule.kt`. If it's genuinely not built yet, reject with `NativeErrorEnvelope.rejectNotImplemented()` — every unimplemented method already does this so a screen behaves identically against the mock and the real module.
- Adding a **Room entity/DAO**: `android/.../data/db/entity/`, `.../data/db/dao/`, register the entity in `MediaReminderDatabase.kt`, and — this is not optional — write a real `Migration` in `Migrations.kt`. Destructive migration is prohibited in release builds (MR-09).
- Adding a **service the UI needs** (like haptics): `src/core/services/`, wire it into `AppContainer.ts` (real) and `src/testing/createTestContainer.ts` (fake/recording), consume it through a hook in `src/hooks/`, not directly from a screen.

## Testing

- `npm test` runs Jest + React Testing Library against `renderWithProviders()`/`createTestContainer()` (`src/testing/`) — every repository/service is a fake, nothing touches a real bridge.
- Kotlin: only `OccurrenceCalculator` and `DevicePresentationState` have unit tests (`android/app/src/test/`) because they are the only two classes with zero Android framework dependency — everything else (Room, `AlarmManager`, `NotificationManager`) would need Robolectric or an instrumentation test on a real device/emulator, neither of which has been set up yet. See `docs/KNOWN_ISSUES.md`.
- `npm run verify` runs typecheck + lint + test in one shot — run it before considering any change done.

## Conventions worth internalizing

- **`Result<T, AppError>`, not exceptions**, for anything that can fail in an expected way (a bridge call, a validation). Reserve `throw` for genuine programmer errors.
- **`isPending`, not `isLoading`** when checking a React Query result's loading state — `isLoading` is a derived convenience flag in v5 that does not narrow the `data` type; `isPending` does.
- **No inline magic numbers for spacing/color/radius/duration** — ESLint enforces this in `design-system/`; use the named tokens (`theme.spacing.md`, not `16`).
- **`android_ripple` + a `useRippleConfig()` color, not raw opacity dimming**, for new Pressable-based components (this app is Android-only — no cross-platform branching needed).
- **Motion**: every animation token in `design-system/tokens/motion.ts` declares its own reduced-motion behavior (`instant`/`fade`/`nonVisual`) in the same place it declares its duration — a new animation cannot ship without deciding what it does under reduced motion. Use `useMotionDuration(token)` to read the effective duration.
- **Haptics**: `useHaptics()` (`src/hooks/useHaptics.ts`), scoped to alarm/notification-adjacent confirmations (accept/snooze/dismiss, destructive deletes) — not sprinkled on every tap. See its own doc comment for the rationale.
- **Localization**: every user-visible string is a key in `src/localization/resources/en.ts`. No string concatenation to build a sentence (MR-13) — a new sentence is a new key, even if it shares words with an existing one.
- **On the Kotlin side**: no `GlobalScope`. Every coroutine scope is tied to a component's own lifecycle (`invalidate()` on the bridge module, `onDestroy()` on the service/activity) and gets cancelled there. Every manifest `BroadcastReceiver` that does Room/suspend work uses the shared `dispatchWithWakeLock()` helper (`alarm/BroadcastDispatch.kt`) — acquire, `goAsync()`, run, release in `finally`, always.
- **Every failure path still leaves an alarm registered.** If you touch `AlarmDispatchReceiver`, `AlarmActionReceiver`, or `SystemEventReceiver`, keep the `onFailure`/`catch` branch that calls `SchedulerCoordinator.reconcile()` — that is not incidental error handling, it is the thing that stops a crash from silently un-arming the user's alarm.

## Debugging

- `NativeLogger` (Kotlin) / the injected `Logger` (`core/logging/`, TypeScript) are the only logging paths — never `console.log`/`Log.d` directly in product code (MR-18: nothing sensitive gets logged; a raw `console.log` bypasses that discipline entirely).
- Bridge call latency/success is logged automatically by `MediaReminderClient`'s `call()` wrapper (`bridge.call` events) — check there before adding ad hoc logging around a bridge call.
- If a screen shows stale data after a mutation, check whether the mutation's `onSuccess` calls `queryClient.setQueryData`/`invalidateQueries` for the right `queryKey` (`core/state/queryKeys.ts`) — this codebase seeds the cache directly rather than always refetching, so a missed key is a silent staleness bug, not a crash.

## What's mocked vs. real right now

Read `docs/decision-log.md` before assuming a feature is wired end-to-end.
As of this pass: reminder CRUD, Play/Snooze/Dismiss, scheduling, boot/direct-boot
recovery, and backup export are real on the native side. Media import/library,
user-defined profiles, capability deep-links (`openCapabilitySettings`), and
the import screen's file picker are still native no-ops or JS-side mocks —
see `docs/FUTURE_IMPROVEMENTS.md`.
