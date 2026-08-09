# Decision log

MR-17's ADR governance requires "intentional deviation" from the source-of-truth
pack to be "recorded in the decision log before release." Entries here are
implementation-level decisions made while building the application against
the Approved-baseline spec pack — narrower than an ADR, but still worth a
paper trail so a later contributor does not have to re-derive the reasoning
from the diff.

## DL-001 — Repository restructure to the MR-07 layout

**Date:** 2026-08-06
**Context:** The repository initially contained only the spec pack
(`Markdown/`, `Diagrams/`, `PDFs/`, `QA/`, `Sources/`) at the root, with no
application code.
**Decision:** Moved the spec pack under `specs/` (preserving internal
relative links between Markdown and Diagrams) and created the
`android/`, `src/`, `docs/`, `fixtures/`, `scripts/` layout MR-07 specifies.
**Consequence:** `specs/` is now the canonical location referenced by
`AGENTS.md` and `MASTER_LOOP_PROMPT.md`; both files' relative paths
(`Markdown/...`) still resolve because they are read as `specs/Markdown/...`
relative to repo root — update those two files if the pack ever moves again.

## DL-002 — Material You is implemented as an opt-in, not the default

**Date:** 2026-08-06
**Context:** MR-04 fixes the brand palette as the default "for consistent
screenshots and alarm recognition" but allows dynamic color to be "offered
later." The user separately asked for full Material You support in this
change.
**Decision:** Built a complete dynamic-color pipeline —
`getDynamicColorScheme()` reading Android's `system_accent*`/`system_neutral*`
tonal ramps, `schemeFromDynamicColor()` mapping them to the app's color
roles, and a Settings toggle (`settings.appearance.materialYou`) — with the
brand scheme remaining the default (`useMaterialYou: false` in
`defaultPreferences`). The alarm surface (`buildAlarmTheme`) never uses
dynamic color regardless of the setting, matching MR-04's stated reason for
keeping the brand default.
**Consequence:** No ADR conflict: MR-04's own text anticipates this exact
shape ("MAY be offered later"). Status/error colors stay on the brand values
in both modes (see DL-003) so meaning does not drift with the wallpaper.

## DL-003 — Amber `secondary` is not used as light-mode text or icon color

**Date:** 2026-08-06
**Context:** MR-04's light `secondary` token (`#D97706`) measures 3.04:1
against the light `surface` (`#F8FAF9`) — under MR-13 ACC-005's 4.5:1 text
threshold, though it clears the 3:1 UI-component threshold. This is a
property of the published palette values themselves, verified by
`src/design-system/theme/__tests__/contrast.test.ts`.
**Decision:** `secondary` remains available as a fill, border and accent
color. `Text` exposes no `secondary` tone. `StatusPill`/`Banner` render icon
and label in `role.onContainer` (a derived, contrast-checked pairing, see
`preferAccessible()` in `colorUtils.ts`), never in `role.color`, on their
tinted containers.
**Consequence:** No visible amber text on the light app surface. If a future
palette revision changes the light secondary hex, the assertion at the
bottom of `contrast.test.ts` will fail and flag that this constraint may be
ready to relax.

## DL-004 — Hand-registered TurboModule instead of generated Codegen output

**Date:** 2026-08-06
**Context:** This environment has no Android SDK, JDK-configured Gradle, or
network access to run `generateCodegenArtifactsFromSchema`. MR-08 specifies a
"Codegen/TurboModule interface."
**Decision:** `MediaReminderModule` implements the `TurboModule` marker
interface directly and is registered via `TurboReactPackage`
(`MediaReminderPackage`), matching the method surface declared in
`src/native-client/NativeMediaReminder.ts` by hand. `package.json` already
declares `codegenConfig` pointing at the same spec file.
**Consequence:** Switching to the generated `NativeMediaReminderSpec` base
class is a mechanical follow-up once a real Gradle build exists to verify it
— the method names, argument shapes and promise/reject semantics were
written to match what Codegen would produce. The JS/TS side (`npm run
verify`) is fully tested; the Kotlin side has **not** been compiled in this
environment and should be built with `cd android && ./gradlew assembleDebug`
before being trusted.

## DL-005 — Recurrence engine adds monthly/yearly/custom as an additive DTO change

**Date:** 2026-08-06
**Context:** The user asked for one-time, daily, weekly, monthly, yearly and
custom-interval repeat, but the MR-08 baseline `ScheduleRuleDto` only defined
`once`/`daily`/`weekdays`.
**Decision:** Extended the `ScheduleRuleDto` union (`src/native-client/types.ts`)
with `monthly`/`yearly`/`custom` variants and the matching Room columns
(`schedule_rules`: `day_of_month`, `month`, `interval_days`, `anchor_epoch_day`)
and `ScheduleRuleEntity.Type` enum values, computed by a new pure-Kotlin
`OccurrenceCalculator`.
**Consequence:** Per MR-08 "Versioning rules" ("changes only for breaking
semantics"), this did not require a bridge contract version bump — every
existing `switch (type)` consumer still compiles unchanged against the wider
union. `docs/decision-log.md` records it here anyway because it is exactly
the kind of change MR-17 asks to have a paper trail.

## DL-006 — DST/timezone resolution relies on `java.time`'s default gap/overlap policy

**Date:** 2026-08-06
**Context:** MR-06 requires correct behavior across DST transitions and
timezone changes, but does not mandate a specific gap/overlap resolution
algorithm.
**Decision:** `OccurrenceCalculator.nextOccurrence()` builds a `LocalDateTime`
from the rule's local wall-clock time and calls `.atZone(zoneId)` with no
custom transition arithmetic, relying on `java.time`'s documented default: a
spring-forward gap is pushed forward by the gap's length, and a fall-back
overlap resolves to the earlier of the two valid offsets unless
`preferLaterOnOverlap` is explicitly requested. Both minSdk 26 (native
`java.time`) and the JVM unit-test host (JDK 17) have full timezone-database
support, so no `desugar_jdk_libs`/`threetenbp` dependency was needed —
an initial `threetenbp` test dependency was added under a mistaken belief
otherwise and removed before landing.
**Consequence:** `OccurrenceCalculatorTest.kt` pins this behavior against two
historical, already-elapsed US transition dates (2023-03-12 spring-forward,
2023-11-05 fall-back) rather than a future 2026 date, so the test can never
depend on an assumption about a transition that has not happened yet.

## DL-007 — AlarmManager registration is a two-phase outbox, not one Room transaction

**Date:** 2026-08-06
**Context:** Room and `AlarmManager.setAlarmClock()` cannot be committed
atomically — there is no way to roll back an `AlarmManager` call if a
surrounding Room transaction later fails, or vice versa.
**Decision:** `scheduler_state` is a singleton outbox row (ADR-016): a Room
transaction bumps `desired_generation` first ("what should be registered"),
then `SchedulerCoordinator` applies that to `AlarmManager` outside the
transaction and writes `applied_generation` on success. `AlarmDispatchReceiver`
validates its `PendingIntent`'s generation extra against the current row
before acting, so a stale `PendingIntent` from a superseded schedule is
inert rather than mis-firing.
**Consequence:** If the process dies between the two phases,
`desired_generation != applied_generation` on the next reconciliation (boot,
timezone change, or any other trigger) and the coordinator simply retries —
no separate repair job is needed.

## DL-008 — Exactly one alarm is ever registered, chosen by a single SQL query

**Date:** 2026-08-06
**Context:** ADR-005 requires scheduling only the globally earliest due
occurrence across every reminder, never one alarm per reminder.
**Decision:** `OccurrenceDao.getEarliestEligible()` is a single query joining
`occurrences` to `reminders`, filtered to enabled/active reminders with a
pending or claimed occurrence, ordered by `scheduled_at ASC LIMIT 1`.
`SchedulerCoordinator` registers only that row's instant, on the one stable
`PendingIntent` request code `AlarmIds.DUE_ALARM_REQUEST_CODE`.
**Consequence:** Multiple reminders per media, and multiple reminders overall,
all funnel through this same single query — there is no per-reminder alarm
bookkeeping to keep in sync, and adding a reminder never risks exceeding any
OS-level concurrent-alarm budget.

## DL-009 — Reminder profile kept as "Persistent", not "Critical"

**Date:** 2026-08-06
**Context:** The user's reminder-engine request asked for profiles "Gentle,
Standard, Critical." The approved baseline (ADR-018) already names the third
built-in profile "Persistent."
**Decision:** Kept "Persistent" rather than renaming to "Critical."
ADR-021 forbids the app implying an emergency/guaranteed-delivery capability
it cannot back up (no medical/emergency claims), and "Critical" reads as
exactly that claim for a media reminder app.
**Consequence:** `ReminderProfileEntity.PERSISTENT_ID` and its `nameKey`
(`profile.persistent.name`) are unchanged from the pre-existing baseline;
the user's intent ("the most insistent tier") is fully satisfied by
Persistent's actual behavior (longest timeout, most retries, full-screen
when locked) — only the label differs from what was literally asked for.

## DL-010 — Full-screen alarm UI and Limited-mode consent UI are out of scope for this pass

**Date:** 2026-08-06
**Context:** MR-06 describes a locked/non-interactive `AlarmActivity` with a
full-screen intent, a bounded `AlarmRingingService` for sound/vibration, and
an explicit user choice between exact-alarm "Limited mode" and "Needs setup"
when exact access is unavailable. Building all three was not achievable
alongside the rest of the engine in this pass.
**Decision:** Every due alarm uses the notification presentation
unconditionally, regardless of lock state — MR-06 itself endorses this as the
safe fallback ("If state is uncertain, choose the unlocked notification
path"). `SchedulerCoordinator` never blocks on a consent UI: when exact
access is unavailable it always falls back to `setAndAllowWhileIdle()`
(labeled Limited in the capability snapshot) rather than leaving the
reminder unscheduled.
**Consequence:** AND-002 ("Play/Snooze/Dismiss work with RN disabled") is
still genuinely satisfied — those actions are wired end-to-end through
`AlarmActionReceiver`/`AlarmActionProcessor`, independent of any ringing/
full-screen UI. `AlarmActivity`, `AlarmRingingService` and `MediaPlayerActivity`
remain empty/undeclared; `USE_FULL_SCREEN_INTENT` and the `FOREGROUND_SERVICE*`
permissions are deliberately not in the manifest until those components exist
(MR-18: a permission arrives with its owning component).
**Superseded in part by DL-019**: the "Implement reminder presentation" pass
built `AlarmActivity`/`AlarmRingingService` for real (DL-017 through DL-024
below cover this phase's decisions). The Limited-mode explicit-consent UI
itself remains out of scope — that half of this entry still stands.

## DL-011 — Battery-optimization capability is report-only, never an exemption request

**Date:** 2026-08-06
**Context:** MR-06 states "No battery optimization exemption request is
part of onboarding," while also listing `battery_environment` as a
`CapabilityKind` to report.
**Decision:** `CapabilitySnapshotProvider` reads
`PowerManager.isIgnoringBatteryOptimizations()` purely to inform Health
(`ready`/`limited`/`unknown`), with `action` always `"none"` — there is no
`open_special_access` affordance for this capability, unlike `exact_alarm`.
**Consequence:** The unrestricted-battery state most users are in (not
whitelisted) reports as `limited`, not `blocked` — it is the expected,
non-actionable state given the app never asks to be exempted, not a problem
for the user to fix.

## DL-012 — `reminders.media_id` still has no foreign key or resolvable media kind

**Date:** 2026-08-06
**Context:** `media/` remains an empty placeholder package; the recurrence
engine needed to ship against the existing `reminders` schema regardless.
**Decision:** `ReminderEntity.mediaId` stays a bare column with no
`@ForeignKey` (a pre-existing, already-documented gap). The bridge's
`ReminderDtoWriter` hardcodes `mediaKind: "video"` and omits `thumbnailToken`
when assembling `ReminderSummary`/`ReminderDetail`, matching the JS demo
module's own `media?.kind ?? 'video'` fallback exactly.
**Consequence:** Real media-kind/thumbnail data will replace this hardcode
via a Room migration the moment the media import slice lands; no reminder
data depends on the placeholder value, so that migration cannot corrupt
anything already saved.

## DL-013 — Direct-boot recovery uses a label-free envelope in device-protected storage

**Date:** 2026-08-06
**Context:** ADR-017 requires a minimal, pre-unlock alarm envelope; Room's
database file lives in credential-protected storage, which is unreadable
before first unlock.
**Decision:** `DirectBootEnvelopeStore` mirrors only a due-instant epoch and
a generation counter — never a reminder id, occurrence id, or label — into
`Context.createDeviceProtectedStorageContext()`'s `SharedPreferences`, written
every time `SchedulerCoordinator` applies or clears the real `AlarmManager`
registration. `SystemEventReceiver` (`directBootAware="true"`) reads it on
`LOCKED_BOOT_COMPLETED`, arms a distinct pre-unlock alarm
(`AlarmIds.DIRECT_BOOT_REQUEST_CODE`) if the due instant is still future, or
posts a generic "Reminder due — unlock your device" notification immediately
if it already passed. `BOOT_COMPLETED` cancels that pre-unlock path and runs
a normal Room-backed `reconcile()`, which is what MR-06 means by "Room
reconciliation replaces the envelope."
**Consequence:** No reminder label, media title or media path is ever
readable before first unlock — the pre-unlock notification is intentionally
generic. `TIME_SET`/`TIMEZONE_CHANGED` are handled separately (DL-006 is the
resolution policy; `SchedulerCoordinator.reconcileAfterClockChange` deletes
and recomputes pending, non-`once` occurrences before re-registering).

## DL-014 — "Smart snooze" means per-reminder-configured, not adaptive/ML

**Date:** 2026-08-06
**Context:** The user asked for "smart snooze" without further
specification.
**Decision:** Snooze duration is the reminder's own configured default
(`ReminderEntity.snoozeDefaultMinutes`, editable per reminder), clamped to
that same reminder's configured min/max bounds — never one flat app-wide
constant. The in-app `snoozeDueSession(sessionId, minutes, nonce)` bridge
call may additionally request a custom duration, honored only when that
reminder's `snoozeAllowCustom` is true, still clamped to its bounds. A
notification-tap Snooze (no custom-duration UI exists there) always uses the
per-reminder default.
**Consequence:** "Smart" is implemented as "adapts to how this reminder was
configured," not as an adaptive/ML behavior — a deliberately narrow reading
chosen over inventing unrequested scope. `AlarmActionProcessor` is the single
place this logic lives, shared by the notification-tap and in-app paths.

## DL-015 — Alarm-action resolution logic is shared, not duplicated, between entry points

**Date:** 2026-08-06
**Context:** Play/Snooze/Dismiss can be triggered two ways: a notification
action tap (`AlarmActionReceiver`, no RN involved) and an in-app tap while
the RN bridge is alive (`MediaReminderModule`). AND-002 requires both to
behave identically.
**Decision:** All nonce validation, idempotency-record dedup, occurrence/
session state transition and snooze-occurrence insertion live in one object,
`AlarmActionProcessor`. Both entry points call it and only differ in how they
report the outcome (a log line vs. a resolved/rejected `Promise`).
**Consequence:** A future change to the action contract (e.g. a new
`ActionOutcome`) is made once, not twice, and cannot silently diverge between
the notification and in-app paths.

## DL-016 — Test reminder posts a plain notification with no Room session

**Date:** 2026-08-06
**Context:** MR-03's Test reminder exists to let the user verify
notifications actually appear. Giving it real Play/Snooze/Dismiss actions
would require a real `active_alarm_session` row, which requires a real,
FK-referenced `occurrences` row — but a test reminder deliberately writes no
occurrence history (MR-09/MR-03: it is explicitly outside "skip completed"/
retention semantics).
**Decision:** `scheduleTestReminder` schedules a bounded, independent
`AlarmManager` alarm (`AlarmIds.TEST_ALARM_REQUEST_CODE`, never competing
with the one real reminder alarm) that, on firing, posts a simple
auto-cancel notification with no action buttons. The `mode` parameter
(`locked`/`unlocked`) is accepted but currently has no effect, since the
locked/full-screen presentation path itself is out of scope (DL-010) — every
mode produces the same notification today.
**Consequence:** Test reminder still exercises the real scheduling and
notification-channel path end to end, which is what MR-06's "receiver
bridge" latency target and capability reporting actually depend on; it just
does not simulate the deferred full-screen presentation branch.

## DL-017 — `getEarliestEligible()` fixed to `pending`-only, enabling multiple simultaneous reminders

**Date:** 2026-08-06
**Context:** Implementing "multiple simultaneous reminders" surfaced a
latent bug: the query included occurrences in state `claimed` (already
fired, currently alerting) alongside `pending` (not yet fired). Since a
claimed occurrence's `scheduled_at` is necessarily in the past, it would
keep winning the `ORDER BY scheduled_at ASC` forever — starving a second
reminder that became due while the first was still being handled, because
`SchedulerCoordinator` would keep "registering" an alarm for something that
had already fired instead of the next genuinely-pending occurrence.
**Decision:** Restricted `OccurrenceDao.getEarliestEligible()` to
`state = 'pending'`. A `claimed` occurrence needs no new `AlarmManager`
registration — it already fired; it is tracked via `active_alarm_session`,
not via the outbox.
**Consequence:** A second reminder due while the first is still alerting now
gets its own independent alarm, its own dispatch, and its own session —
`AlarmRingingService`'s queue (DL-020) is what then serializes the actual
ringing/full-screen presentation so the two do not visually or audibly
collide.

## DL-018 — Presentation surface and "does this profile ring" are decided independently

**Date:** 2026-08-06
**Context:** MR-06's "Adaptive presentation decision" rules are framed
around lock state, but `AlarmRingingService` (sound/vibration) should not
stop just because the phone happens to be unlocked — a Standard/Persistent
reminder should ring whether the phone is locked or in the user's hand;
only *which UI surface* presents that ringing (full-screen activity vs. a
plain heads-up notification) should depend on lock state.
**Decision:** `DevicePresentationState.classify()` decides only the UI
surface (full-screen intent, Limited-FSI, or plain notification) from lock/
interactive state, FSI eligibility and whether the profile permits a locked
takeover at all. Whether to start `AlarmRingingService` is a separate,
simpler check in `AlarmDispatchReceiver` —
`profile.fullScreenWhenLocked` — independent of lock state entirely,
matching MR-06's "`CATEGORY_ALARM` for Standard/Persistent... `CATEGORY_REMINDER`
for Gentle."
**Consequence:** The classifier is pure and unit-tested
(`DevicePresentationStateTest.kt`) without needing to know anything about
audio/vibration; `AlarmRingingService` never has to reason about lock state
at all.

## DL-019 — `AlarmActivity` never dismisses the keyguard; it draws over it

**Date:** 2026-08-06
**Context:** MR-06: "It does not dismiss keyguard without explicit
platform-authorized user flow." The deprecated `WindowManager.LayoutParams`
API 26 fallback path includes a `FLAG_DISMISS_KEYGUARD` flag that would
silently unlock past a non-secure keyguard — easy to reach for since it sits
right next to `FLAG_SHOW_WHEN_LOCKED`/`FLAG_TURN_SCREEN_ON` in the same
constant group.
**Decision:** `AlarmActivity.applyWindowFlags()` uses
`Activity.setShowWhenLocked(true)`/`setTurnScreenOn(true)` on API 27+, and
only `FLAG_SHOW_WHEN_LOCKED`/`FLAG_TURN_SCREEN_ON` (never
`FLAG_DISMISS_KEYGUARD`) on API 26. The activity is reached either by the
system's own full-screen-intent delivery (`NotificationCoordinator.buildDueNotification`'s
`useFullScreenIntent`) or by `AlarmRingingService` re-invoking it in place
only when it is already the foreground activity
(`AlarmActivity.isForeground`) — never as a cold trigger while unlocked,
which would violate MR-06 rule 3 ("Never launch AlarmActivity directly").
**Consequence:** A secured lock screen (PIN/pattern/biometric) remains fully
in place under the alarm UI; Accept/Snooze/Dismiss work without ever
unlocking the device, and unlocking to do anything else still requires the
user's real credential afterward.

## DL-020 — One session rings at a time; additional due sessions queue

**Date:** 2026-08-06
**Context:** DL-017 makes it possible for a second reminder to be dispatched
— its own notification, its own `active_alarm_session` row — while the
first is still unresolved. Ringing both simultaneously (two overlapping
alarm tones, two full-screen activities fighting for the foreground) would
be exactly the aggressive interruption the presentation request explicitly
asked to avoid, for no spec-mandated reason.
**Decision:** `AlarmRingingService` is a process-wide singleton that rings
exactly one session at a time (`currentSessionId`) and queues any others
(`queue: ArrayDeque<String>`). A queued session still has its own real,
actionable notification (Play/Snooze/Dismiss work from the shade
immediately) — it is promoted, and `AlarmActivity` advances to it in place
if already foreground, only once the current session resolves or times out.
**Consequence:** "Multiple simultaneous reminders" is satisfied without
inventing overlapping audio/visual presentation the spec never asked for;
each session still gets full, correct, independent treatment, just
serialized through one ringing surface. `ActiveAlarmSessionDao.getAllAlerting()`
lets the service rebuild this queue after process death (recreated with a
null `Intent`, per MR-06's "recover its session after service recreation").

## DL-021 — Retry-as-future-alarm needs a schema column; added via a real migration

**Date:** 2026-08-06
**Context:** MR-06: "Persistent retry is implemented as future one-shot
alarms, not an endlessly running service." Capping retries at the profile's
`retryCount` (0-3) requires knowing how many retries already happened for a
given occurrence chain, and the v1 schema had nowhere to store that.
**Decision:** Added `occurrences.retry_number` (default 0) via
`MIGRATION_1_2`, a real Room `Migration` (`ALTER TABLE ... ADD COLUMN`), per
MR-09's "destructive migration is prohibited... every schema change adds a
real Migration" — the same rule DL-004's Room-schema entry already
committed to. `AlarmRingingService`'s timeout handler reads the resolving
occurrence's `retry_number`; if it is still below the profile's
`retryCount`, it inserts a new `kind = 'retry'` occurrence at
`now + graceSeconds` with `retry_number + 1` and marks the timed-out one
`timed_out`; otherwise it marks it `missed` — a final, non-retried outcome.
**Consequence:** Every pre-existing row defaults to `retry_number = 0`,
which is correct (no occurrence was ever mid-retry-chain before this
migration existed). The schema is now version 2 — a device that already ran
the v1 schema in this environment would need the migration path exercised
on a real Gradle build before being trusted (see the standing DL-004
caveat).

## DL-022 — DND/silent/headphones/Bluetooth handled entirely through `AudioAttributes.USAGE_ALARM`

**Date:** 2026-08-06
**Context:** The user asked for DND, silent-mode, headphone and Bluetooth
support. MR-06 "Audio behavior" is explicit: "The app respects silent/DND/
channel behavior as controlled by Android; it does not request DND policy
access in v1... Bluetooth/headphone routing follows system alarm routing.
The app does not secretly force speaker output."
**Decision:** `AlarmRingingService` plays its tone with
`AudioAttributes.USAGE_ALARM`/`CONTENT_TYPE_SONIFICATION` on `MediaPlayer`
and requests audio focus with the same attributes — never a raw
`STREAM_ALARM` int, never a manual output-device override. This is a
deliberate no-op on DND/silent-mode/routing: Android's own alarm-volume
stream and Zen-mode alarm carve-out govern audibility, and whatever output
route (speaker, wired, Bluetooth A2DP/SCO) is currently active is what plays
the tone. `ACCESS_NOTIFICATION_POLICY` is not requested, matching the
existing "Explicitly excluded" manifest list. A detected call
(`AudioManager.getMode()` — no phone-state permission needed) skips the
tone entirely and only vibrates, per MR-06's "reduce to notification sound/
vibration rather than overpower a call."
**Consequence:** "Support DND/silent/headphones/Bluetooth" is implemented as
*not fighting* Android's own handling of each, which is what the spec
actually asks for — not a custom DND-detection or forced-speaker workaround.
The known, accepted trade-off (shared with every alarm app built this way):
if only Bluetooth headphones are connected and out of range/off, the alarm
plays through them or not at all — never forced to the speaker instead,
matching "does not secretly force speaker output" over "guarantees
audibility" (ADR-021 already forbids the latter kind of claim).

## DL-023 — The shade notification and the foreground-service notification share one builder

**Date:** 2026-08-06
**Context:** `AlarmRingingService` must call `startForeground()` with a
notification within the platform's post-`startForegroundService()` deadline.
`AlarmDispatchReceiver` already posts a real notification for the session
before ever starting the service.
**Decision:** `NotificationCoordinator.buildDueNotification()` builds
(without posting) the `Notification`; `postDueNotification()` and
`AlarmRingingService.promote()` both call it, the latter passing the result
straight to `ServiceCompat.startForeground()`. There is exactly one place
the due-notification's content/actions/full-screen-intent are assembled.
**Consequence:** The shade notification and the "foreground service is
alive" notification can never silently drift into different content — a
future field added to one is added to both by construction, and
`AlarmRingingService`'s promotion of a queued session (DL-020) simply
re-posts the same builder's output with `ongoing = true`.

## DL-024 — The in-app heads-up card uses React Native's core `Animated`, not a new native dependency

**Date:** 2026-08-06
**Context:** The presentation request asked for "beautiful animations" and
"Material motion" for the screen-on card. No animation library
(`react-native-reanimated`, etc.) exists in this project yet, and this
environment cannot compile/verify a new native module (DL-004).
**Decision:** `InAppDueCard` animates with `react-native`'s built-in
`Animated` API (`useNativeDriver: true`), using the `stripEnter` motion
token already defined in `design-system/tokens/motion.ts` (220 ms enter,
`emphasizedDecelerate`-equivalent easing, a 100 ms cross-fade in reduced-
motion mode rather than an instant pop — `stripEnter.reduced` is `'fade'`,
not `'instant'`) and the pre-existing `inAppStripMaxHeight()` helper
(`min(144dp, 20% of viewport)`) for sizing. The MR-04 cubic-bezier control
points are mapped to `Easing.bezier()` locally in the component, not added
to the token file, keeping that module free of a React Native dependency.
**Consequence:** No new native dependency was introduced for this feature —
lower risk given DL-004's constraint — while still landing real,
native-driver animation and honoring the app's existing motion tokens
exactly rather than inventing new timing values.

## DL-025 — Backup export is portable JSON, never a raw SQLite/DataStore file copy

**Date:** 2026-08-06
**Context:** The user's request listed "SQLite" and "Settings" as things to
export. MR-10's "Archive layout" is explicit and detailed about the
opposite: `data/*.json` logical records, with "Excluded: Room database/WAL/
SHM files; DataStore binary files" stated outright.
**Decision:** Followed MR-10 literally rather than the user's shorthand —
`BackupExporter` serializes reminders/profiles/schedule-rules/settings to
JSON (`BackupRecords.kt`, `BackupScheduleRuleCodec.kt`), never copies
`media_reminder.db` or the Preferences DataStore file. This is the same
kind of reconciliation DL-009 already made for "Critical" → "Persistent":
the user's plain-language request names an outcome ("get my reminders and
settings out"), and the approved baseline spec's answer for *how* is more
specific and, on inspection, correct — a raw Room file copy would tie every
future backup to Room's exact internal table layout, which is precisely
what "independent of internal Room layout" (MR-10 "Goals") exists to avoid,
and is also the direct mechanism behind "future versions should still read
today's backups."
**Consequence:** A future Room migration that renames or restructures a
column never breaks reading an old backup — only the JSON codec (already
decoupled by design) needs updating, not the archive format itself.

## DL-026 — Media/category/tag export sections are real, structurally, but always empty

**Date:** 2026-08-06
**Context:** Continues DL-012's gap: no `media_assets`/`categories`/`tags`
Room tables exist (`media/` is still an empty package), so there is
nothing real to export into `data/media-assets.json`, `data/categories.json`,
`data/tags.json`, `data/reminder-tags.json`, or `media/`.
**Decision:** Every export still writes all four JSON entries (as empty
arrays) and the `media/` prefix stays a valid, if empty, part of the
archive layout — `BackupFormat.REQUIRED_DATA_ENTRIES` requires them, and
`BackupSemanticValidator` checksum-verifies them like any other entry, on
both the write and read side. Nothing is skipped or special-cased away.
**Consequence:** A backup taken today, on a device with a real media
library from a future release, is not a foreign/legacy shape the importer
needs a version bump to understand — the four entries just stop being
empty. `BackupConflictPlanner`'s media/category/tag rules from MR-10
"Merge" are written into the planner's design (see its module doc) but are
dormant no-ops until there is real data to plan around.

## DL-027 — Export writes to app-private storage; the SAF destination/source pickers are a follow-up

**Date:** 2026-08-06
**Context:** MR-10's export algorithm calls for the user choosing a
destination via `ACTION_CREATE_DOCUMENT`, and import via
`ACTION_OPEN_DOCUMENT`. Wiring either is an `ActivityResultLauncher` +
RN-bridge-callback layer orthogonal to the archive format/validation/commit
engine itself, and substantial enough (a real UI flow, not a detail) to
warrant its own scoped pass rather than being folded into "the backup
engine."
**Decision:** `BackupExporter` writes the finished, verified archive to
`getExternalFilesDir(null)/backups/` (app-scoped, no permission needed) and
`MediaReminderFileProvider`/`res/xml/file_paths.xml` exist so a future
"Share" action can grant read-only access to exactly that folder without
ever exposing a raw path. `BackupImporter.stage()` accepts any
`content://`/`file://` URI string via `ContentResolver.openInputStream()`
— it does not care how that URI arrived, so wiring a real picker later is
purely additive on the JS/Activity side, no engine change required.
**Consequence:** `BackupScreen`'s export flow is fully real end-to-end
today (docs/decision-log.md DL-029's "no-picker-needed" note). `ImportScreen`
still runs its simulated `mockBackupInspection` flow (see that screen's
updated module doc) because there is no real archive URI for it to pass to
`inspectBackup` yet — the one missing piece is the picker, not the import
engine, which is fully implemented and ready to receive one.

## DL-028 — Crash recovery rolls forward past `DB_COMMITTED`, never backward

**Date:** 2026-08-06
**Context:** MR-11 "Crash during replace": "Startup sees operation journal,
prevents normal mutation and completes rollback/forward recovery."
**Decision:** `BackupImporter.commit()` performs its entire Merge/Replace
mutation inside one `database.withTransaction { }` block, including marking
the `operation_journal` row's phase through `DB_PREPARED`/`DB_COMMITTED`
*inside* that same transaction. SQLite's own transaction atomicity means a
crash mid-transaction leaves neither the reminder data nor the phase marker
persisted — on restart, `recoverUnfinishedOnStartup()` always finds either
a phase from *before* the transaction (safe to mark `cancelled`, nothing to
undo) or `DB_COMMITTED`-or-later (the mutation is durably applied; the only
work left is finishing scheduling/verification, i.e. rolling *forward*).
There is no code path that needs to reconstruct a partial mutation, because
SQLite already guarantees one can never exist.
**Consequence:** No separate rollback-snapshot-restore code was needed for
the "crash mid-commit" case specifically — only Replace's *pre-transaction*
rollback readiness (recomputing from the archive is always possible; there
is no local-data snapshot restore path implemented beyond what the
transaction's own all-or-nothing semantics already provide). If a future
change makes the commit step span more than one transaction (e.g. real
media file promotion, which must happen outside a DB transaction), this
reasoning must be revisited.

## DL-029 — `beginExport`/`commitImport` resolve with their final result, not an `OperationRef`

**Date:** 2026-08-06
**Context:** MR-08 declares `beginExport(): Promise<OperationRef>` and a
generic `OperationProgressEvent` stream, implying a fire-and-forget pattern
where the JS side gets an id back immediately and learns the outcome later
(needed when a huge media copy could run for minutes). Today's export/import
has no media to stream — every operation completes in well under a second.
**Decision:** `beginExport` and `commitImport` were declared for the first
time in this pass (they were `unknown`-typed placeholders before); their
JS types now resolve directly with `ExportResult`/`MutationResult` once the
whole operation finishes, while still emitting `operationProgress` events
throughout for the progress bar UI. `inspectBackup` already fit this shape
naturally (`BackupInspection` *is* the result).
**Consequence:** Simpler JS call sites (`await beginExport()` instead of a
ref-then-poll-or-listen dance) for what is, today, always a fast, bounded
operation. Revisit this contract choice — likely back toward the more
general `OperationRef` + completion-event pattern MR-08 originally
described — once real media export/import can run long enough that
blocking one `Promise` on it for potentially minutes is the wrong shape.

## DL-030 — Built-in profile records in an archive are always skipped on import

**Date:** 2026-08-06
**Context:** MR-10 "Merge": "built-in profile UUID: map to local built-in;
archive customizations import as a new custom profile unless user
explicitly applies them." ADR-018's built-in profiles (Gentle/Standard/
Persistent) use stable UUIDs, so an archive's built-in rows always collide
by id with the local, already-seeded rows.
**Decision:** `BackupConflictPlanner` puts every built-in-UUID profile
record straight into `skippedBuiltInProfileIds` — it is never inserted,
updated, or offered as a conflict to resolve, regardless of whether its
field values differ from the local built-in. There is no "explicitly apply
archive customizations to a built-in profile" UI, so per the spec's own
"unless user explicitly applies them," the archive's version is simply
never applied.
**Consequence:** A device's built-in-profile customizations (if a future
release lets a user edit Gentle/Standard/Persistent's timeout, etc.) are
never silently overwritten by importing someone else's backup, or one taken
from this same device earlier with different values.

## DL-031 — Known gap: ZIP symlink-entry detection is not implemented

**Date:** 2026-08-06
**Context:** MR-10 structural validation calls for rejecting "symlink-like
entries." `java.util.zip.ZipEntry`'s public API does not expose the Unix
external-attributes field a symlink is encoded in — only Apache Commons
Compress does, which is not a dependency of this project.
**Decision:** Did not add Apache Commons Compress for this one check,
consistent with DL-004's standing caution against adding a dependency that
cannot be compiled/verified in this environment for a single edge case.
Every other structural defense MR-10 asks for (path traversal, absolute
paths/drive prefixes, duplicate/case-fold names, entry-count cap, per-entry
and total size caps enforced against both the declared and the *actual*
decompressed byte count, compression-ratio bomb threshold, unsupported
compression methods, required manifest/checksum entries) is fully
implemented in `BackupZipStructuralValidator`.
**Consequence:** A maliciously crafted archive containing a symlink entry
is not specifically detected as such by name/attribute inspection — but
`ZipEntry.isDirectory`/regular-file handling and the size/traversal checks
already reject anything that is not a plain, safely-named, boundedly-sized
file, which closes most of the practical risk. Revisit if Apache Commons
Compress (or an equivalent already-verified-compiling dependency) becomes
available.

## DL-032 — Performance-engineering pass: scope and method

**Date:** 2026-08-06
**Context:** User request: "Pause feature development. Now become a
Performance Engineer... Refactor everything," across twelve named categories
(memory leaks, large renders, expensive re-renders, unnecessary state, slow
SQL, duplicate code, unused assets, bundle size, battery usage, background
work, animation performance, accessibility), with concrete targets (cold
launch under 2s, near-zero idle battery, 60 FPS, minimal memory footprint).
Routed to `routr-refactor`, not `routr-mobile` — the trigger word was
"refactor," and the guidance's own anti-pattern list ("big-bang rewrite,"
"behavior + feature mix") shaped every fix below.
**Decision:** Ran parallel read-only audit agents across the JS/RN tree and
the Kotlin/Android tree, then applied only fixes that are pure structural/
performance/correctness improvements with no behavior change visible to a
user under normal operation — DL-033 through DL-039 record the ones with a
genuine judgment call. Every audit finding was independently re-verified by
reading the actual code before acting on it (the same discipline DL-017-style
fixes have always used in this log) rather than trusting the audit agent's
classification outright — this is what caught two findings that were
mis-classified as "dead code" (DL-035) and one gap the audit did not surface
at all (`activeReminderCount` hardcoded to 0, DL-034).
**Consequence:** No Android SDK/Gradle exists in this environment (DL-004) —
every Kotlin change below is written and reasoned through carefully but not
compiled. Some flagged items were deliberately *not* fixed in this pass: a
full split of `src/mocks/fixtures.ts` into a production-placeholder file and
a dev-only dataset (would fully remove demo fixtures from the release
bundle, but is a larger, riskier multi-file refactor than this pass's
per-finding fixes); `SystemEventReceiver`'s boot/clock-change handlers were
left out of the wake-lock-helper extraction in DL-039 because their shape
genuinely differs from the other two receivers.

## DL-033 — `TodayScreen` switched from a `.map()`-in-`ScrollView` list to a virtualized list

**Date:** 2026-08-06
**Context:** MR-09 anticipates up to 10,000 reminders / 50,000 occurrences.
`TodayScreen.tsx` rendered `mockTodayOccurrences.map(...)` inside a
`Screen scrollable` — every row mounts and renders regardless of what is
actually visible, the RN anti-pattern this codebase's own design docs warn
against elsewhere.
**Decision:** Restructured to a `VirtualizedList` (the design-system's
`FlatList` wrapper) with a `ListHeaderComponent` carrying everything that
used to render above the list (title/status row, capability banner,
next-reminder card or empty state), so there is still exactly one scroll
surface — never a `VirtualizedList` nested inside a `ScrollView`. Row
rendering moved into a `useCallback`-memoized `renderOccurrence`, declared
before any early return to satisfy the Rules of Hooks.
**Consequence:** Off-screen occurrence rows no longer mount; the list scales
to real device data volumes instead of only ever having been exercised
against the small mock fixture set.

## DL-034 — `getStartupSnapshot()` no longer hardcodes `activeReminderCount`/`nextOccurrence`

**Date:** 2026-08-06
**Context:** Found while reading `MediaReminderModule.kt` during this pass,
not flagged by the audit agents. `getStartupSnapshot()` still had
`putInt("activeReminderCount", 0)` and `putNull("nextOccurrence")` behind a
comment claiming "both counts stay 0 until Room exists in a later slice" —
stale from this module's original foundation slice, long before the
reminder engine (DL-005 onward) made Room real. `TodayScreen.tsx`'s
`hasReminders = snapshot.activeReminderCount > 0` gate meant the "next
reminder" card could never render on a real device, regardless of how many
reminders existed.
**Decision:** Wired both fields to real Room reads —
`reminderDao().countEnabled()` (itself unused until now, a method that
existed but was never called — the same "designed but never wired" shape as
this entry) and `occurrenceDao().getEarliestEligible()` via
`ReminderDtoWriter.writeOccurrence`. `mediaCount` stays hardcoded 0 — that
one is still correct, no media table exists (DL-012).
**Consequence:** This is a genuine, previously-invisible correctness bug
fix, not a refactor — flagged as clearly in-scope because the performance
audit's "unnecessary state"/"slow SQL" framing led directly to reading this
method, and leaving a known-wrong value in place after finding it would be
worse than the small risk of a behavior change in an already-broken path.

## DL-035 — `ActiveAlarmSessionDao.getAlerting()` deleted; `SchedulerStateDao.markError()` wired up instead of deleted

**Date:** 2026-08-06
**Context:** The audit flagged both as unused ("dead code"). Re-verified
each independently before acting, per this log's standing discipline
(DL-017, and DL-034 above).
**Decision:** `getAlerting()` (single-row `LIMIT 1` variant) is fully
superseded by `getAllAlerting()` (used by `AlarmRingingService`'s recovery
path, doc-commented, `.firstOrNull()` covers any single-row use case) —
deleted as genuinely redundant. `markError()` was different: the
`scheduler_state.last_error_code` column and this DAO method exist
specifically for the outbox pattern's failure path (MR-06), but
`SchedulerCoordinator.applyToAlarmManager()` had no `try/catch` around the
`AlarmManager.setAlarmClock`/`setAndAllowWhileIdle` calls at all — a
`SecurityException` from the exact-alarm permission being revoked between
the `ExactAlarmAccess.isAvailable()` check and the call itself (a real,
documented Android race) would propagate uncaught and leave no error trail.
Wrapped the calls in `try/catch (SecurityException)`, call `markError()`,
log, and rethrow (preserving existing caller behavior for anything that
already handles the exception) instead of deleting the method.
**Consequence:** Same judgment call as DL-034 (`countEnabled()`): a
method flagged "dead" that turns out to be the missing half of a designed
failure path is a bug to fix, not code to remove.

## DL-036 — N+1 query fixes: `SchedulerCoordinator.ensurePendingOccurrencesExist` and `ReminderMutationService.list`

**Date:** 2026-08-06
**Context:** Both methods looped over every reminder issuing one or two
DAO queries per iteration (`getPendingForReminder`/`getByReminderId` in a
loop) instead of one batched query per collection — up to 2N+1 queries per
call for N reminders, on `ensurePendingOccurrencesExist` specifically on
every single scheduler reconcile pass (i.e. after every save/enable/
disable/delete/dispatch/timeout).
**Decision:** Added batched DAO methods (`ReminderDao.getActive()`,
`ScheduleRuleDao.getByReminderIds()`,
`OccurrenceDao.getReminderIdsWithPendingOccurrence()`/`getPendingForReminders()`)
and rewrote both call sites to fetch once, then join in Kotlin via
`associateBy`/`toSet()`. `getReminderIdsWithPendingOccurrence()` relies on
the existing invariant that a reminder never has more than one
`pending`/`claimed` occurrence at a time (the same invariant
`ensurePendingOccurrencesExist`'s own single-row check already assumed).
**Consequence:** Reconcile passes and the reminder list endpoint now scale
with two/three queries total instead of with N — most consequential on
`ensurePendingOccurrencesExist` given how often reconcile runs relative to
`list()`.

## DL-037 — Opportunistic retention sweeps wired up at module init

**Date:** 2026-08-06
**Context:** `IdempotencyDao.deleteExpired()`, `OccurrenceDao.deleteResolvedBefore()`,
and `OperationJournalDao.deleteFinishedBefore()` all existed, doc-commented
as "MR-09 Data retention... swept opportunistically, not on a background
schedule (ADR-007: no polling)," but none had a caller anywhere — the tables
would grow unbounded forever.
**Decision:** Called all three from `MediaReminderModule`'s existing
`init` block, in their own `runCatching` (separate from the adjacent backup
crash-recovery block, so one failing never blocks the other) — this is
already the module's "on startup" hook, matching `OperationJournalEntity`'s
own doc comment ("swept at startup/on next write"). Retention windows:
occurrences 90 days (MR-09, already the constant `deleteResolvedBefore`'s
caller-supplied cutoff was designed around); idempotency records use their
own per-record `expires_at` already set at creation time per MR-09's
per-scope windows (alarm_action 7d / ui_mutation 24h / backup_commit 30d),
so `deleteExpired(now)` needs no extra window logic; operation_journal rows
use 7 days, matched to the shortest idempotency scope rather than the
longer backup_commit window since a finished journal row's only purpose is
querying a just-finished operation's result ("retained briefly," per its
own entity doc comment).
**Consequence:** These three tables are now actually bounded, closing a
real unbounded-growth gap. `SystemEventReceiver`'s boot handler was
considered as the sweep site instead but rejected — app-process startup
(this module's `init`) is more frequent and a better match for "swept
opportunistically," and boot-only would leave the tables growing on
installs that are rarely rebooted but frequently reopened.

## DL-038 — `MediaPlayer.prepare()` replaced with `prepareAsync()` in `AlarmRingingService`

**Date:** 2026-08-06
**Context:** `playTone()` runs on `serviceScope`, which is
`Dispatchers.Main`. The synchronous `prepare()` call blocks that thread for
however long decoding the tone's header takes — a real main-thread-jank/ANR
risk on the exact path (alarm ringing) where responsiveness matters most.
**Decision:** Switched to `prepareAsync()` with `setOnPreparedListener`
calling `start()` and `setOnErrorListener` replacing the previous
try/catch's failure handling. Guarded `setOnPreparedListener` with
`if (mediaPlayer === player)` — `prepareAsync()` makes preparation genuinely
asynchronous, so `stopTone()` (or a second `playTone()` call) can now race
ahead and release/replace the player before the prepared callback fires;
without the guard, calling `start()` on an already-released `MediaPlayer`
throws `IllegalStateException` from inside the OS callback.
**Consequence:** The main thread is never blocked waiting on tone
preparation. The identity guard is the one behavior addition this
introduced beyond the mechanical async conversion — necessary because the
async conversion itself opens a race that did not exist with the blocking
call.

## DL-039 — Shared wake-lock/`goAsync()`/coroutine helper for `AlarmDispatchReceiver` and `AlarmActionReceiver`

**Date:** 2026-08-06
**Context:** Both receivers duplicated the exact same shape: acquire a
10-second partial wake lock, call `goAsync()`, launch a
`SupervisorJob() + Dispatchers.IO` coroutine, `try` the real work,
`catch (Throwable)` into a fail-safe reconcile, `finally` release the wake
lock and finish the pending result. `SystemEventReceiver` was considered for
the same extraction but excluded — it has no wake lock at all (its
BOOT_COMPLETED/TIME_SET triggers are already wake-guaranteed by the
platform) and a differently-shaped clock-change fallback, so it would have
been a forced fit rather than genuine deduplication.
**Decision:** Extracted `BroadcastReceiver.dispatchWithWakeLock(context,
wakeLockTag, wakeLockTimeoutMs, onFailure, block)` into a new
`alarm/BroadcastDispatch.kt`; both receivers now pass their existing
tag/timeout/fail-safe-reconcile logic through it unchanged. In
`AlarmDispatchReceiver.promote()` (a related, lower-confidence finding from
the same audit) also added a `currentSessionId != sessionId` re-check
immediately before `ServiceCompat.startForeground()`, since the
suspend-point gap between the session/reminder/profile Room reads and the
`startForeground()` call is exactly where a racing `stopSession()`/
`stopIfNothingRinging()` call (already synchronous on the same
`Dispatchers.Main` scope) could have already torn the service down via
`stopSelf()` — calling `startForeground()` after that is the documented
Android foreground-service resurrection/crash hazard this finding named.
**Consequence:** Two files' worth of duplicated lifecycle boilerplate
collapsed to one; the foreground-service race gets a bounded, low-risk
guard rather than a larger restructure of the promotion flow.

## DL-040 — Shared malformed-record wrapping across backup JSON codecs

**Date:** 2026-08-06
**Context:** `BackupReminderProfileCodec.fromJson`, `BackupReminderCodec.fromJson`,
and `BackupScheduleRuleCodec.fromJson` each repeated the identical
`try { ... } catch (e: BackupFormatException) { throw e } catch (e: Exception) { throw BackupFormatException(code, message) }`
shape.
**Decision:** Extracted `decodeBackupRecord(code, message, block)` (an
inline function in `BackupRecords.kt`, same package, no import needed) and
rewrote all three call sites to use it.
**Consequence:** Adding a fourth backup record codec (a future media-import
slice, per DL-026) now reuses this helper instead of a fourth copy of the
same try/catch.

## DL-041 — `compileSdk` dropped from 37 to 36 after the first real Gradle build

**Date:** 2026-08-07
**Context:** `android/build.gradle`'s ADR-019 baseline pinned `compileSdkVersion = 37`,
carrying the file's own caution to "confirm... before the first build, not
assume." This environment's first-ever `./gradlew assembleDebug` (DL-004 had
never been possible before now) failed: `sdkmanager` could install a package
named `platforms;android-37.0`, but its `source.properties` was internally
inconsistent (`Pkg.Desc: "Android SDK Platform 17"`, `Platform.Version=17`,
`AndroidVersion.ApiLevel=37.0`) and AGP could not resolve the target hash
`android-37` it needs. Android 16 (API 36) is the actual latest normal stable
release as of this date.
**Decision:** Changed `compileSdkVersion`/the platform baseline to 36 in
`android/build.gradle`. `targetSdkVersion` was already 36, so this also
removes the (until-now unexercised) gap between `compileSdk` and `targetSdk`.
**Consequence:** The build gets past SDK resolution. Revisit only once a real
API 37 stable platform is confirmed installable in a real environment — do
not re-bump from a spec baseline assumption alone, per this same file's own
standing warning.

## DL-042 — Codegen actually run for the first time; DL-004's "mechanical follow-up" assumption was wrong

**Date:** 2026-08-07
**Context:** DL-004 assumed switching from the hand-registered `TurboModule`
to generated Codegen output would be "a mechanical follow-up... the method
names, argument shapes and promise/reject semantics were written to match
what Codegen would produce" — untested, because no environment before now
could run `generateCodegenSchemaFromJavaScript`. Running it for the first
time (after DL-041) surfaced three real defects in
`src/native-client/NativeMediaReminder.ts`, two mechanical and one not:
1. Codegen requires the `TurboModule`-extending interface to be named
   exactly `Spec` — it was `MediaReminderSpec`.
2. Codegen requires `TurboModuleRegistry.get<Spec>()`'s call to use the
   literal type `Spec` (not a type alias) and a string-literal argument (not
   an identifier), even a same-file top-level `const`.
3. **Not mechanical:** past those two, codegen failed a third time with
   `UnsupportedGenericParserError` on `PreferencePatch` (`= Partial<PreferencesSnapshot>`).
   Codegen's TypeScript parser only understands plain object-literal
   interfaces, primitives, arrays and string-literal unions — it cannot
   resolve `Partial<>`, generics (`Page<T>`), or the branded/intersection
   types (`UUID = Brand<string, 'UUID'>`) used throughout
   `src/native-client/types.ts`'s Spec-referenced types. This is not a
   syntax slip; the bridge's entire data-contract layer, as authored, is not
   codegen-shaped.
**Decision:** Fixed (1) and (2) directly — low-risk, mechanical, no
behavioral change (`MediaReminderSpec` kept as a type alias so no consumer
file needed touching). Did **not** attempt (3): making the Spec interface
codegen-compatible means introducing flat "wire DTO" types alongside the
richer domain types `types.ts` already exports and are used throughout
`src/`, which is a real redesign of MR-08's data-contract layer, not a
build fix — raised to the user rather than done unilaterally, per AGENTS.md's
"architectural dependency... usually an ADR" rule. User direction: stop and
document rather than attempt the redesign in this pass.
**Consequence:** `android/app/src/main/java/.../bridge/MediaReminderModule.kt`
still implements `TurboModule` by hand and is *not* verified to match what
real Codegen output would require — DL-004's original caveat stands, now
with a concrete reason it might not be "mechanical" when someone does
attempt it. See `docs/KNOWN_ISSUES.md` for the actionable writeup. This also
means `./gradlew assembleDebug` still does not produce a working APK — and,
confirmed separately, neither does `./gradlew testDebugUnitTest`:
`generateCodegenSchemaFromJavaScript` is wired into `:app:preBuild`, so it
blocks every `:app` Gradle task, not just `assembleDebug`. No Kotlin file in
this repo, old or new, has ever actually been compiled by Gradle.

## DL-043 — Release version/signing tooling reads properties files, not hardcoded/env-only

**Date:** 2026-08-07
**Context:** MR-20 requires monotonic `versionCode` stamping and env-var-driven
signing that never touches source-controlled files (MR-18). `scripts/` was an
empty stub; `android/app/build.gradle` hardcoded `versionCode 1`/`versionName
"0.1.0"` despite its own comment claiming otherwise (`docs/KNOWN_ISSUES.md`),
and had no signing config at all (`assembleRelease` produced an unsigned APK
with no way to change that short of hand-editing the build file).
**Decision:** Added `scripts/release/stamp-version.js` (validates semver
strictly-increasing, `versionCode` strictly increasing, writes
`android/version.properties`) and `scripts/release/checksums.js`
(`sha256sum`-compatible `SHA256SUMS.txt` for a release directory) — both
plain Node, no Gradle/Android dependency, and both directly tested (bad
input rejected, good input verified byte-for-byte against the real
`sha256sum` binary) before being considered done. `android/app/build.gradle`
now reads `versionCode`/`versionName` from `version.properties` (committed,
starts at `1`/`0.1.0`) and a signing config from `RELEASE_STORE_FILE`+3 env
vars first, `android/keystore.properties` (gitignored,
`.example` template committed) second, matching the `local.properties`
pattern this repo already used for the SDK path.
**Consequence:** No behavior change for anyone who sets neither — `assembleDebug`
is untouched and `assembleRelease` still produces an unsigned APK exactly as
before. The full MR-20 build pipeline (SBOM, third-party notices, mapping
files, reference-device signature verification) is still unscripted — see
`docs/APK_RELEASE_CHECKLIST.md`. None of this tooling could be exercised
through an actual `assembleRelease` run — that task is blocked by the
Codegen contract issue (DL-042) — so it is verified in isolation (direct
Node execution) but not yet proven correct end-to-end inside a real Gradle
invocation.

## DL-044 — AGP dropped from 8.12.0 to 8.10.0 for Android Studio IDE compatibility

**Date:** 2026-08-07
**Context:** `./gradlew` (command-line Gradle, its own bundled distribution)
had no trouble with AGP 8.12.0 — DL-041/DL-042 were both found through it.
Opening this project's `android/` folder in an actual Android Studio
install surfaced a different problem command-line Gradle can't see: that
Android Studio's own bundled AGP-compatibility table only supports up to
AGP 8.10.0, so Gradle sync failed before populating a single module (Run
Configuration's Module dropdown showed only `<no module>`, and the
IDE reported it directly: "The project is using an incompatible version...
Latest supported version is AGP 8.10.0").
**Decision:** Downgraded `android/build.gradle`'s AGP classpath pin from
8.12.0 to 8.10.0. Confirmed with `./gradlew help` (project configuration
only, no compile/codegen) that the downgrade itself introduces no new
failure — build succeeds at that phase, same as it did at 8.12.0.
`compileSdk 36` (DL-041) is well within AGP 8.10.0's supported range.
**Consequence:** This is a distinct, IDE-only compatibility constraint from
the Codegen contract problem (DL-042) — fixing this unblocks Gradle *sync*
inside Android Studio, but a synced project still cannot build or run until
DL-042 is resolved. Revisit this pin if/when the installed Android Studio is
upgraded to a version whose AGP-compatibility table covers a newer AGP.

## DL-045 — TurboModule bridge contract redesigned to be Codegen-compatible; `assembleDebug` succeeds for the first time

**Date:** 2026-08-07
**Context:** DL-042 found the bridge's TypeScript contract genuinely
incompatible with Codegen (`Partial<>`, generics, branded/intersection
types) and stopped short of fixing it, since a real redesign was out of
scope for a build-verification pass. With explicit user direction to
proceed, attempted it. Two more empirical findings shaped the actual
design, neither obvious in advance:
1. Codegen's TypeScript parser **does not support type imports from other
   files** for a `Spec` module. A type imported from a sibling file and
   used as a method *return* type is silently swallowed — the generated
   schema gets `VoidTypeAnnotation` instead of the real shape, no error at
   all — while the same import used as a *parameter* type throws
   `UnsupportedGenericParserError` outright. Confirmed by direct,
   repeated probing against `@react-native/codegen`'s real parser
   (`node node_modules/@react-native/codegen/lib/cli/combine/combine-js-to-schema-cli.js`
   — far faster than a full Gradle invocation per iteration). This ruled
   out an initial `wireTypes.ts` file split; every DTO `Spec` references
   has to be declared in `NativeMediaReminder.ts` itself.
2. `Object` (bare, capital-O) is Codegen's generic-passthrough escape
   hatch — also confirmed by direct probing, alongside string-literal
   unions, nullable (`| null`), optional fields, arrays and nested objects
   all working correctly when declared locally.
**Decision:** `NativeMediaReminder.ts` now declares ~30 `*Wire` interfaces
inline (branded types -> plain `string`, `Page<T>` -> per-entity page
types, `ScheduleRuleDto`'s 6-variant union -> one flattened
`ScheduleRuleWire` with every variant field optional, `Partial<>` ->
spelled out explicitly, `unknown` -> `Object`) alongside `Spec` itself.
New `mapping.ts` provides `decodeWire<T>()` (a documented, safe
type-level cast — wire and domain types are runtime-identical, JSON in/out;
only TypeScript's structural checks differ) and `decodeScheduleRule()`
(the one case needing real narrowing logic, since a flat object can't be
discriminated back into a union by a cast alone). `MediaReminderClient.ts`
decodes every native call's result through this boundary; the domain->wire
direction needed no helper at all, since a domain value's branded/narrow
fields already upcast for free into the wider wire shape. `mockNativeModule.ts`
required zero changes (its object literals already upcast correctly);
`demoNativeModule.ts` needed `decodeWire`/`as UUID` at the handful of spots
where it reads a wire-typed incoming id/request field back into its own
domain-typed internal `Map`.
**Consequence:** `npm run verify` (typecheck/lint/test) stayed fully green
throughout — this was a type-boundary change with zero runtime behavior
change, verified the same way DL-034-style fixes in this log always have
been: by reading the actual diff, not trusting a green build alone. Codegen
schema generation now succeeds for all 27 `Spec` methods (spot-checked
every method's resolved type against the raw schema JSON to rule out the
same silent-`void` failure mode this fix exists to prevent). This, chained
with DL-046/DL-047 below, is what took `./gradlew assembleDebug` from
"has never once succeeded in this project's history" to producing a real,
installable `app-debug.apk`.

## DL-046 — Five real Kotlin bugs found by the first-ever successful compile

**Date:** 2026-08-07
**Context:** Once DL-045 got `generateCodegenSchemaFromJavaScript` passing,
`:app:compileDebugKotlin` ran for the first time in this project's history
(every prior Kotlin change in this log, DL-004 onward, was "written
carefully, reasoned through, not compiled"). It surfaced five real,
previously invisible bugs, none related to the bridge redesign:
1. **`BackupRecords.kt`'s doc comment broke Kotlin's own comment parser.**
   Line 11 read `` `data/*.json` `` as plain documentation text — but
   Kotlin, unlike Java/C, nests block comments, so the literal `/*`
   inside that KDoc block opened an unintended *nested* comment. Every
   symbol the file defines (`BackupReminderProfileCodec`,
   `BackupReminderCodec`, `BackupSettingsCodec`, `decodeBackupRecord`)
   became `Unresolved reference` everywhere they're used, and the parser
   only reported the eventual imbalance as "Syntax error: Unclosed
   comment" at EOF (line 143) — nowhere near the actual cause (line 11).
   Fixed by rephrasing the comment to avoid a literal `/*` sequence.
2. **`AlarmActionReceiver.kt`**: `intent.action` (`String?`) was checked
   with `action !in setOf(...)`, which Kotlin's smart-cast does not
   recognize as a null-narrowing pattern the way an explicit
   `action == null` check is. `handle(...)`'s `action: String` parameter
   then genuinely failed to typecheck once actually compiled. Fixed with
   an explicit `action == null ||` in the same guard clause.
3. **`MediaReminderModule.kt`**: called `ReminderDtoWriter.writeOccurrence(...)`
   with no `import com.aslam.mediareminder.reminders.ReminderDtoWriter` —
   a plain missing import, `Unresolved reference` once compiled.
4. **`BackupOperationEmitter.kt` and `ReminderEventEmitter.kt`** both wrote
   `app.reactHost.currentReactContext` — but `ReactApplication.reactHost`
   is itself nullable (`ReactHost?`) in the installed RN 0.86, a fact no
   environment before now could verify by actually compiling against the
   real AAR. Fixed with `app.reactHost?.currentReactContext`.
**Decision:** Fixed all five directly — each is a small, mechanical, clearly
scoped correctness fix (a documentation-comment escaping bug, a
null-safety gap, a missing import, and two real API-surface facts about
the installed RN version), not a design decision requiring a spec update.
**Consequence:** `:app:compileDebugKotlin` succeeds. This is exactly the
risk DL-032's "written carefully, reasoned through, but not compiled"
caveat existed to flag — now resolved for these five files; every other
Kotlin file in this repo has now also been compiled at least once as a
side effect of the same build.

## DL-047 — `:app` never actually depended on its autolinked native modules

**Date:** 2026-08-07
**Context:** Past DL-046's Kotlin fixes, `:app:compileDebugJavaWithJavac`
failed on the Codegen-*generated* `PackageList.java`: `error: package
com.swmansion.gesturehandler does not exist` (and three siblings —
`safeareacontext`, `rnscreens`, `horcrux.svg`), even though
`:react-native-gesture-handler:assembleDebug` and the other modules had
already built successfully earlier in the very same invocation. Ruled out
build-cache staleness first (`./gradlew --stop`, manually deleted every
`build`/`.cxx` output directory under `android/app` and each native
module's `node_modules/.../android/`, reran from a genuinely clean state —
identical failure). `settings.gradle`'s
`ex.autolinkLibrariesFromCommand()` only makes the native modules
*includeable* as Gradle subprojects; it does not make `:app` depend on
them. `node_modules/@react-native/gradle-plugin/.../ReactExtension.kt`'s
`autolinkLibrariesWithApp()` is the actual dependency-wiring step, and its
own doc comment says exactly that: "This function should be invoked
inside the `react {}` block in the app's build.gradle and is necessary
for libraries to be linked correctly." `android/app/build.gradle`'s
`react {}` block was empty.
**Decision:** Added the `autolinkLibrariesWithApp()` call to `android/app/build.gradle`'s
`react {}` block.
**Consequence:** `:app:compileDebugJavaWithJavac` succeeds —
`PackageList.java`'s references now resolve because `:app` actually
depends on `:react-native-gesture-handler` etc. at the Gradle level, not
just at the generated-source level. This, on top of DL-045/DL-046, is what
finally produced a real `app-debug.apk` (`android/app/build/outputs/apk/debug/`)
— confirmed to exist on disk, not just inferred from a green exit code.

## DL-048 — `OccurrenceCalculatorTest`'s leap-year case asserted the wrong thing

**Date:** 2026-08-07
**Context:** `./gradlew test` ran for the first time (blocked until
DL-045/046/047) and found 69/70 Kotlin unit tests passing — the one
failure was `` `yearly uses Feb 29 itself in a leap year` ``, not a
production bug. `nextYearly()` (`OccurrenceCalculator.kt`) searches
starting from `after`'s *own* year first. The failing test started
`after` at 2027-01-01 (not a leap year) — so the calculator correctly
clamped to 2027's Feb 28 and returned immediately, exactly matching the
already-passing, adjacent `` `yearly clamps Feb 29 to Feb 28 in a
non-leap year` `` case's verified behavior. The test never actually
reached 2028 to exercise "Feb 29 used literally" the way its name claims.
**Decision:** Changed the test's `after` to 2028-01-01 (itself a leap
year, before Feb 29), so the calculator's first candidate correctly
resolves to that same year's real Feb 29 with no clamping — actually
exercising the behavior the test name describes. Did not touch
`OccurrenceCalculator.kt` — verified its behavior is correct and
self-consistent before changing anything, per this log's standing
discipline (DL-017, DL-034, DL-035) of re-verifying before acting rather
than assuming a failing test means production code is wrong.
**Consequence:** All 70 Kotlin unit tests pass. Combined with DL-045
through DL-047, `./gradlew assembleDebug test` is fully green — the
first time in this project's history.

## DL-049 — `SoLoader.init(this, false)` cannot resolve React Native's merged `.so`

**Date:** 2026-08-08
**Context:** First real launch on a physical device (V2446, Android 16 /
API 36, arm64-v8a) after DL-041..048 produced an installable APK. The app
died instantly — before any Activity or JS — with
`java.lang.UnsatisfiedLinkError: dlopen failed: library
"libreact_featureflagsjni.so" not found`, thrown from
`DefaultNewArchitectureEntryPoint.load()` in `MainApplication.onCreate`.
Ruled out the obvious candidates first: the ABI is not mismatched (the
universal APK carries all 16 `.so` per ABI including `arm64-v8a`), and
`com.facebook.react:react-android` resolves to exactly `0.86.0`, matching
`node_modules`. The actual cause is visible in the stack trace's
`com.facebook.soloader.nativeloader.SystemDelegate.loadLibrary` frame:
`SystemDelegate` is SoLoader's fallback, which calls `System.loadLibrary()`
verbatim. React Native 0.76+ merges every core native library into a single
`libreactnative.so` (present in the APK; `libreact_featureflagsjni.so`
deliberately is not — 0 matches in the archive), and
`com.facebook.react.soloader.OpenSourceMergedSoMapping.mapLibName()` is
what rewrites `react_featureflagsjni` (and `reactnativejni`,
`turbomodulejsijni`, `fabricjni`, `yoga`, ...) to `reactnative`.
`SoLoader.init(this, false)` is the pre-0.76 signature and installs no
mapping at all, so the very first core library touched failed to open.
**Decision:** `SoLoader.init(this, OpenSourceMergedSoMapping)` in
`MainApplication.onCreate`, with the reasoning inline so it is not
"simplified" back to the old two-arg form.
**Consequence:** Process survives `Application.onCreate`; launch proceeds
to the React host. This was a pure startup blocker — no amount of JS-side
work could have run before it.

## DL-050 — the debug variant had no source set, so it could never reach Metro

**Date:** 2026-08-08
**Context:** With DL-049 fixed the process stayed alive but still failed at
launch, now with `Unable to load script` and a fatal `ReactHostImpl`
exception. The real message was one line earlier in logcat:
`CLEARTEXT communication to localhost not permitted by network security
policy`, and `isMetroRunning(): Async result = false`. `android/app/src/`
contained only `main` and `test` — there was no `debug` source set at all.
ADR-015 correctly keeps `INTERNET` out of the manifest, and
`src/main/AndroidManifest.xml` honours it; what was missing is that a debug
build legitimately needs it to fetch the bundle from the dev server.
Release is unaffected: `getUseDeveloperSupport()` is `BuildConfig.DEBUG`,
so a release build reads its bundle from assets and opens no socket.
**Decision:** Added `android/app/src/debug/AndroidManifest.xml` declaring
`INTERNET`, plus
`android/app/src/debug/res/xml/network_security_config_debug.xml`.
Deliberately *not* the RN template's blanket
`android:usesCleartextTraffic="true"` — the config whitelists cleartext for
`localhost`/`127.0.0.1`/`10.0.2.2`/`10.0.3.2` only and leaves the default
base-config denying everything else, so MR-12 still means something while
debugging. No ADR filed: ADR-015 scopes its prohibition to the
*production* manifest, and this permission cannot reach a release APK.
**Consequence:** `isMetroRunning(): Async result = true`, bundle loads, and
`Running "MediaReminder" with {"fabric":true}` — New Architecture confirmed
live on device. **Release-manifest verification is still owed**: confirm
`INTERNET` is absent from the merged release manifest
(`./gradlew :app:processReleaseManifest`) before any signed build ships.

## DL-051 — `Intl.PluralRules` is not in Hermes, and it was called at module scope

**Date:** 2026-08-08
**Context:** With the bundle finally loading, the app rendered the error
boundary instead of the UI: `TypeError: Cannot read property
'MediaDetailScreen' of undefined` at `RootNavigator.tsx:65`, preceded by two
`undefined cannot be used as a constructor` errors. The import was not
circular. `LibraryScreen.tsx` ran `new Intl.PluralRules('en')` at *module
scope*; Hermes' Android `Intl` surface provides `Collator`,
`DateTimeFormat` and `NumberFormat` but not `PluralRules`, so the
expression threw at import time, aborted the module, and left the entire
`features/library` barrel `undefined` — which is why the symptom surfaced
two files away as a missing `MediaDetailScreen` export. Both
`LibraryScreen.tsx` and `localization/format.ts` carried comments
asserting PluralRules was "built into Hermes"; that claim was the root
cause and is now corrected in place. `npm run typecheck` cannot catch this
— the API is correctly typed, it simply is not implemented at runtime.
**Decision:** Added `formatEnglishUnit` to `src/localization/format.ts` and
pointed `LibraryScreen` at it. Placed in the localization module, not the
screen, because plural selection is a localization concern and
`formatDurationAccessible` already injects the unit formatter precisely so
no screen owns a plural rule. For integer counts it is exactly the CLDR
English rule, so output is identical to what the `Intl` call would have
produced.
**Consequence:** App launches to the Today screen and the Library tab (the
module that was failing) renders its search, filter, category, sort and
empty states with no JS errors. `npm run verify` green: typecheck clean,
44/44 Jest tests pass. Standing lesson: an `Intl` member being typed is not
evidence Hermes implements it, and a module-scope constructor turns a
missing API into a whole-barrel failure — prefer lazy construction inside
the function that needs it.

## DL-052 — bottom insets: `Screen` never applied one, and Settings applied it twice

**Date:** 2026-08-08
**Context:** Reported as buttons and content sitting under the gesture bar on a
real device. `Screen`'s header claimed it "honors status, navigation, cutout
and gesture insets", but only the `scrollable` branch applied
`paddingBottom: insets.bottom`. The non-scrollable branch applied none — and
`scrollable` defaults to `false`, so every fixed-layout and list-owning screen
put its last row and its action buttons under the gesture/navigation bar.
`targetSdk 36` forces edge-to-edge, so nothing hides it.

The naive fix (add `paddingBottom` unconditionally) would have introduced the
opposite bug on the tab screens: `AppTabBar` already pads itself by
`insets.bottom`, and the tab bar and screen are siblings, so the space would
be reserved twice and leave a dead gap above the tab bar. `SettingsScreen` —
the one scrollable tab screen — was already doing exactly that.

**Decision:** Two changes, and deliberately no per-screen edits. (1) `Screen`
applies `paddingBottom: insets.bottom` in the non-scrollable branch too, on the
content rather than the outer view so the background still paints to the
physical edge — the same rule the scrollable branch already used. (2)
`TabNavigator` supplies `screenLayout` wrapping each tab screen in a
`SafeAreaInsetsContext.Provider` whose `bottom` is `0`, since the tab bar
consumed it. `tabBar` is rendered outside `screenLayout`, so `AppTabBar` still
receives the real insets.

Rejected a `hasTabBar` prop mirroring `hasAppBar`: it would have required
touching every tab screen, and a screen asking "am I inside a tab?" is
answering a question its parent already knows. Zeroing the inset at the
navigator keeps `Screen` unconditional — the value it reads is simply correct
for wherever it is mounted. It also meant zero edits to feature screens, which
avoided colliding with concurrent work in `LibraryScreen.tsx`.

**Consequence:** Stack screens (Health, MediaDetail, ReminderDetail,
Onboarding) now clear the gesture bar; the redundant gap above the tab bar on
Settings is gone. Verified on device (Android 16 / API 36, 720x1600): Settings
content runs flush to the tab bar and the new theme `SegmentedControl` renders
correctly; Health renders with the inset applied; no JS errors. `npm run
verify` green, 44/44. The context value is memoized because an unmemoized
object would re-render every inset consumer in the tab subtree.

## DL-053 — media library read side: `media_assets`, and Room schema export was never wired

**Date:** 2026-08-08
**Context:** "Can't import anything" turned out not to be a wiring bug. Import
was unimplemented on both sides: `beginMediaImport`/`updateMedia`/`deleteMedia`
all returned `rejectNotImplemented`, `listMedia` returned a hardcoded
`emptyPage()`, every "Import media" button was `onPress = () => undefined`, and
Room had **no media table at all** — the 8 entities were alarm/reminder/
scheduler only. Everything visible in Library was UI over JS mock fixtures.

**Decision:** Landed the read half of Milestone 1 as its own reviewable slice,
deliberately stopping short of the picker so the data layer could be verified
independently. `MediaAssetEntity` matches MR-09's `media_assets` table
column-for-column, with `MediaDao`, `MIGRATION_3_4`, and `listMedia`/`getMedia`
now answering from Room.

Two design calls worth recording. First, `MediaQuery`'s five optional filters
and four sort orders are built by a **pure** `MediaQuerySql` object with no
Android or Room dependency, driving a `@RawQuery` DAO. As fixed `@Query`
methods this is combinatorial, and the usual `(:arg IS NULL OR col = :arg)`
plus `CASE` in `ORDER BY` workaround produces SQL SQLite cannot satisfy from
the MR-09 indices, because a `CASE` sort key is not indexable. Being pure means
14 JVM unit tests cover the filter/sort/escaping behavior with no emulator.
Second, `category`/`tags`/`thumbnailToken` are emitted as null/empty rather
than faked, because `categories` and the thumbnail cache do not exist yet and a
placeholder name would render verbatim in the Library's chips.

**Also fixed:** `MediaReminderDatabase` has declared `exportSchema = true`
since it was written, but `room.schemaLocation` was never passed to KSP, so
Room silently exported nothing. That is the artifact used to check a
hand-written migration against what Room actually expects — and MR-09 forbids
destructive migration, so a wrong migration has no fallback and fails at open
time on a real install with "Room cannot verify the data integrity". Now wired
to `android/app/schemas/`, and `4.json` was diffed against `MIGRATION_3_4`:
columns, types, nullability, the `DEFAULT 1`, primary key and all three indices
match exactly (the only differences are whitespace, which Room does not compare
— validation reads `PRAGMA`, not SQL text).

**Consequence:** `./gradlew test` green, 83 Kotlin tests, 0 failures (14 new).
`npm run verify` green, 44/44. Import itself is still **not** implemented — the
Photo Picker, streamed copy, SHA-256 and journal remain, and `listMedia` will
correctly return an empty page until they land. A caught bug worth noting: the
first draft of `mostScheduled` compared `reminders.effective_state` against a
*media integrity* constant (`healthy`), which is always true; there is now a
regression test asserting it counts `active` reminders instead.

## DL-054 — media import: fire-and-forget `beginMediaImport` matches `beginExport`'s established precedent, not MR-08's pre-redesign spec text

**Date:** 2026-08-08
**Context:** Building the import pipeline (DL-053 landed the read side only)
required deciding `beginMediaImport`'s call shape. MR-08's markdown still
declares `beginMediaImport(request: ImportRequest): Promise<OperationRef>` —
a fire-and-forget id returned immediately, with progress and an implied
separate completion signal. But `NativeMediaReminder.ts`'s real, *implemented*
`beginExport` already deviated from that same aspirational shape for a
documented reason: "today's export has no large media stream to justify a
fire-and-forget `OperationRef` + separate completion event... Progress still
streams via `operationProgress` throughout" — i.e. resolve once, at the end,
with the real result, and let progress events (not the promise) carry
`operationId` to the UI for cancellation. Backup restore's `inspectBackup`
confirms the same pattern already works for a real, JS-driven picker flow:
`uriToken: string` is a plain content URI the JS side already obtained
somehow, native does everything from there.

**Decision:** `beginMediaImport(request: ImportRequestWire): Promise<MediaDetailWire>`
— resolves with the finished `MediaDetail` once the copy/hash/probe/insert
pipeline completes, not an `OperationRef`. Progress streams via
`operationProgress` tagged `kind: "import"` throughout (this *is* the case
export's own comment says would justify fire-and-forget — a media file
genuinely can be large — but the fire-and-forget part specifically means
returning early; nothing stops a slow operation from also resolving once at
the end while still emitting progress the whole time, and doing so removes
an entire completion-event design surface). `OperationRefWire` is left
declared but now unused anywhere — a harmless, still-valid wire shape for
some future truly early-returning operation, not deleted speculatively.

Picking is split into its own method, `pickDocument(mimeTypes): Promise<PickedDocumentWire | null>`,
rather than folded into `beginMediaImport` behind an `ActivityEventListener`
inside that same call. Two independent reasons: (1) picking is a fast,
bounded UI interaction with no progress to report, so it does not need the
long-running-operation machinery `beginMediaImport` has; (2) `inspectBackup`
already establishes "JS obtains a URI, native does the rest" as this
codebase's real precedent for picker results crossing the bridge, and
`ImportScreen`'s own picker gap (`docs/decision-log.md` says the picker UI is
"a documented follow-up") is the *exact same missing primitive* — building it
once, generically, means `ImportScreen` can adopt it later instead of
needing a second, backup-specific picker implementation.

**Consequence:** `MediaReminderModule` gained `ActivityEventListener`
(register in `init`, unregister — and reject any still-pending picker
promise — in `invalidate()`), a `ConcurrentHashMap<Int, Promise>` keyed by a
distinctive request-code base (`9100`) rather than an `ActivityResultRegistry`
(that Jetpack API requires lifecycle-bound registration and cannot be
launched on demand from a bridge method call years after `MainActivity`'s
`onCreate`). `OperationRegistry` and `OperationProgressEmitter` were
extracted from their backup-only originals (`BackupOperationRegistry`,
`BackupOperationEmitter`, now thin adapters) because `cancelOperation` and
the `operationProgress` sequence counter both have to be single, shared, or
a media-import id and a backup id in flight together would silently corrupt
each other's state.

**Residual risk:** Update, same day — verified on a real device (V2446,
Android 16/API 36): the real system Photo Picker opened on tapping Import
media (confirmed via `media_grants` SQL activity in logcat, not inferred from
a screenshot alone), a picked video imported in 451ms end to end, and the
result appeared in the Library grid sorted newest-first. `MediaPicker`'s
photo-picker-vs-SAF decision is unit-tested; the `Intent` construction and the
`ActivityEventListener` round trip now also have one real device confirmation,
though not an automated instrumentation test — still worth adding per
TODO.md, since one manual pass doesn't cover cancellation, SAF (audio) or
error paths.

## DL-055 — real media reached a dead end at the reminder editor; closed the whole loop, not just the picker

**Date:** 2026-08-08
**Context:** Reported plainly: "I can upload my media but I cannot access it
to set alarms with it." Tracing the alarm-creation sequence end to end found
that the report understated the gap. Four separate things were each
independently broken:

1. `ReminderEditorScreen`'s "choose media" `Sheet` and its "What" section both
   read from the static `mockMedia` fixture array, never the real
   Room-backed library — so even reaching the picker, nothing real was in it.
   A new reminder's `mediaId` also defaulted to `mockMedia[0]?.id`, which
   would have let Save silently create a reminder pointing at a fixture id
   that does not exist in Room (`reminders.media_id` still has no foreign key
   — DL-053/054 — so nothing would have rejected it).
2. **There was no way to create a new reminder at all.** Every
   `navigation.navigate(rootRoutes.reminderEditor, ...)` call site in the app
   passed an *existing* `reminderId`; `RemindersScreen` had no add affordance
   of any kind (`onPress: () => undefined` on every row, no empty-state
   action). MR-03's own "Navigation model" section specifies exactly this
   gap's fix — "A floating action button labeled Add opens a modal action
   sheet with Import media, Create reminder..." — and it had simply never
   been built; no FAB component existed in the design system at all.
3. `MediaDetailScreen` (tapping an item in the Library grid) was entirely
   `findMockMedia`-backed. A real imported item's UUID can never match a
   mock fixture id, so opening detail on anything actually imported showed
   "This media is no longer available" unconditionally — not a bug in this
   screen's logic, a screen that had never been connected to real data at all.
4. `updateMedia` (MR-03 "Edit details", i.e. rename) was still
   `rejectNotImplemented` in Kotlin, and `getMedia` — made real in Kotlin
   during the read-side slice (DL-053) — had never been exposed through
   `MediaReminderClient`/`MediaRepository`, so nothing on the JS side could
   have called it even once the native side worked.

**Decision:** Closed all four, in dependency order (native `updateMedia` →
JS client/repository wiring for `getMedia`+`updateMedia` → real
`MediaDetailScreen` → real `ReminderEditorScreen` picker → the FAB). Notable
calls:

- `MediaRename.resolve()` is a pure function (Kotlin) separating the
  optional-field trim/validate/clamp rules from the Room read-modify-write —
  same reasoning as `MediaQuerySql`: the part most likely to be subtly wrong
  gets JVM tests, not just an instrumented smoke pass.
- The rename dialog (`RenameMediaDialog.tsx`) and the picker sheet
  (`MediaPickerSheet.tsx`) are each their own component, not inlined into
  `MediaDetailScreen`/`ReminderEditorScreen` — both screens' own branching
  (pending/error/delete-confirmation; repeat type/profile/snooze/preview)
  already carried enough cognitive weight that adding either dialog inline
  pushed a code-health check over its complexity threshold. Same rule DL-0xx
  entries have followed all session: extract when a screen's own concerns
  are being crowded out by a self-contained dialog's state.
- The FAB is mounted **once**, in `TabNavigator`, not duplicated on
  Today/Library/Reminders. Two independent reasons: it is chrome per MR-03's
  own framing ("Navigation model", alongside the bottom nav), not a
  per-screen affordance; and a single `useImportMedia()` instance means its
  progress/error state has exactly one source of truth regardless of which
  tab is focused when an import finishes — three independent per-screen
  instances would each show their own progress bar only if that screen
  itself triggered the import, silently showing nothing on the other two.
- `FAB`'s position is a fixed 88 dp offset above the tab bar, not measured:
  `AppTabBar`'s real height depends on font scale and bar-vs-rail treatment,
  and measuring it would mean threading an `onLayout` callback through the
  navigator's own `tabBar` render prop. Verified against the real rendered
  bar on a physical device rather than assumed.
- `getMedia`/`updateMedia`/`useMediaList`/`useReminderList` all moved to (or
  were added directly in) `src/hooks/`, not `features/library/`
  or `features/reminders/` — every one of them is now consumed by at least
  two features (`ReminderEditorScreen` needs the media list;
  `MediaDetailScreen` needs the reminder list), matching the `useImportMedia`
  /`useOperationProgress` precedent from earlier this session.

**Consequence:** `./gradlew test` green (113 Kotlin tests, 8 new
`MediaRenameTest` cases, 0 failures). `./gradlew assembleDebug` green.
`npm run verify` green — typecheck clean, lint 0 warnings, 44/44 Jest
(unchanged; this slice's JS surface has no new tests yet, same residual-risk
shape as DL-054's — tracked in TODO.md). **Not yet verified on device**: the
physical device was reachable and unlocked earlier in the session but is
locked again as of this entry; no PIN was entered to bypass it. Every change
here is behind either a compile-time check (TypeScript route param, Kotlin
type) or a unit test, but the actual on-screen result — FAB position clearing
the tab bar, the rename dialog, the picker showing a real imported item — has
not been looked at.

## DL-056 — `scheduler_state` was never seeded: every reminder save has always crashed post-commit

**Date:** 2026-08-08
**Context:** On-device verification of DL-055 (FAB → Create reminder → choose
real media → Save) hit a `bridge.failedSafe method=saveReminder` with
`IllegalArgumentException: scheduler_state row must exist (seeded at first
save)`, thrown from `SchedulerCoordinator.applyToAlarmManager`
(`SchedulerCoordinator.kt:159`). `scheduler_state` is a singleton row
(`SchedulerStateDao`'s doc comment: "enforced by the DAO only ever upserting
this row"), but `markDesired` — the only write path ever called before this
fix — is a bare `UPDATE ... WHERE id = 1`, which silently affects zero rows
when the row doesn't exist. Nothing in the codebase ever inserted it: no
`RoomDatabase.Callback.onCreate` seed (unlike `SeedBuiltInProfilesCallback`
for built-in profiles), no migration default row, and the existing `upsert()`
method (`OnConflictStrategy.REPLACE`) was never called anywhere. The
`ReminderMutationService.save()` transaction that inserts the `ReminderEntity`
row commits successfully *before* `scheduler.reconcile()` runs outside that
transaction, so the reminder silently persisted in Room on every attempt even
though the promise always rejected — confirmed on-device: a reminder saved
under the old build still showed up in the Reminders list after the fix
shipped, with scheduling never having been registered for it.
**Decision:** Added `SchedulerStateDao.seedIfAbsent()`
(`@Insert(onConflict = OnConflictStrategy.IGNORE)`) and call it from
`SchedulerCoordinator.applyToAlarmManager` immediately before `markDesired()`,
seeding generation 0 / no desired occurrence if the row is absent. Chose a
plain `INSERT OR IGNORE` over rewriting `markDesired` as a raw-SQL upsert
(SQLite's `INSERT ... ON CONFLICT DO UPDATE` needs SQLite 3.24+, which is not
guaranteed on the framework-bundled SQLite across this app's supported API
range) and over a `RoomDatabase.Callback.onCreate` seed (fires only for a
brand-new database file, so it would not have fixed this on any install that
already went through the v1→v4 migration path, including the test device).
**Consequence:** `./gradlew test` and `./gradlew assembleDebug` green.
Verified end-to-end on the physical device: Create reminder → choose real
imported media → label → Save now succeeds with no error dialog, the new
reminder appears in the Reminders tab, and the Library grid's "1 active
reminder" count updates. The pre-existing reminder that had silently
persisted despite its save-time crash (`trialCookingvideo`) is real data, not
a leftover to clean up — its schedule now reconciles correctly on the next
`SchedulerCoordinator` call. No migration needed: `seedIfAbsent` heals any
existing install the first time it reconciles after this build, regardless of
whether that install ever got past this bug before.

## DL-057 — real thumbnails, in-place preview playback, and the Library two-pane layout

**Date:** 2026-08-08
**Context:** A full Material 3 visual redesign pass across every screen was
requested ("should NOT look like a student project" — Material 3, rounded
cards, smooth animations, adaptive tablet/landscape layout, accessible, dark
mode). The design-system audit that preceded this work found the token/theme/
component layer already mature (light/dark/Material You, full type/spacing/
radius/elevation/motion scales, heavy accessibility instrumentation) — the
real gaps were: almost nothing in the app animates (one hand-rolled
`Animated` case, no library), no media item has ever had a real thumbnail
(`MediaCard` already renders `thumbnailUri` via `<Image>`, but nothing
populated it), Media Detail's "Play preview" button was a literal no-op, and
no true two-pane tablet layout existed despite the width-class/rail-nav infra
it would sit on already being there. Clarified with the user: thumbnails
must be real (extracted video frame / the image itself / embedded audio art),
not generated placeholders, and the Library needed in-place preview playback.
**Decision:**
- Added `react-native-reanimated` 4.5.3 + `react-native-worklets` 0.11.3 (the
  separate worklets-transform package Reanimated 4 delegates to; both
  packages' peer ranges target exactly this app's RN 0.86) and
  `react-native-video` 6.19.2, local-file playback only. `babel.config.js`
  gained the `react-native-reanimated/plugin` (a thin re-export of
  `react-native-worklets/plugin`), must stay last. Jest needed both a
  `resolver: 'react-native-worklets/jest/resolver.js'` (native-only file
  extensions confuse Jest's module resolution otherwise) and the standard
  `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))`.
  `react-native-video`'s own manifest declares no permissions, but its
  ExoPlayer dependency injected `ACCESS_NETWORK_STATE` into the merged
  manifest — stripped via `tools:node="remove"` in
  `AndroidManifest.xml` (this app only ever plays local `file://` sources)
  so the release manifest's verified permission set stays exactly what it
  was (MR-06 "no network access" — re-checked via
  `./gradlew :app:processReleaseManifest`, still 8 permissions, no
  `INTERNET`, and now no `ACCESS_NETWORK_STATE` either).
- Native thumbnail generation: new `MediaThumbnailer.kt`, called from
  `MediaImporter.import()` right after `MediaProbe` (which had an explicit
  comment deferring this). Video gets a real decoded frame
  (`MediaMetadataRetriever.getFrameAtTime`, ~1s in or 10% of duration for
  short clips); image gets the source image itself, downscaled; audio gets
  embedded cover art if the file actually has any, otherwise no thumbnail —
  never a fabricated image, matching `MediaDtoWriter`'s existing "omit
  honestly" policy for `category`/`tags`. Pure math
  (`sampleSizeFor`/`scaledDimensions`/`frameTimestampUs`) split into
  `data/media/ThumbnailMath.kt` with real JVM tests, the same
  `MediaProbe`-vs-`MediaKinds` split this codebase already uses everywhere
  else for Android-framework-dependent code. `media_assets.thumbnail_path`
  (`MIGRATION_4_5`) stores just the opaque `<id>.webp` filename, resolved
  against `MediaStorage.thumbnailsDir()` — **`context.cacheDir`, not
  `filesDir`**, per MR-09 "Derived thumbnails are WebP cache and may be
  cleared at any time." Generation failure is caught and non-fatal (MR-05:
  "thumbnail failure does not invalidate the source asset").
- Wire contract: MR-08 is explicit that DTOs never carry "Android URIs" and
  that `thumbnailToken` is "opaque... consumed by an image provider." Rather
  than adding a raw `thumbnailUri: string` field (which would violate that
  principle) or building a genuine native image-provider indirection (a
  custom Fresco scheme handler — real native UI-pipeline surgery,
  disproportionate here), the opaqueness is enforced structurally exactly
  the way `types.ts`'s own header comment already says this contract does it
  elsewhere: `ThumbnailToken`/`MediaSourceToken` are TypeScript brands whose
  *runtime* value is a `file://` URI into this app's private storage (safe —
  Android resolves `file://` for an app's own files with no permission or
  content-provider indirection needed, and the value never leaves the
  process), but nothing in the codebase may treat one as a plain string
  except `src/native-client/mediaTokens.ts`'s two adapter functions — the
  "image provider" the spec describes. `MediaCard`/`MediaPreviewPlayer`
  themselves stay generic, taking a plain `uri` prop exactly as before;
  every *screen* is the one narrow place that calls the adapter.
- `MediaPreviewPlayer` (`features/library/`) is a full-screen `Modal`
  wrapping `react-native-video` with `controls` (the platform/ExoPlayer
  transport UI) rather than a hand-built scrubber — proportionate given the
  scope already in this slice. Always black/white regardless of app theme,
  the same reasoning `MediaCard`'s existing high-contrast scrim comment
  documents (an immersive media surface, not a themed dialog). Used by both
  the Library grid's new play affordance and Media Detail's previously-dead
  "Play preview" button.
- `MediaDetailScreen` was split into `MediaDetailContent` (all the actual
  content/logic) plus a thin route-level wrapper, so the identical content
  can render twice: pushed full-screen (compact width) and embedded as
  `LibraryScreen`'s right-hand pane (medium/expanded width, `useResponsive()
  .navigation === 'rail'`) — implementing
  `specs/Markdown/04_Visual_Design_System.md`'s "Medium: ... two-pane Library
  detail" line for real, on the one screen the spec's responsive table
  actually names. `onBack` being present or absent is what tells the
  component which mode it's in (an embedded pane renders no back button —
  the grid beside it is the way back).
- `LibraryScreen`'s own loading/error/importing/empty/populated branching
  was extracted to `LibraryGridBody` before adding the two-pane split — the
  code-health hook flagged the screen's cognitive complexity the moment the
  two-pane `if` was added on top of the existing state chain, the same
  "extract when a screen's own concerns get crowded" rule DL-055 already
  established.
**Consequence:** `./gradlew test`/`assembleDebug` green (new
`ThumbnailMathTest` cases included), release-manifest check green,
`npm run verify` green. **Not yet verified on a physical device for this
slice** — the device was connected earlier in the session but disconnected
before this slice could be installed; every change here is behind a
compile-time check or a unit test, not an on-screen look, until that happens.
Screens beyond Library/Media Detail (Home, Reminders, Reminder Details,
Create Reminder, Settings, Backup, Import, Statistics, About) are tracked
separately in `TODO.md` as the remaining part of the same redesign request.

## DL-058 — reminder rows never actually joined `media_assets`; `Card` gained a shared press-scale

**Date:** 2026-08-08
**Context:** Continuing the redesign into the Reminders list and Reminder
Details screens surfaced a second real (non-visual) gap alongside the visual
one: `ReminderDtoWriter.kt`'s own doc comment already admitted `mediaKind`
was hardcoded `"video"` and `thumbnailToken` was always absent, because
`reminders.media_id` had never been joined against `media_assets` at read
time (distinct from the separately-tracked, harder problem of adding a real
foreign key — this is just a runtime lookup). The Reminders list row's
`onPress` was also a bare `() => undefined` and the enable `Toggle` was
never wired to `setReminderEnabled` at all — the whole row was decorative.
**Decision:**
- `MediaDao` gained `getByIds` (batched, same pattern as
  `countActiveRemindersFor`); `ReminderDtoWriter.writeSummary`/`writeDetail`
  now take a nullable `media: MediaAssetEntity?` + `storage: MediaStorage`
  and write the real `kind`/thumbnail. `ReminderMutationService`'s four call
  sites (`get`/`list`/`save`/`setEnabled`) each fetch the linked media row(s)
  — `list()` batched in one query, not N. The URI-resolution logic itself
  (existence-checked thumbnail lookup, source-file URI) was pulled out of
  `MediaDtoWriter` into a new shared `MediaThumbnailUri` object so
  `ReminderDtoWriter` doesn't duplicate it.
- New `useSetReminderEnabled` mutation hook (`features/reminders/`),
  matching `useSaveReminder`'s write-through-cache/invalidate shape exactly.
  Reminders list row `onPress` now navigates to `ReminderDetailScreen`; the
  `Toggle` calls the real mutation instead of doing nothing.
- `Card` (design-system) was switched from a plain `Pressable` to the new
  `AnimatedPressable` internally, reproducing its existing pressed-background
  -highlight via local `useState` (composed with `AnimatedPressable`'s own
  scale animation through its `onPressIn`/`onPressOut` composition, since the
  primitive deliberately has no pressed-callback style form — see its own
  doc comment). One change here gives every card-based screen (Today,
  Reminders, Media Detail, Settings) the same subtle press-scale for free,
  rather than opting in screen by screen.
- Today's occurrence rows and Reminder Detail's whole content got a
  reanimated `FadeInUp` entrance (staggered by index on Today, capped at 8
  items so a long list's tail isn't waiting behind a multi-second queue),
  gated on `theme.a11y.reduceMotion` same as every other new animation this
  redesign has added. Reminder Detail also gained a hero media
  avatar (real thumbnail when the mock media has one, kind icon otherwise) —
  markup-only, since this screen's data source staying `findMockReminder`
  is a separate, already-tracked gap this pass does not touch.
**Consequence:** `./gradlew test`/`assembleDebug`, full project `eslint`,
and `npm test` (44/44) all green. Reminders list and Reminder Detail are
**not yet verified on a physical device** for the same reason as DL-057 —
still no device connected this session to confirm the redesigned screens
render and the newly-wired toggle/navigation actually work end-to-end.

## DL-059 — Library's grid empty state stopped reusing Today's copy

**Date:** 2026-08-09
**Context:** `LibraryGridBody`'s zero-items branch rendered `today.empty.title`
/ `today.empty.body` ("No reminders scheduled" / "Import something
meaningful, then choose when it should return.") — Today's copy, not
Library's, so an empty media library told the user their *reminders* were
empty. This was inherited unchanged from before the `LibraryScreen` /
`LibraryGridBody` split (DL-057); nothing about that refactor touched it.
**Decision:** Added dedicated `library.empty.*` keys and split them into two
states, since an empty grid has two distinct causes the user can act on
differently: a genuinely empty library (first-run — the fix is to import
something, so the existing `importMedia.importMedia()` action stays as-is)
versus a search/kind/category filter that matched nothing (recoverable by
clearing the filter, not by importing more media — new `library.empty.filtered.*`
copy with a real **Clear filters** action). `LibraryGridBody` gained
`isFiltered`/`onClearFilters` props from `LibraryScreen`, computed as
`search.length > 0 || activeKind !== null || activeCategoryId !== null` —
sort is deliberately excluded, since it reorders and never excludes.
**Consequence:** None of this touches the loading/error/importing branches
above it in `LibraryGridBody`, which were already correct. `TranslationKey`
needed no edit — it is `keyof typeof en`, so the new keys type-check
automatically.
## DL-060 — first real on-device pass surfaced a stub delete, fake Today data, and a broken edit path; full screen-polish sweep

**Date:** 2026-08-09
**Context:** A device finally connected and immediately surfaced problems no
amount of static verification had caught, plus direct user feedback on visual
density across four screens. In order surfaced:
- **`TimePicker`'s AM/PM `SegmentedControl` was clipped off the right edge
  of the screen** — a single `Stack direction="row"` with two `displaySmall`
  steppers plus the segmented control was wider than a typical phone at that
  font scale, and `Stack` does not wrap by default. Fixed by stacking the
  segmented control on its own centered row below the steppers instead of
  fighting for horizontal space with them.
- **Library's filter chips (search + kind + category + sort, all `Stack
  wrap`) consumed most of the screen before any media rendered.** New
  `design-system/components/ChipRow.tsx` (horizontal-scroll wrapper,
  MR-13 explicitly allows scroll as the wrap alternative) replaces every
  wrapped chip group in Library and Settings; Library's category/sort rows
  are now collapsed behind a "More filters" toggle chip, default-hidden.
- **Reminders list was a plain `ListRow`** with a small thumbnail box and no
  visible scheduled time at all — the opposite of what an alarm-list should
  lead with. Rewritten as a `Card` row with a large tonal time chip
  (hour:minute + AM/PM, `titleLarge` tabular) as the leading element, using
  `AnimatedPressable` for the body so the enable `Toggle` stays a sibling,
  never nested (MR-13).
- **`deleteMedia` was a native stub** (`NativeErrorEnvelope.rejectNotImplemented`)
  — the Delete button's confirm handler only closed the dialog and triggered
  a haptic; nothing was ever removed from disk or Room, so deleted media
  stayed forever, which is exactly what the user flagged as "app size will
  keep growing." Implemented for real: `MediaLibraryService.deleteMedia`
  deletes the DB row plus the on-disk original and cached thumbnail
  (`File.delete()` no-ops safely if already missing); `MediaReminderModule`
  orchestrates the two destructive dialog paths via the new
  `cascadeDeleteReminders` flag — `true` deletes every attached reminder the
  same way `deleteReminder` would (alarm rescheduling included, via
  `reminderMutations.delete`); `false`/omitted only disables them
  (`reminderMutations.setEnabled(id, false)`), since `reminders.media_id`
  carries no FK (nothing else forces the decision). New `ReminderDao
  .getByMediaId` finds the affected reminders. JS: `DeleteMediaRequest`/
  `useDeleteMedia` (write-through the same invalidate pattern as
  `useSaveReminder`), and a new `DeleteFlushOverlay` — water floods up from
  the bottom with rising bubbles while the item's icon sinks/rotates/fades,
  reduced-motion-safe (falls back to a quick opacity cross-fade). Wired only
  *after* the native call resolves successfully, and `MediaDetailContent`
  stops reading `media.data` entirely once flushing starts (an early
  `FlushingMediaView` return) — invalidating the media caches on success
  means the still-mounted detail query can flip to "not found" mid-animation
  otherwise, which would have raced the flush.
- **Today's occurrence timeline was mock fixture data**
  (`mockTodayOccurrences`, fabricated titles like "Weekly check-in with
  Mom") rendered alongside the user's real reminders — indistinguishable
  from real reminders the user never created. Rewritten to derive the
  timeline from `useReminderList()`'s real `nextOccurrence` per reminder.
  Trade-off accepted: since only the *next* occurrence is available (no
  occurrence-log query yet), a reminder already handled today has already
  advanced past today and drops off the list — real data over a fabricated
  history.
- **`ReminderEditorScreen`'s edit path read `findMockReminder`**, so opening
  "Edit" on any real, saved reminder silently found nothing and the form
  fell back to blank defaults. Split into a thin `ReminderEditorScreen`
  (loads the real reminder via new `useReminderDetail`, gates on
  pending/error before the form ever mounts — required because the form's
  fields seed once from `useState`'s initializer, so async data arriving
  after mount would never reach already-rendered fields) and the actual
  `ReminderEditorForm`, which now takes `existing`/`prefillMediaId` as props.
  `ReminderDetailScreen` had the same `findMockReminder`/`findMockMedia`
  problem plus two more decorative controls found while fixing it: the
  enable `Toggle` was local-`useState`-only (never called
  `setReminderEnabled`) and Delete's confirm only closed the dialog and
  navigated back (never called `deleteReminder`) — both now call the real,
  already-existing mutations (new `useDeleteReminder` for the latter).
- Also granted `SCHEDULE_EXACT_ALARM` via `adb shell appops set` on the test
  device (Today's "Exact timing is off" banner is a real, correct read of
  `AlarmManager.canScheduleExactAlarms()`, not a bug — the device just never
  had the permission granted).
- Visual pass on the remaining screens the plan had marked lighter-touch:
  Settings gained tonal `SettingsRowIcon` chips per row and a staggered
  per-section `FadeInUp` reveal; Backup/Import gained icon-accented summary
  rows and a shared tonal checkmark/hero-circle reveal on success; Import's
  three-button mode row became `RadioCard`s (title/description/notice,
  matching the reminder editor's Alert style pattern) instead of a plain
  filled/outlined/destructive button row; Statistics' `StatTile` gained an
  optional decorative `icon` (never an alert/warning glyph, matching its own
  "no attention/error tone on purpose" rule) and daily breakdown rows gained
  a proportional 3-segment bar (`primary`/`secondary`/`outline`, explicitly
  not a chart per MR-04); About's link rows became real tappable `ListRow`s
  via `Linking.openURL` (opening the OS browser needs no permission from
  Nudgio itself, so this does not touch MR-06's no-network invariant).
**Consequence:** `npx tsc --noEmit`, full `eslint src/` (max-warnings=0), and
`npm test` (44/44) all green throughout. Kotlin: `compileDebugKotlin`,
`./gradlew test` (all variants), and `assembleDebug`/`installDebug` all
green. On-device verification of this slice was interrupted mid-session by
a Metro port collision with a second, concurrent session building on a
separate git worktree — confirmed via a bundle error whose stack trace
pointed at `.claude/worktrees/elastic-banach-bd5254`, not this tree. Visual
confirmation of this entire slice is pending the user coordinating that
session before the next on-device check.

## DL-061 — Library selection mode, a dedicated Edit Media Asset screen, and app-wide save/delete toasts

**Date:** 2026-08-09
**Context:** A follow-up 9-section spec ("Library Layout, Editing, Selection,
and Offline Media Requirements") asked for three previously-missing pieces:
multi-select bulk Export/Delete in Library, a full "Edit Media Asset" screen
replacing the existing rename dialog, and a top-of-screen toast confirming
every save/delete across Reminders, Import, and Library.
**Decision:**
- **Selection mode** (`useLibrarySelection.ts`): `selectionMode`/`selectedIds`
  state plus the bulk-action flow live in one hook, not `LibraryScreen`
  itself, so the screen's own render stays thin. `LibrarySelectionHeader.tsx`
  swaps the normal "Library" title + "Select" text button for a literal
  black Back button (a small custom `Pressable`, since `IconButton`'s `tone`
  prop only maps to semantic theme colors and can't take an arbitrary
  background) + Export/Delete, per the spec's literal color requirement —
  `neutral.black`/`neutral.white` are named token constants
  (`design-system/tokens/palette.ts`), not literal color values, so this
  doesn't trip `no-color-literals` even inside `src/features/**` (same
  precedent `MediaCard`'s play-button scrim already established).
  `SelectionCheckboxOverlay.tsx` draws a decorative checkmark badge per card
  (`pointerEvents="none"`) — the whole `MediaCard` stays the tap target that
  toggles selection, so no second focusable control is needed. Zero
  selected + Export/Delete tapped triggers a `haptic: 'warning'` info toast
  and stays in selection mode; a real action always exits selection only
  *after* it resolves, and only on success — failure keeps the selection
  intact with an error toast so the user can retry without reselecting.
- **Edit Media Asset screen** (`EditMediaAssetScreen.tsx`, new
  `EditMediaAsset` route): a full pushed screen with the same title/notes
  fields and `useUpdateMedia` mutation the old `RenameMediaDialog` used, now
  reachable both from a new `IconButton` beside the title on Media Detail
  and from the existing "Edit details" button. `RenameMediaDialog.tsx` is
  deleted outright (and its now-orphaned `renameTitle`/`renameBody`
  localization keys removed) rather than left as unreachable dead code —
  nothing else referenced it.
- **Toasts**: wired directly inside the mutation hooks
  (`useSaveReminder`/`useDeleteReminder`/`useImportMedia`), not at each call
  site, so every current and future caller gets the same confirmation for
  free. `useSaveReminder` distinguishes "created" vs "updated" wording off
  `variables.id` (present only when editing). Only success is toasted —
  existing failure UI (Dialogs/Banners) is left as the one error surface per
  flow rather than doubling up with a second, competing alert (MR-13 "no
  competing alerts"). This required moving `ToastProvider`'s own
  `useHaptics` import from the `../../hooks` barrel to a direct file import
  (`../../hooks/useHaptics`) — `useImportMedia` lives behind that same
  barrel and now imports `ToastProvider`, so leaving the barrel import in
  place would have created an import cycle.
**Consequence:** `npx tsc --noEmit`, full-project `eslint` (`--max-warnings=0`,
excluding the pre-existing unrelated `web/app.js` `curly` violations), and
`npm test` (44/44) all green. Not yet verified on a physical device this
slice — same no-device-connected constraint as DL-057/DL-058.

## DL-062 — `MainActivity` crashed on restore, silently swallowing a fired alarm

**Date:** 2026-08-09
**Context:** User report: "the alarm is not working" plus an already-timed-out
vibration. `adb shell dumpsys alarm`/the Room `occurrences` table both showed
the alarm actually fired exactly on schedule (`exactAllowReason=permission` —
`SCHEDULE_EXACT_ALARM` was genuinely granted) and `AlarmRingingService` ran in
the foreground for the full timeout window before self-stopping — so the OS
scheduling layer was never the problem. `adb logcat` instead showed a `FATAL
EXCEPTION` on `MainActivity`: `IllegalStateException: Screen fragments should
never be restored`, thrown from `react-native-screens`' `ScreenStackFragment`
constructor whenever Android recreates `MainActivity` with a non-null
`savedInstanceState` — exactly what happens when the process is frozen/killed
while an alarm rings (observed repeatedly in `am_app_frozen` logcat lines
around the same window) and the user then reopens the app from the launcher or
a notification. The crash meant the user could never actually get into the
app to see or interact with the fired alarm, even though it rang correctly.
**Decision:** `MainActivity.kt` never overrode `onCreate`, so it never applied
`react-native-screens`' documented Android setup requirement. Added:
```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
}
```
Passing `null` skips Android's own fragment-state restoration entirely — JS
re-derives the correct current screen from scratch on cold start regardless,
so nothing is actually lost by not restoring it the Android way.
`AlarmActivity` was checked and does not need the same fix: it extends
`AppCompatActivity` directly, not `ReactActivity`, and never hosts a
`react-native-screens` navigator.
**Consequence:** `./gradlew compileDebugKotlin`/`installDebug` both green;
installed to the connected device. Not yet re-verified against a real fired
alarm on-device (would require waiting for/triggering another occurrence) —
the fix itself is the single documented, standard remedy for this exact
`react-native-screens` exception, and the crash's stack trace matches it
exactly, so confidence is high without needing to reproduce the original
crash first.

## DL-063 — Reminder editor's media picker becomes a dedicated screen, not a text-list sheet

**Date:** 2026-08-09
**Context:** User request: replace the "choose media" dropdown (`MediaPickerSheet`
— a plain `Sheet` listing icon+title rows, no thumbnails, no preview) with a
full page that lets people browse thumbnails and preview/play before picking,
tapping an asset previews it rather than opening the media-editing page, and
picking one returns to the reminder editor automatically.
**Decision:**
- New `SelectMediaScreen.tsx` (route `SelectMedia`) reuses Library's own
  `LibraryGridBody`/`MediaCard` wholesale — real aspect-ratio-preserving
  thumbnails, the same search/kind-filter chips, the same empty/loading
  states and "Import media" empty-state action — so this screen looks and
  behaves like Library itself rather than a second, parallel implementation.
  `MediaCard` gained a `selected` prop (primary-color border highlight) so
  the already-chosen asset is visibly marked in the grid.
- Tapping a card opens `MediaSelectionPreviewModal.tsx` (new) instead of
  navigating anywhere: video/audio delegate to the existing
  `MediaPreviewPlayer` (which gained an optional `footer` slot, unused by
  its other two callers — Library and Media Detail — so their behavior is
  unchanged); image renders a full-resolution `<Image>` in the same
  black-chrome modal shell; text shows its kind icon (no fabricated content
  — matches how the rest of the app already treats text-kind media). Every
  variant has the same persistent "Use this" button.
- Confirming a selection calls
  `navigation.navigate({name: 'ReminderEditor', params: {mediaId}, merge:
  true})` — the standard React Navigation pattern for returning a value from
  a pushed screen without a non-serializable function-callback param (which
  would trigger "Non-serializable values were found in the navigation
  state"). This pops `SelectMediaScreen` and merges the picked id into
  `ReminderEditor`'s already-mounted route params.
  `ReminderEditorForm`'s existing `prefillMediaId` prop previously only
  seeded `mediaId` state once, via `useState`'s initializer (correct for the
  "arrived via MediaDetailScreen's Add reminder" case, since that only
  matters at mount) — a new `useEffect` on `prefillMediaId` now re-applies it
  on every change too, so the same prop doubles as both the initial prefill
  and the picker's live return value with no new params/props needed.
- `MediaPickerSheet.tsx` is deleted outright (not left unreachable) along
  with its now-orphaned `reminders.editor.noMediaBody` copy key; its
  `MEDIA_KIND_ICON` map (still needed by the "What" card's fallback avatar)
  moved into `ReminderEditorScreen.tsx` directly.
**Consequence:** `npx tsc --noEmit`, full-project `eslint`
(`--max-warnings=0`, excluding the pre-existing unrelated `web/app.js`
`curly` violations), and `npm test` (44/44) all green. Known, unchanged
limitation carried over from the sheet it replaces: `ReminderEditorForm`
resolves `mediaId` into a displayable `MediaSummary` via a capped
`useMediaList({limit: 200})` lookup, not a by-id fetch — an asset outside
that window (findable in the new picker's own, separately-filtered search,
which has no such cap) would set a valid `mediaId` the "What" card can't yet
render. Not fixed here: real library size today is nowhere near 200 items,
and the sheet it replaces had the identical cap with no way to exceed it at
all, so this is a pre-existing constraint made *reachable* rather than a
regression introduced by this change.

## DL-064 — Real notification-permission prompting, Settings alarm previews, and a `openCapabilitySettings` implementation

**Date:** 2026-08-09
**Context:** User asked for two things after DL-062/062: (1) the app should
proactively prompt for notification access at launch, the way most Android
apps do, rather than silently staying blocked forever once denied once with
no runtime dialog left to show; and every reminder Save while blocked should
re-remind the user to fix it. (2) Settings should let the user preview what
each of the three alert profiles (Gentle/Standard/Persistent) actually looks
and sounds like before assigning one to a real reminder.
**Decision:**
- New native `requestNotificationPermission()` (`MediaReminderModule.kt`):
  the first real caller of `PermissionAwareActivity.requestPermissions()` in
  this bridge — resolves `{granted: true}` immediately pre-API-33 or if
  already granted, otherwise shows the real OS dialog and resolves once
  answered. Wired end-to-end (native → `NativeMediaReminder.ts` →
  `MediaReminderClient.ts` → `CapabilityRepository` → new
  `useRequestNotificationPermissionOnLaunch`, called once from
  `StartupGate.tsx` right after the startup snapshot resolves, gated on the
  `notifications` capability item's status).
- `openCapabilitySettings(kind)` — previously a permanent
  `rejectNotImplemented` stub with no JS-side caller at all — is now real for
  `notifications` (`Settings.ACTION_APP_NOTIFICATION_SETTINGS`, the fallback
  once a permanent denial means the OS will never show the runtime dialog
  again) and `exact_alarm` (`Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM`).
  Threaded through the same repository/hook chain as a new
  `useOpenCapabilitySettings` hook. `ReminderEditorForm`'s Save handler now
  checks the `notifications` capability every time (not once, not cached, per
  explicit request) and — if blocked — shows a `Dialog` ("Save anyway" /
  "Open Settings") instead of saving immediately; "Save anyway" still
  completes the save, since a reminder is still a valid, useful Room row even
  without a working alert channel yet.
- Settings "Preview alarm styles": each of the three profile rows now shows
  its real description (`PROFILE_DESCRIPTION_KEY`, extracted out of
  `ReminderEditorScreen.tsx` into a new shared `profileDisplay.ts` — it was
  about to be needed in two files) plus a "Preview" button
  (`useScheduleTestReminder`, new). This required repurposing
  `scheduleTestReminder`: its old `mode: 'locked' | 'unlocked'` parameter had
  no real caller anywhere and, per its own doc comment, "every mode currently
  produces the same notification" — dead scaffolding for a feature that never
  landed. It now takes `{title, body, fullScreenWhenLocked}`, all supplied by
  JS (native still owns no display copy — MR-18) so the preview notification
  genuinely differs per profile instead of always being the same generic
  string. When `fullScreenWhenLocked` is true, the preview notification uses
  the same `setFullScreenIntent` a real Standard/Persistent alarm would,
  targeting `AlarmActivity` in a new no-session "preview mode"
  (`EXTRA_PREVIEW_TITLE`/`EXTRA_PREVIEW_BODY`): `loadSession` shows the given
  title/body directly instead of querying Room, hides Accept/Snooze/the
  "silence sound" overflow (none apply without a real session), and Dismiss
  just closes the screen. `AlarmActivity` needed no changes to its real,
  session-backed path — the preview branch returns before any of that code
  runs.
**Consequence:** `./gradlew compileDebugKotlin`/`testDebugUnitTest` green;
`npx tsc --noEmit`, full-project `eslint --max-warnings=0` (excluding the
pre-existing unrelated `web/app.js` `curly` violations), and `npm test`
(44/44) all green. Verified live on device that the underlying permission
mechanics are sound (`SCHEDULE_EXACT_ALARM` grant, exact-alarm firing) in
DL-062; the notification-permission prompt itself and the new Settings
preview flow were implemented and build-verified in this slice but not yet
exercised on-device end to end (session moved on to a much larger follow-up
request before that on-device pass happened).

## DL-065 — "Today" renamed to "Upcoming" and rebuilt as a 5-day occurrence view

**Date:** 2026-08-09
**Context:** Direct product request, with a reference screenshot: rename
"Today" to "Upcoming" everywhere it is user-visible, and turn the screen from
"each reminder's single next occurrence" into a real 5-day (today + 4)
chronological forward view, still built from the same real reminder data —
explicitly "do not create mock alarms, duplicate alarm records, or a second
source of truth."
**Decision:**
- **Rename, scoped correctly.** Only visible strings changed (`nav.today`,
  `today.title`, both still keyed `nav.today`/`today.title` — the request was
  explicit: "keep the existing internal route key" — so `tabRoutes.today`
  stays `'Today'`, every `testIds.today.*` id is unchanged, and the first
  date-section heading is still literally "Today" per "do not rename
  date-section headings." `TodayScreen.tsx` was renamed to
  `UpcomingScreen.tsx` (component `TodayScreen` -> `UpcomingScreen`) for
  future readers; nothing importing it needed to change beyond the two
  files that reference it directly (`TabNavigator.tsx`, the feature's own
  `index.ts`).
- **The 5-day list is a display projection, not a second scheduling
  engine.** `ReminderSummary` (the *list* endpoint's DTO — previously only
  `ReminderDetail`, the single-item fetch, carried `schedule`) now also
  carries each reminder's own `ScheduleRuleDto`
  (`ReminderDtoWriter.writeSummary`, one additive line — the rule entity was
  already being loaded there for `repeatSummary` anyway). New pure
  `projectUpcomingOccurrences.ts` walks 5 local-midnight-anchored days
  (built via the `(year, month, day, ...)` `Date` constructor, never
  millisecond addition, so month/year rollover and DST are handled by the
  constructor itself rather than by hand) and, per reminder, tests its rule
  against each day (`once`/`daily`/`weekdays`/`monthly`/`yearly`/`custom`,
  clamping day-of-month against the real days-in-month like the reminder
  editor's own Preview card already does). This is explicitly the same
  "local approximation for display only" category MR-08 already carves out
  for that Preview card — nothing computed here is ever written back into
  Room or a schedule call; the one real global alarm stays entirely
  native-scheduled. `LocalDate`/`LocalTime` values are parsed by splitting on
  the separator rather than via `new Date(string)`, which would silently
  treat a date-only string as UTC midnight and land on the wrong calendar
  day in a negative-UTC-offset zone.
- **Next-reminder card** now shows `occurrences[0]` (the earliest entry in
  the whole 5-day projection, already sorted) instead of the first pending
  item found in an unsorted-by-construction per-reminder list, with
  "Today at {time}" / "Tomorrow at {time}" / "{Weekday} at {time}" context
  text. **Rows drop the per-item "Upcoming" `StatusPill`** (redundant once
  the whole page is already named Upcoming — its 7 backing
  `today.occurrence.*` copy keys were removed as newly-orphaned, not left
  unreachable) and gain a play-preview `IconButton` for video/audio media.
- **"Preview sound" reuses `MediaPreviewPlayer`** (the same modal Library,
  the Reminders list and the reminder-editor picker already use) via one
  `previewReminder` state on this screen, rather than a new inline
  play/pause icon-swap control — this still satisfies "one shared preview
  controller," "no overlapping players," and "stops when leaving the page"
  for free (the Modal's own mount lifecycle already guarantees the last
  one), at the cost of not matching the spec's literal inline icon-swap
  interaction. Documented as a deliberate scope trade-off, not an oversight.
- **Refresh strategy**: `useFocusEffect` recomputes `now` (and therefore the
  whole projection) each time the screen regains focus — covers "returning
  to the page" and reasonably covers "app resumed after midnight," but there
  is deliberately no continuous in-foreground midnight-rollover timer (the
  feature's own "avoid unnecessary continuous timers" instruction, weighed
  against the added complexity of a wake timer for a screen that already
  refetches on focus/pull).
**Consequence:** 15 new unit tests for `projectUpcomingOccurrences`
(daily/weekdays/monthly/yearly/custom, month-boundary, leap-year
day-of-month clamping, past-occurrence exclusion, disabled/archived
exclusion, `needs_setup` inclusion, stable/unique ids, chronological sort —
all against a fixed injected `now`, never the real clock) plus 2
screen-level tests (heading reads "Upcoming" not "Today"; exactly 5 sections
render, each keeping its heading with "No alarms scheduled" when empty).
`npx tsc --noEmit`, full-project `eslint --max-warnings=0`, and `npm test`
(61/61) all green. `./gradlew compileDebugKotlin`/`testDebugUnitTest` green.
**Not yet verified on a physical device** — wireless ADB dropped mid-session
before `installDebug` could push this build; the APK is built and ready, it
just was not reachable to push.
**Explicitly deferred, not built in this slice** (flagged rather than
silently dropped): the per-alarm "Play in Silent / Do Not Disturb" setting
and its full permission-state machine (spec sections 8-9) — a genuinely
separate, safety-sensitive feature (new schema field, new editor UI, native
`NotificationManager` policy-access checks, `AlarmRingingService` behavior
changes) that deserves its own focused pass rather than being rushed
alongside a full screen rewrite; and the inline per-row play/pause icon-swap
interaction (see above — the shared full-screen preview modal was used
instead).

## DL-066 — Metro's `blockList` did not exclude other git worktrees on the same machine

**Date:** 2026-08-09
**Context:** Metro (the JS dev server this device's app fetches its bundle
from) crashed twice in a row while pushing DL-065's build — each time a few
seconds after reporting "Dev server ready," not immediately. The crash log:
`Error: ENOENT: no such file or directory, watch
'...\.claude\worktrees\upstash-plugin-install-804b6e\android\app\.cxx\...'`
— a different git worktree on this same machine (a separate, concurrent
Claude Code session actively running its own native build there) deleted or
recreated a directory while this tree's Metro was still crawling/watching
it, and Metro's file watcher throws an *unhandled* error on that race rather
than logging and continuing — taking down the whole dev server, not just
that one watch. This is the same root-cause *shape* `metro.config.js`'s
existing `blockList` comment already documents for `android/build` (Windows'
watcher choking on someone else's churning build output), just triggered by
a different tree instead of this one's own.
**Decision:** Added `/\.claude\/worktrees\/.*/` to `blockList` — this tree's
Metro has no legitimate reason to watch anything under a sibling worktree at
all (each worktree either runs its own Metro on its own port, or isn't
running a JS dev server at that moment), so the fix is a blanket exclusion
of the whole directory rather than trying to enumerate every
build/`.cxx`/`.gradle` subpath a concurrent session's build might touch, the
way the existing `android/build` entries do for this tree's own output.
**Consequence:** Restarted Metro after the fix and confirmed it stayed
healthy (`/status` still 200) 15 seconds after start, past the point both
prior crashes occurred at. Not a complete guarantee against every possible
future race with a concurrent session's build — only a targeted fix for the
one directory pattern that has now caused it twice.

## DL-067 — `main` was 14 commits behind the actively-developed branch

**Date:** 2026-08-10
**Context:** A repo-wide audit (checking every local/remote branch and every
`.claude/worktrees/*` checkout for uncommitted or unmerged work) found `main`
had not moved since `claude/app-testing-8d62fc`'s merge — every commit from
the media-library build-out through DL-065's Upcoming rename existed only on
`claude/recover-uncommitted-ui-work`, which had zero divergence from `main`
(14 commits ahead, 0 behind). Every other stale branch/worktree (`claude/
elastic-banach-bd5254`, `claude/missing-changes-after-install-516369`,
`claude/remote-control-22fe65`, the `upstash-plugin-install-804b6e` worktree)
had a clean working tree and no unique commits — nothing else was at risk of
being lost. `claude/apk-download-webpage-8f855b` (3 commits, a live-clock
animation for the `web/` GitHub Pages download page) diverged from `main` by
5 commits and was left alone — it is not app code and merging it was out of
scope for this pass.
**Decision:** Fast-forwarded `main` to `claude/recover-uncommitted-ui-work`
(`git merge --ff-only`, safe since `main` was a strict ancestor — no rebase
or history rewrite). Also added `android/.kotlin/`/`android/app/.kotlin/`
(the Kotlin compiler daemon's cache directory, never previously excluded) to
`.gitignore`.
**Consequence:** `main` now carries every feature landed this cycle. No
history was rewritten and no other branch's work was touched.

## DL-068 — Guarded notification posting and migrated the alarm activity's back gesture

**Date:** 2026-08-10
**Context:** `./gradlew lintDebug` has hard-failed on the same 5 errors since
DL-041 (`KNOWN_ISSUES.md`/`TODO.md`): three unguarded `manager.notify()`
calls in `NotificationCoordinator.kt` (`MissingPermission` — `POST_NOTIFICATIONS`
can be revoked post-grant on API 33+, which would otherwise throw
`SecurityException`, not just silently no-op), plus `AlarmActivity.kt`'s
deprecated `onBackPressed()` override (`MissingSuperCall` +
`GestureBackNavigation`).
**Decision:** Added a single private `NotificationCoordinator.postNotification()`
that checks `ContextCompat.checkSelfPermission` before calling
`NotificationManagerCompat.notify()` (lint's data-flow check recognizes this
exact guard pattern) and routed all three call sites through it, rather than
annotating each with `@SuppressLint`. Migrated `AlarmActivity`'s Back handling
to `OnBackPressedDispatcher`/`OnBackPressedCallback`, per the housekeeping
item already tracked to do both fixes together (the dispatcher migration is
what future-proofs the same code path if predictive back is ever enabled).
**Consequence:** All 5 lint errors are fixed at the source, not suppressed.
A revoked notification permission after grant now degrades to "notification
silently not shown" (already an accepted, documented outcome elsewhere in
this codebase) instead of crashing the receiver/service that posts it.

## DL-069 — Due-alarm notifications no longer duplicate the reminder label

**Date:** 2026-08-10
**Context:** `KNOWN_ISSUES.md`'s "Open — Medium" list carried this since
before media import existed: `AlarmDispatchReceiver`/`AlarmRingingService`
passed `reminder.label` as both the notification's title *and* body, because
`mediaTitle` had nothing real to source from yet. Media import has been real
since DL-053; every `ReminderEntity.mediaId` is now a live foreign key.
**Decision:** Added `AlarmNotificationText.resolveBody()` (`alarm/` package):
looks up the linked `MediaAssetEntity` and uses its `title` as the
notification body, falling back to `RepeatSummaryFormatter`'s plain-language
schedule summary (already used for `AlarmActivity`'s own repeat-summary text)
if the media row is ever missing, and only as a last resort `reminder.label`
again. Wired into both call sites that build the due notification
(`AlarmDispatchReceiver.dispatch`, `AlarmRingingService.promote`) plus the
in-app foreground event payload.
**Consequence:** A due alarm's notification now reads, e.g., title "Take
medication" / body "beach_sunset.mp4" (or "Every day at 8:00 AM" if the
media row can't be read) instead of the same string twice.

## DL-070 — Wired the two remaining dead "Export"/"Share" buttons to real OS actions

**Date:** 2026-08-10
**Context:** An audit of Settings/Library/Backup for "every function serves
its real purpose" (nothing that looks actionable but silently no-ops) found
two: Media Detail's "Export this item" (`MediaDetailContent.tsx`,
`onPress={() => undefined}`) and the Backup success screen's "Share"
(`BackupScreen.tsx`, same). Library's bulk "Export selected" already had a
real native implementation (`MediaLibraryService.buildExportIntent`,
DL-061) that the single-item button simply never called; Backup's "Share"
had no native counterpart at all — `BackupExporter` writes the archive but
nothing ever built a share `Intent` for it.
**Decision:** `MediaDetailContent`'s Export button now calls the existing
`useExportMedia()` mutation with a one-item array — no new native code
needed. For Backup, added `BackupExporter.buildShareIntent(fileName)`
(`ACTION_SEND` + `FileProvider` content URI, scoped to files inside its own
`exportDirectory()` with a canonical-path containment check against
traversal, since `fileName` is bridge input) and a new
`shareBackupExport(fileName)` bridge method/JS client/repository method,
following `exportMediaAssets`'s existing shape exactly (same
`currentActivity`-required, fire-and-forget chooser launch).
**Consequence:** Both buttons now do what their label says. No new
permission or manifest entry was needed — `FileProvider` and the `backups`
`external-files-path` grant already existed for exactly this purpose
(`file_paths.xml`'s own doc comment anticipated it).
