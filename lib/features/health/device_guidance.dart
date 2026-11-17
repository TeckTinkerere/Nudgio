/// Phone-maker troubleshooting for alarms that do not arrive (DL-124).
///
/// Some makers stop apps the user has not opened for a while, on top of
/// Android's own battery rules, and a reminder app is the first casualty.
/// MR-06 allows saying so: "OEM troubleshooting is optional,
/// manufacturer-specific guidance is clearly labeled, and Test reminder is
/// preferred over asking for unrestricted background operation."
///
/// So this is words only. Native names the maker
/// (`CapabilityItem.guidanceKey`); nothing here opens a settings page or asks
/// for an exemption (AND-017), and Health shows it under a "test first" line.
///
/// The copy is English and lives here until the app's string resources
/// arrive with the screens (plan F3/F4); the keys are already stable.
library;

import '../../native/types.dart';

const guidanceKeyPrefix = 'capability.batteryEnvironment.guidance.';

/// The capability kind the guidance rides on.
const batteryEnvironmentKind = 'battery_environment';

final class DeviceGuidance {
  const DeviceGuidance({required this.key, required this.maker, required this.steps});

  /// `capability.batteryEnvironment.guidance.<maker>`.
  final String key;

  /// The maker as the user knows it, for the "Steps for … phones" label.
  final String maker;

  /// Where to look in the phone's own Settings, one line each.
  final List<String> steps;
}

/// Shown above any maker's steps: the test comes first (MR-06).
const guidanceIntro = 'Send a test reminder, lock the phone and wait for it. '
    'If it arrives, nothing here is needed.';

/// Shown below them. Settings names move between models and versions.
const guidanceCaveat = 'These are your phone maker\'s settings, not Nudgio\'s. '
    'Names can differ by model and software version.';

const _guidance = <String, DeviceGuidance>{
  'xiaomi': DeviceGuidance(
    key: '${guidanceKeyPrefix}xiaomi',
    maker: 'Xiaomi, Redmi and POCO',
    steps: [
      'Settings > Apps > Manage apps > Nudgio > turn on Autostart.',
      'On the same page, Battery saver > No restrictions.',
    ],
  ),
  'samsung': DeviceGuidance(
    key: '${guidanceKeyPrefix}samsung',
    maker: 'Samsung',
    steps: [
      'Settings > Battery > Background usage limits > Never sleeping apps > add Nudgio.',
      'Check that Nudgio is not listed under Sleeping apps or Deep sleeping apps.',
    ],
  ),
  'huawei': DeviceGuidance(
    key: '${guidanceKeyPrefix}huawei',
    maker: 'Huawei',
    steps: [
      'Settings > Battery > App launch > Nudgio > switch to Manage manually.',
      'Leave Auto-launch and Run in background turned on.',
    ],
  ),
  'honor': DeviceGuidance(
    key: '${guidanceKeyPrefix}honor',
    maker: 'Honor',
    steps: [
      'Settings > Battery > App launch > Nudgio > switch to Manage manually.',
      'Leave Auto-launch and Run in background turned on.',
    ],
  ),
  'oppo': DeviceGuidance(
    key: '${guidanceKeyPrefix}oppo',
    maker: 'OPPO, realme and OnePlus',
    steps: [
      'Settings > Apps > App management > Nudgio > Battery usage > Allow background activity.',
      'On the same page, turn on Allow auto launch if it is shown.',
    ],
  ),
  'vivo': DeviceGuidance(
    key: '${guidanceKeyPrefix}vivo',
    maker: 'vivo and iQOO',
    steps: [
      'Settings > Apps > Autostart > turn on Nudgio.',
      'Settings > Battery > Background power consumption management > Nudgio > Don\'t restrict.',
    ],
  ),
};

/// The steps for [guidanceKey], or null for a maker this build has none for
/// (a newer native host may name one this Dart build does not know).
DeviceGuidance? deviceGuidanceForKey(String? guidanceKey) {
  if (guidanceKey == null || !guidanceKey.startsWith(guidanceKeyPrefix)) return null;
  return _guidance[guidanceKey.substring(guidanceKeyPrefix.length)];
}

/// The maker steps Health should offer for [snapshot], if any.
DeviceGuidance? deviceGuidanceFor(CapabilitySnapshot snapshot) {
  for (final item in snapshot.items) {
    if (item.kind == batteryEnvironmentKind) return deviceGuidanceForKey(item.guidanceKey);
  }
  return null;
}

/// Every maker with steps, for the test that pairs this table with
/// `DeviceAlarmGuidance.kt`.
Iterable<DeviceGuidance> get allDeviceGuidance => _guidance.values;
