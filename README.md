# Nudgio

Offline-first Android adaptive media alarm. React Native UI over a Kotlin
reliability core. No backend, no accounts, no analytics, no ads, no Internet
permission — everything works from local storage.

Package: `com.aslam.mediareminder`

## Start here

1. [`specs/Markdown/00_Document_Map_and_Executive_Summary.md`](specs/Markdown/00_Document_Map_and_Executive_Summary.md) — what every other document covers.
2. [`specs/Markdown/17_Architecture_Decision_Records.md`](specs/Markdown/17_Architecture_Decision_Records.md) — the binding decisions (ADR-001 through ADR-021).
3. [`specs/Markdown/21_Requirements_Traceability_and_Acceptance_Catalog.md`](specs/Markdown/21_Requirements_Traceability_and_Acceptance_Catalog.md) — requirement IDs and acceptance criteria.
4. [`AGENTS.md`](AGENTS.md) and [`docs/decision-log.md`](docs/decision-log.md) — hard rules and implementation-level decisions made while building against the spec.

The full pack (23 documents, diagrams, generated PDFs) lives under
[`specs/`](specs/). PDFs are generated from the Markdown originals — edit the
Markdown, never the PDF.

For the code itself (not the spec): [`ARCHITECTURE.md`](ARCHITECTURE.md) maps
how `src/` and `android/` are actually organized, and
[`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) covers day-to-day
conventions. [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md),
[`docs/FUTURE_IMPROVEMENTS.md`](docs/FUTURE_IMPROVEMENTS.md),
[`TODO.md`](TODO.md) and [`docs/APK_RELEASE_CHECKLIST.md`](docs/APK_RELEASE_CHECKLIST.md)
track what's fixed, what's missing, and what a real release still needs.

## Repository layout

```text
android/            Kotlin reliability core: alarms, Room, notifications, backup, bridge
src/
  app/               composition root — DI container, providers, navigation, bootstrap
  design-system/     tokens, theme (brand + Material You), icons, layout, components
  core/              errors, result type, logging, config, storage, repositories, services, state
  native-client/     typed TurboModule bridge (MediaReminderClient) + mock for tests/Metro-only dev
  features/          today, library, reminders, settings, onboarding — one folder per screen area
  hooks/             shared hooks bridging core + design-system to features
  localization/      MR-13 string resources and formatting
  constants/         routes, test IDs, external links
  utils/             pure formatting/helper functions
  testing/           renderWithProviders(), createTestContainer()
specs/               the source-of-truth pack (Markdown, Diagrams, PDFs, QA, Sources)
docs/                decision log and contributor-facing notes not in the spec pack
fixtures/            synthetic media/backup fixtures (never real user data — MR-18)
scripts/             build, schema, checksum and release tooling
```

## Product baseline

Android-only v1; React Native 0.86.x UI with a Kotlin native reliability
core; Room/app-specific files own reminders and media (not yet implemented —
see [`docs/decision-log.md`](docs/decision-log.md) DL-004); one globally
earliest `AlarmManager` event; locked full-screen only when eligible;
unlocked system notification; no backend, no Internet permission, no
overlay, no persistent idle service; logical checksummed ZIP migration.

## Getting started

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run android
```

`cd android && ./gradlew test lintDebug` requires a local Android SDK/JDK 17
— not available in every environment (see DL-004 for what has and has not
been build-verified).

## Document precedence

Platform safety/policy -> ADRs -> Android/Data/Backup specifications ->
PRD/Feature -> UX/Design -> implementation notes. See MR-00 for the binding
governance rule.
