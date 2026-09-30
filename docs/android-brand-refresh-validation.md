# Android Ink & Apricot refresh — 2026-09-27

## Delivered source changes

- Default light and dark palettes use ink blue, warm ivory and apricot. Selected tabs/segments use blue; warning and error states retain dedicated accessible colour pairs.
- Native alarm colours, artwork scrim and existing launcher icon match the brand. The logo geometry is unchanged; `gemini-logo-prompt.md` is a separate creative brief.
- Existing Material You opt-in remains available. No stored preferences are reset.
- Main files: `src/design-system/tokens/palette.ts`, theme schemes/roles/Material You adapter, `AppTabBar.tsx`, `SegmentedControl.tsx`, Android resources under `android/app/src/main/res`, MR-04 and shared brand guidelines.

## Requirements and compatibility

MR-04 defines the colour system. MR-21 ACC-001 (semantics), ACC-002 (target sizes), ACC-003 (alarm focus), ACC-004 (announcement) and ACC-005 (direct action alternatives) are preserved by this colour-only change; their full device acceptance is not re-certified here. Contrast assertions cover defined light/dark/alarm and dynamic theme pairs. Native palette tests compare duplicated Android roles with React Native values.

No database or archive migration, new dependency, permission, network access, data collection, scheduling or battery behaviour change. Existing reminders and backup compatibility are unaffected by the changed resources. Touch targets, labels and action handlers are unchanged.

## Exact verification

| Check | Result |
|---|---|
| `npm run verify` | Exit 0: TypeScript and ESLint passed; 12 Jest suites, 63 tests passed. Parser notices and a forced worker-exit warning were printed. |
| `npm test -- --runInBand` on final source | 12 suites, 63 tests passed; open asynchronous handle prevented natural exit, so the process was interrupted after reporting results. |
| `./gradlew.bat :app:processDebugResources --console=plain` | BUILD SUCCESSFUL; 108 tasks, 13 executed, 95 up-to-date. Per-command JAVA_HOME used installed JDK 23 after inherited JDK 11 failed. Gradle deprecation notices remain. |
| `git diff --check` | Exit 0; only Windows line-ending notices. |

The native check validates resources; it does not produce a release APK or prove device appearance. No physical-device/emulator visual, TalkBack, wallpaper-theme, native alarm or launcher acceptance run was performed. These checks remain required before releasing the recolour. The test open-handle warning remains unresolved. iPhone implementation and cross-device sync have not started.

No `.next` or `node_modules` files were edited or included. Existing unrelated `sign-apk-commands.txt` and `web/downloads/` were left untouched. The lean-ctx executable allowlist was extended with `gradlew.bat` to run the resource check; no existing entries were removed.
