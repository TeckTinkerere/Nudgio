# Flutter migration: what only the owner can do

**Date:** 23 Oct 2026 (end of phase F0, DL-120)

These need your accounts, money, hardware or acceptance of terms. Nothing in
F1-F5 (Android) is blocked except item 1.

| # | When | Item | Why |
|---|---|---|---|
| 1 | Before F1 starts | Run `fvm flutter doctor --android-licenses` and accept the Android SDK licenses, then re-run `fvm flutter doctor` | It is the only Android item `flutter doctor` flags. Accepting licenses is your decision, not an agent's |
| 2 | Before F1 starts | Put `%LOCALAPPDATA%\fvm-cli\fvm` on your user `PATH` (or reinstall FVM from an elevated shell with `choco install fvm`) | FVM 4.3.2 was installed as a standalone exe without admin rights; it is not on `PATH` yet |
| 3 | Now, then every release | Keep 2FA on the GitHub account and the release keystore backed up offline (SEC-07, DL-119) | The Flutter v3.0.0 APK must be signed with the same key, or existing users cannot update |
| 4 | Before F5 (≈ 10 weeks in) | Keep a Pixel-class phone and one aggressive-OEM phone for the F5 device matrix and upgrade test from v2.3.4 | The cutover test needs real data on a real device |
| 5 | Before F6, deferred by choice | Decide the Apple Developer enrolment (individual, USD 99/yr, or organization with a D-U-N-S number) | Parked with the iPhone track (DL-120). Organization enrolment takes weeks, so decide at least a month before F6 |
| 6 | Before F6, deferred by choice | Arrange Mac access: a physical Mac on macOS with Xcode for iOS 26 (AlarmKit), and optionally a macOS CI runner | Needed for G1 device tests and all Swift work |
| 7 | Before F6, deferred by choice | An iPhone on iOS 26 or later for G1 | AlarmKit cannot be tested in the simulator alone |
| 8 | Before F6 | Register the bundle ID `com.aslam.nudgio` under the chosen Apple team | Reserves the decided identifier |
