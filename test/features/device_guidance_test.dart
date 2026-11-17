import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/features/health/device_guidance.dart';
import 'package:nudgio/native/types.dart';
import 'package:nudgio/native/wire.dart';

CapabilitySnapshot snapshot(String? guidanceKey) => CapabilitySnapshot(
      overall: ResultStatus.ok,
      observedAt: DateTime.utc(2026, 11, 15),
      items: [
        CapabilityItem(
          kind: 'notifications',
          status: CapabilityStatus.ready,
          effectKey: 'capability.notifications.ready',
          action: 'none',
          observedAt: DateTime.utc(2026, 11, 15),
          // A key on the wrong row is ignored.
          guidanceKey: '${guidanceKeyPrefix}samsung',
        ),
        CapabilityItem(
          kind: batteryEnvironmentKind,
          status: CapabilityStatus.limited,
          effectKey: 'capability.batteryEnvironment.limited',
          action: 'none',
          observedAt: DateTime.utc(2026, 11, 15),
          guidanceKey: guidanceKey,
        ),
      ],
    );

void main() {
  test('a known maker gets its own labelled steps', () {
    final guidance = deviceGuidanceFor(snapshot('${guidanceKeyPrefix}xiaomi'))!;
    expect(guidance.maker, 'Xiaomi, Redmi and POCO');
    expect(guidance.steps, hasLength(2));
    expect(guidance.steps.first, contains('Autostart'));
  });

  test('no key, an unknown maker or a foreign key gives nothing', () {
    expect(deviceGuidanceFor(snapshot(null)), isNull);
    expect(deviceGuidanceFor(snapshot('${guidanceKeyPrefix}nokia')), isNull);
    expect(deviceGuidanceFor(snapshot('capability.notifications.blocked')), isNull);
  });

  test('a snapshot with no battery row gives nothing', () {
    final empty = CapabilitySnapshot(overall: ResultStatus.ok, items: const [], observedAt: DateTime.utc(2026));
    expect(deviceGuidanceFor(empty), isNull);
  });

  test('every maker has real steps that name Nudgio and never promise delivery', () {
    for (final guidance in allDeviceGuidance) {
      expect(guidance.key, startsWith(guidanceKeyPrefix));
      expect(guidance.steps, isNotEmpty, reason: guidance.key);
      expect(guidance.steps.join(' '), contains('Nudgio'), reason: guidance.key);
      // ADR-021: no guaranteed-timing claim.
      expect(guidance.steps.join(' ').toLowerCase(), isNot(contains('guarantee')), reason: guidance.key);
    }
    expect(guidanceIntro.toLowerCase(), contains('test reminder'));
  });

  test('the makers here are exactly the ones Android names (DeviceAlarmGuidance.kt)', () {
    final kotlin = File(
      'android/app/src/main/java/com/aslam/mediareminder/capability/DeviceAlarmGuidance.kt',
    ).readAsStringSync();
    final named = RegExp(r'"[a-z]+" to "([a-z]+)"').allMatches(kotlin).map((m) => m.group(1)!).toSet();
    final here = allDeviceGuidance.map((g) => g.key.substring(guidanceKeyPrefix.length)).toSet();
    expect(named, isNotEmpty);
    expect(here, named);
  });

  test('the wire field decodes, and its absence is not an error', () {
    Map<String, Object?> item(Map<String, Object?> extra) => {
          'kind': batteryEnvironmentKind,
          'status': 'limited',
          'effectKey': 'capability.batteryEnvironment.limited',
          'action': 'none',
          'observedAt': '2026-11-15T00:00:00Z',
          ...extra,
        };
    CapabilityItem decode(Map<String, Object?> wire) => CapabilityItem.fromWire(WireReader(wire, 'CapabilityItem'));
    expect(decode(item({'guidanceKey': '${guidanceKeyPrefix}vivo'})).guidanceKey, '${guidanceKeyPrefix}vivo');
    expect(decode(item({})).guidanceKey, isNull);
  });
}
