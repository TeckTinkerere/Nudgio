# AGENTS.md - Nudgio

Read `specs/Markdown/00_Document_Map_and_Executive_Summary.md`, `specs/Markdown/17_Architecture_Decision_Records.md`, and the relevant rows in `specs/Markdown/21_Requirements_Traceability_and_Acceptance_Catalog.md` before changing code. Also read `docs/decision-log.md` for implementation-level decisions made since the spec pack was written.

## Hard rules

- Android-only v1, package `com.aslam.mediareminder`.
- React Native handles normal UI; Kotlin owns alarms, actions, Room, scheduling, ringing, boot recovery and resilient due playback.
- No backend, account, analytics, ads or production Internet permission.
- No overlay, broad gallery permission, battery-exemption request, idle service, clock polling, repeating alarm or WorkManager due delivery.
- Schedule one globally earliest one-shot alarm.
- Full-screen only when locked/non-interactive and eligible. Unlocked uses a normal high-importance notification without FSI.
- Play/Snooze/Dismiss and sound stop must work without React Native. Media starts only after Play.
- Room/app-owned files are source of truth. Media and archives are streamed, validated, journaled and bounded.
- Backups are logical versioned ZIPs; never raw DB; validate before mutation and preserve rollback.
- New permission, schema, archive field, background component or architectural dependency requires specs/tests and usually an ADR.
- Build APKs only from the primary checkout, never a `.claude/worktrees/*` one, and only from a clean tree that is up to date with `origin/main`. A worktree has its own working directory, so a build started there silently omits every uncommitted change sitting in the primary checkout — which is how a release APK once shipped without a whole slice of finished work. Requires JDK 17+ on `JAVA_HOME` (Gradle refuses to start on 11).

## Completion report

Return requirement IDs, behavior, files, exact tests/results, migration/compatibility, permission/privacy/battery/a11y impact and residual risk. Do not claim completion with failing or skipped required evidence.

The full loop prompt is in `MASTER_LOOP_PROMPT.md` and MR-19.
