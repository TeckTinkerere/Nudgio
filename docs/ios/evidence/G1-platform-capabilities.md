# G1 iPhone platform evidence

Status: **UNVERIFIED — source implementation started; no Mac compilation or device execution yet.**

Date: 2026-09-28. User expects access to an iPhone later. Mac/Xcode access, Apple team, phone OS and signed build remain unconfirmed. Never change a row to PASS based on source inspection or mocked tests.

## Record before execution

- Code commit and clean working-tree status:
- Device model / iOS version and build:
- Mac / macOS / Xcode / Swift / XcodeGen versions:
- Scheme / configuration / bundle identifier / signed app build:
- Tester and date:
- Supporting screenshot/video/test-result paths (keep personal data out of Git):

## Required observations

| Case | Requirement | Source support / next action | Actual observation | Result |
|---|---|---|---|---|
| G1-01 Once / daily / weekdays | IOS-006 | Native schedule picker; observe at least two recurring events without reopening | Not run | UNVERIFIED |
| G1-02 Allow / deny / revoke | IOS-005 | Contextual request, Settings, foreground refresh; test all transitions | Not run | UNVERIFIED |
| G1-03 Stop / Snooze without JS | IOS-007/009 | System actions and countdown extension; no JS in test target | Not run | UNVERIFIED |
| G1-04 Open locked / unlocked | IOS-015/020 | Custom intent stops current alert, native synthetic screen; no private media yet | Not run | UNVERIFIED |
| G1-05 Duplicate Open / recurrence | IOS-007/012 | Current-state stop guard; validate delayed duplicate/next-occurrence race | Not run | UNVERIFIED |
| G1-06 Edit / cancel / crash recovery | IOS-010/011 | Cancel + enumeration implemented; same-ID edit and crash-journal proof not implemented | Not run | UNVERIFIED |
| G1-07 Lifecycle / system settings | IOS-006/021 | Test Focus, silent, low power, kill, force-quit, reboot/unlock, Live Activities denied | Not run | UNVERIFIED |
| G1-08 Timezone / DST / manual clock | IOS-004/018 | Native local schedule; preview and DST fixture proof not implemented | Not run | UNVERIFIED |
| G1-09 Capacity / collisions | IOS-017/026 | 20 reserved base slots + extra once slot; no auto-eviction; record real OS errors and overlapping controls | Not run | UNVERIFIED |
| G1-10 Native content / protection | IOS-008/015/027 | Synthetic native screen only; imported/protected media not implemented | Not run | UNVERIFIED |
| G1-11 Accessibility / appearance | IOS-023/024 | SwiftUI semantic controls; run VoiceOver, large text, dark mode and landscape | Not run | UNVERIFIED |

## Automated evidence

- 16 native XCTest cases authored for validation, deny handling, namespace, capacity preservation, confirmation and Stop versus Cancel. **Not executed** until Mac/Xcode is available.
- `node scripts/ios/check-source.cjs`: PASS, exit 0; project configuration/source membership/privacy guards, 10 Swift files and 16 authored native tests. This check does not parse or compile Swift.
- `node scripts/ios/prepare.cjs` on Windows: expected exit 1 with explicit macOS/Xcode requirement. No project or build generated.
- `npm run typecheck`: PASS, exit 0.
- `npx --no-install eslint scripts/ios/check-source.cjs scripts/ios/prepare.cjs --max-warnings=0`: PASS, exit 0.
- Android runtime regression checks: this milestone adds only isolated native iOS/tooling/docs files; it does not modify Android or shared React Native code.

P0/P1 are not complete until their required native and device evidence passes. P2–P9 remain deferred. Sync and payments remain out of scope.
