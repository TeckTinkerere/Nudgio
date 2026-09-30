# ADR-IOS-001 — Start the iPhone edition with a native feasibility target

Date: 2026-09-28. Status: Accepted implementation direction following the user's approval and instruction to start the iPhone app. Platform behaviour remains unverified.

## Decision

Execute P0/P1 of the approved iPhone implementation plan before P2–P9. Add an isolated SwiftUI iOS 26 feasibility application and countdown widget under `ios/`. This is an engineering target, not the production React Native shell. Its native alarm path intentionally has no React Native dependency. React Native remains the chosen production UI after gate G1; Core Data and the generated Swift adapter belong to P3.

ADR-002's Android-only scope remains binding on the Android edition and is extended for this separately scoped iPhone edition. ADR-003/004/005/006/008/012/015/017 describe Android mechanisms and are not transplanted into iOS. All Android runtime files remain unchanged by this milestone. Other platform-independent privacy and explicit-play principles remain in force.

Use AlarmKit system schedules, authorization, Stop and countdown Snooze. Custom Open explicitly stops the current alert and routes to native synthetic content. No media autoplays. No JavaScript, polling, background refresh, push, silent audio, cloud, sync, account or payment system is added. Generic test titles contain no personal information.

Use XcodeGen as a Mac development tool to generate reviewable Xcode targets from a checked-in specification. No runtime dependency is added. A development bundle identifier is supplied for local builds; Apple team and production identifier remain unresolved. Generated projects/builds and signing credentials are excluded from source control.

## Data and compatibility

The feasibility target creates only synthetic AlarmKit registrations in a reserved UUID namespace. It does not create a product database, archive format or migration. Enumeration is the authority; errors never turn into an empty-success list. The app permits explicit cancellation of its own synthetic IDs only and never evicts an existing alarm to schedule another. Capacity errors remain visible. Test creation is limited to one pending operation across actor reentrancy.

## Gate and rollback

Mac compilation, native XCTest execution and signed iPhone tests are required before claiming P0/P1 complete. `evidence/G1-platform-capabilities.md` records every unverified case. User confirmed an iPhone will be available later; Mac/Xcode access is not confirmed. The Windows workspace can validate source configuration, not AlarmKit operation. Rollback removes this independent target after cancelling its test alarms; no Android data conversion is involved.

## Sources

- [Apple scheduling sample](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit)
- [AlarmKit introduction and actions](https://developer.apple.com/videos/play/wwdc2025/230/)
- [XcodeGen project specification](https://github.com/yonaskolb/XcodeGen/blob/master/Docs/ProjectSpec.md)

Reviewed 2026-09-28. Exact SDK signatures still require the Mac build gate.
