// Contrast regression suite (MR-13 ACC-005), ported from
// `src/design-system/theme/__tests__/contrast.test.ts`. Every pairing is
// something actually rendered: a filled button, a chip, a status pill, a
// banner border.
import 'dart:ui';

import 'package:flutter/material.dart' show Brightness, ThemeData;
import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/design_system/color_roles.dart';
import 'package:nudgio/design_system/color_utils.dart';
import 'package:nudgio/design_system/theme.dart';

void expectContrast(Color fg, Color bg, double minimum, String what) {
  final ratio = contrastRatio(fg, bg);
  expect(ratio, greaterThanOrEqualTo(minimum),
      reason: '$what: ${toHex(fg)} on ${toHex(bg)} is ${ratio.toStringAsFixed(2)}:1, needs $minimum:1');
}

Map<int, Color> _ramp(int seed) => {for (final stop in DynamicColorPayload.toneStops) stop: _toneOf(seed, stop)};

/// A plausible tonal ramp: white at 0, the seed near 500, black at 1000.
Color _toneOf(int seed, int stop) {
  final base = Color(seed);
  return stop <= 500
      ? Color.lerp(const Color(0xFFFFFFFF), base, stop / 500)!
      : Color.lerp(base, const Color(0xFF000000), (stop - 500) / 500)!;
}

void main() {
  const normal = ContrastMinimum.normalText;
  const ui = ContrastMinimum.uiComponent;

  for (final (name, scheme) in [('light', lightScheme), ('dark', darkScheme), ('alarm', alarmScheme)]) {
    group('$name scheme meets ACC-005', () {
      test('body and secondary text on both surfaces', () {
        expectContrast(scheme.onSurface, scheme.surface, normal, 'body text');
        expectContrast(scheme.onSurfaceVariant, scheme.surface, normal, 'secondary text');
        expectContrast(scheme.onSurface, scheme.surfaceContainer, normal, 'text on card');
        expectContrast(scheme.onSurfaceVariant, scheme.surfaceContainerHigh, normal, 'secondary on raised card');
      });

      test('every filled button variant', () {
        expectContrast(scheme.onPrimary, scheme.primary, normal, 'filled Button');
        expectContrast(scheme.onSecondary, scheme.secondary, normal, 'accent fill');
        expectContrast(scheme.onError, scheme.error, normal, 'destructive Button');
        expectContrast(scheme.onPrimaryContainer, scheme.primaryContainer, normal, 'selected Chip');
        expectContrast(scheme.onSecondaryContainer, scheme.secondaryContainer, normal, 'tonal Button (Snooze)');
      });

      test('text and outlined button labels on the surface', () {
        expectContrast(scheme.primary, scheme.surface, normal, 'text Button label');
      });

      test('control boundaries stay visible', () {
        expectContrast(scheme.outline, scheme.surface, ui, 'field outline');
        expectContrast(scheme.focusRing, scheme.surface, ui, 'focus ring');
      });

      test('status content on its container and border on the surface', () {
        StatusRoles.of(scheme).toMap().forEach((kind, role) {
          expectContrast(role.onContainer, role.container, normal, '$kind status content');
          expectContrast(role.color, scheme.surface, ui, '$kind banner border');
        });
      });

      test('snackbar text', () {
        expectContrast(scheme.inverseOnSurface, scheme.inverseSurface, normal, 'snackbar');
      });
    });
  }

  group('Material You', () {
    final payload = DynamicColorPayload(
      accent1: _ramp(0xFF3A7D44),
      accent2: _ramp(0xFF6B5E3A),
      accent3: _ramp(0xFF2F6F8F),
      neutral1: _ramp(0xFF777777),
      neutral2: _ramp(0xFF6F7A70),
    );

    for (final b in Brightness.values) {
      test('status roles stay on brand and readable ($b)', () {
        final s = schemeFromDynamicColor(payload, b);
        final brand = b == Brightness.dark ? darkScheme : lightScheme;
        expect(s.error, brand.error);
        expect(s.success, brand.success);
        expect(s.warning, brand.warning);
        StatusRoles.of(s).toMap().forEach((kind, role) {
          if (kind == 'neutral') return;
          expectContrast(role.onContainer, role.container, normal, '$kind on dynamic surface');
        });
      });
    }

    test('decode rejects malformed payloads instead of throwing', () {
      expect(DynamicColorPayload.decode(null), isNull);
      expect(DynamicColorPayload.decode({'accent1': {'0': 'red'}}), isNull);
    });

    test('decode accepts a well-formed payload', () {
      final ramp = {for (final s in DynamicColorPayload.toneStops) '$s': '#336699'};
      final decoded = DynamicColorPayload.decode(
          {'accent1': ramp, 'accent2': ramp, 'accent3': ramp, 'neutral1': ramp, 'neutral2': ramp});
      expect(decoded, isNotNull);
      expect(decoded!.accent1[500], const Color(0xFF336699));
    });
  });

  group('buildTheme', () {
    NudgioTheme ext(ThemeData t) => t.extension<NudgioTheme>()!;

    test('brand is the default even with a palette present', () {
      final t = buildTheme(brightness: Brightness.light);
      expect(ext(t).colorSource, ColorSource.brand);
      expect(t.colorScheme.primary, lightScheme.primary);
    });

    test('high contrast promotes secondary content and separators', () {
      final c = ext(buildTheme(brightness: Brightness.dark, highContrast: true)).color;
      expect(c.onSurfaceVariant, c.onSurface);
      expect(c.outlineVariant, c.outline);
    });

    test('alarm theme is dark brand', () {
      final t = buildAlarmTheme();
      expect(t.brightness, Brightness.dark);
      expect(ext(t).colorSource, ColorSource.brand);
    });
  });
}
