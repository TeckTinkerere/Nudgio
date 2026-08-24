# Settings contract

Every user-facing setting in Nudgio, what it is supposed to change, and
where that change is actually honored. A setting is only "done" when there
is a named consumer for it — a control that writes a value nothing reads is
worse than no control at all, because it silently teaches the user their
choice does not matter.

**Rule for adding a setting:** do not merge a control without filling in its
*Honored by* column with a real file. If you cannot name one, the setting is
not finished.

## Preferences (`PreferencesSnapshot`, persisted natively)

| Setting | Control | Honored by | Status |
| --- | --- | --- | --- |
| `themePreference` | Settings → Appearance, segmented control | `ThemeProvider` via `useAppearanceSettings` | Works |
| `useMaterialYou` | Settings → Appearance, toggle | `buildTheme` / `schemeFromDynamicColor` | Works |
| `use24HourTime` | Settings → Reminder defaults, toggle | `formatLocalTime` (Upcoming), `formatTimeParts` (Reminders list) | Works — control added 2026-08-24; the Reminders list separately hardcoded `hour12: true` and ignored it until the same pass |
| `defaultSnoozeMinutes` | Settings → Reminder defaults, chips | `ReminderEditorScreen` seeds a new reminder's snooze from it | Works — until 2026-08-24 the editor seeded from `appConfig.snooze.presetMinutes[1]`, so this control changed nothing |
| `hasCompletedOnboarding` | Not user-facing (written by Onboarding) | `RootNavigator` initial route | Works |
| `languageTag` | **No control** | `Intl.DateTimeFormat` calls across Upcoming/editor | Intentionally unexposed: only `en` exists in `src/localization/resources/`. Add the control with the second locale, not before |

## View state (local, not native preferences)

| Setting | Control | Honored by | Status |
| --- | --- | --- | --- |
| `strongerHaptics` | Settings → Accessibility, toggle + Preview | `useHaptics.trigger` → `HapticsService.vibrate(pattern, stronger)` | Works |

## System-derived (read-only, surfaced not set)

| Item | Where shown | Source | Status |
| --- | --- | --- | --- |
| Reduce motion | Settings → Accessibility, status pill | OS `AccessibilityInfo`, via `theme.a11y.reduceMotion` | Works — correctly read-only; the OS owns it |
| Font scale | Settings → Accessibility, helper text | OS, via `theme.a11y.fontScale` | Works — read-only |
| Capability rows (notifications, exact alarm, full-screen intent, channels, battery, scheduler) | Health screen, Onboarding page 3 | `CapabilitySnapshotProvider` (native) | Works — each row's action either opens the real OS dialog or deep-links to the right Settings page. Re-read on every foreground return, since Android emits no change broadcast |

## Navigation rows (no stored value)

| Row | Destination | Status |
| --- | --- | --- |
| Health | `HealthScreen` | Works |
| Statistics | `StatisticsScreen` | **Screen is fixture data** — see below |
| Backup / Export | `BackupScreen` | Works (real `beginExport` + share) |
| Import / Restore | `ImportScreen` | Works (real `pickDocument` + `inspectBackup` + `commitImport`) |
| About | `AboutScreen` | Works (real versions from `StartupSnapshot`) |
| Alarm style previews | Schedules a real short-delay alarm per profile | Works |

## Known gap

**Statistics is `mockStatistics`.** The screen renders fixture data, so
every number on it is invented. It is the one remaining place where a
surfaced value does not reflect the user's own data. Closing it needs a new
Room aggregation over `occurrences` (state + day bucketing, timezone-safe
day boundaries) plus a bridge method — sized as its own slice, not a patch.
Until then it must not be presented as real.
