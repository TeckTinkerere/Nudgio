# Building and testing the iPhone app without a Mac

Nudgio's iPhone app (`ios/Runner` + `ios/NudgioKernel`, DL-122) needs Xcode to
compile, and Xcode only runs on macOS. This page lists what works from a
Windows machine, cheapest first. Nothing here changes the G1 rule: alarm
behaviour on a locked phone is only proven on a real iPhone.

## 1. Every push: GitHub Actions (free, already set up)

The `CI` workflow (`.github/workflows/ci.yml`) runs on every push to `main` or
`feat/flutter-**` and on every pull request. GitHub's hosted macOS runners are
free for public repositories.

| Job | What it proves |
|---|---|
| `NudgioKernel swift test (Linux)` | The kernel's logic: schedules and DST, validation, store, media import, folders, the host contract |
| `iOS simulator build and tests` | The AlarmKit/UIKit code compiles; kernel tests pass on an iOS 26 simulator; the Flutter app builds; `integration_test/` passes on the simulator, end to end through the Swift kernel |

Artifacts on each run (Actions → the run → **Artifacts**):

- `Nudgio-ios-simulator`: `Runner.app` for the iOS simulator.
- `Nudgio-ios-unsigned`: `Nudgio-unsigned.ipa`, a device build with no
  signature (see section 3).

To read a failure from the terminal:

```bash
gh run list --branch feat/flutter-f1-f2 --limit 5
```

```bash
gh run view --log-failed
```

## 2. Click through the UI in a browser (simulator, free tier)

Browser simulator services such as Appetize.io run a simulator `.app` in a
web page. Upload the zip from the `Nudgio-ios-simulator` artifact. This is
good for checking screens, navigation, Dynamic Type and dark mode. It cannot
show a real lock-screen alarm, and the upload goes to a third party, so use
it for builds with no personal data.

## 3. On a real iPhone, from Windows

You need an iPhone on iOS 26 (AlarmKit) and an Apple ID.

**a. Free Apple ID, re-signed on Windows (no fee, 7-day installs).**
Tools such as Sideloadly run on Windows, take an unsigned `.ipa` and sign it
with your own Apple ID's free "Personal Team" certificate. Download
`Nudgio-unsigned.ipa` from the CI artifacts, sign and install it, then trust
the developer profile in Settings → General → VPN & Device Management.
Limits: the app stops opening after 7 days until you re-sign it, and Apple
caps free installs. This is enough for the G1 device cases in
`docs/ios/evidence/G1-platform-capabilities.md`. These are third-party tools:
check what you install, and use an Apple ID you are comfortable signing with.

**b. Apple Developer Program (paid yearly) + TestFlight.**
Needed for anything beyond personal testing, for external testers and for the
App Store (plan F8). Signing then runs in CI with an App Store Connect API key
stored as repository secrets, or on a hosted iOS CI service with a free
monthly macOS allowance (for example Codemagic), which can manage signing and
upload to TestFlight for you. Install TestFlight on the iPhone and the build
arrives there.

## 4. When you need Xcode itself

Some things need an interactive Xcode: the debugger on a device, Instruments,
first-time capability setup in the Apple developer portal. Rent a cloud Mac by
the hour or day (several providers offer hosted macOS, including AWS EC2 Mac
with a 24-hour minimum), clone the repository, and follow `ios/README.md`.

## What is and is not covered without a device

| Area | Without an iPhone | Needs an iPhone (G1) |
|---|---|---|
| Kernel logic, contract, DTOs | Linux + simulator CI | |
| Flutter ↔ Swift channel | Simulator integration test | |
| AlarmKit scheduling calls | Compiles; simulator accepts registrations | Ringing, Stop/Snooze/Open on a locked phone |
| Capacity (how many alarms iOS allows) | | G1-09 |
| Pickers, Photos, share sheet | Compile only | Manual check |
