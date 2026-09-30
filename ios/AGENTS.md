# iPhone implementation boundary

Read `docs/ios/ADR-IOS-001.md`, the approved iPhone plan and `docs/ios/evidence/G1-platform-capabilities.md` from the repository root before changing this target.

- This directory currently contains the isolated P1 SwiftUI/AlarmKit feasibility app, not the production React Native shell.
- Do not claim P0/P1 complete without a Mac build, native test execution and signed physical-iPhone G1 evidence. Do not fabricate device results from unit tests.
- Use `project.json` as the XcodeGen source. Generated Xcode projects, plists, builds and signing material are ignored. Production bundle identity/team are not established by the development defaults.
- AlarmKit owns delivery, Stop and countdown Snooze. No polling, idle audio, background-refresh delivery, push, account or sync.
- Never replace another test or real alarm to satisfy a capacity request. Stop current alert and cancel future repeats are distinct operations.
- No product persistence or media archive exists at this milestone. Add the P3 Core Data/bridge ADR and tests before introducing production data.
- Preserve Android source, stored data, build/signing rules and the approved Ink & Apricot brand.
