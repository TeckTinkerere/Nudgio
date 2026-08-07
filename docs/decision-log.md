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
