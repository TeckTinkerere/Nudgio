# Nudgio iPhone — first native milestone

This is the P0/P1 feasibility target from the [approved plan](../docs/plans/2026-09-27-iphone-v1-implementation-plan.md). It is **not yet the production reminder app**. It has native forms in the approved brand, real AlarmKit calls, system Stop/Snooze, a native Open intent and a countdown extension. It contains no React Native/JavaScript runtime, which makes action independence directly testable. The full React Native shell, Core Data, media and backup follow G1.

## Build on a Mac

Prerequisites: stable Xcode with iOS 26 SDK or newer, Xcode command-line tools selected, XcodeGen 2.44 or later, and Node 20.19+. No CocoaPods or npm installation is required for this standalone native milestone. Use `xcodebuild -version`, `swift --version` and `xcodegen --version` to record the actual versions. Windows cannot compile these Apple frameworks.

From the repository root:

```sh
node scripts/ios/check-source.cjs
node scripts/ios/prepare.cjs
open ios/NudgioFeasibility.xcodeproj
```

Select the **NudgioFeasibility** scheme. Choose your development team for both the app and countdown extension, and use a matching unique pair of bundle identifiers if Apple's provisioning rejects the development defaults. No team or production identifier is committed. Choose the connected iPhone, enable Developer Mode if requested, and Run. The app is named **Nudgio Test** to distinguish it from Android and a future production app.

For unsigned simulator compilation and unit tests, select an installed iOS 26+ simulator:

```sh
xcodebuild -list -project ios/NudgioFeasibility.xcodeproj
xcodebuild -showdestinations -scheme NudgioFeasibility -project ios/NudgioFeasibility.xcodeproj
xcodebuild test -project ios/NudgioFeasibility.xcodeproj -scheme NudgioFeasibility -destination 'platform=iOS Simulator,id=YOUR_SIMULATOR_UUID' -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO
```

Simulator tests do not establish physical alarm reliability. Use a Release configuration with signing on a real phone for G1. Do not publish this feasibility app or claim signed build success until it has actually compiled and run. No release app icon or distribution setup is included yet.

## First device check

1. Open the app: it should not request permission automatically.
2. Tap Allow test alarms; record both allow and deny/recovery cases.
3. Choose a one-time test at least two minutes ahead, select Snooze and schedule. Confirm it appears in Registered tests.
4. Lock the phone. Verify the alarm, Stop and Snooze. Inspect the countdown presentation. Reopen the app to compare actual registrations; do not infer delivery from an elapsed timestamp.
5. Repeat with Open reminder. Confirm the native synthetic content screen opens and the current alarm stops. No attachment or playback is included in this milestone.
6. Schedule a daily/weekday test and confirm Stop/Open do not remove future recurrence. This requires waiting through recurrence, not merely seeing a row.
7. Cancel each test explicitly when finished, including the extra capacity slot. Recurring tests otherwise remain registered in iOS.

Use the [G1 evidence sheet](../docs/ios/evidence/G1-platform-capabilities.md). Same-ID editing, injected crashes, DST preview, media protection and full capacity stress remain additional work; this harness does not claim to prove them by existing.

## Design and boundaries

- Native SwiftUI Form, system navigation/pickers, dynamic text, dark/light colours and generic lock-screen copy. No fake finished tabs or inert product controls.
- Only test IDs in a reserved namespace can be stopped or cancelled by the command service. No automatic replacement/eviction at capacity. An extra one-time slot can probe OS capacity.
- System Stop and system countdown Snooze remain native; Open stops only an observed current alert. G1 must validate duplicate-intent and occurrence races on device before production use.
- No account, sync, networking, telemetry, media capture, database or archive changes. No App Group, background mode or push entitlement. The alarm permission is scoped to the new test app.
- No installed dependencies, Android source or release APKs are changed by this target. XcodeGen is a Mac-only development dependency; generated Xcode output is ignored.
