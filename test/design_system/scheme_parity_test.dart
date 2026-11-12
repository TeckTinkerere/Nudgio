// The Flutter brand schemes must derive the exact hex values the RN app
// ships, so screenshots and the native alarm XML stay identical across the
// migration. `fixtures/rn_schemes.json` is `lightScheme`/`darkScheme` from
// `src/design-system/theme/schemes.ts`, dumped with Node's type stripping.
// Regenerate it when a brand token changes in either app.
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/design_system/color_roles.dart';
import 'package:nudgio/design_system/color_utils.dart';

String _hexWithAlpha(Color c) {
  final a = (c.a * 255).round();
  return a == 255 ? toHex(c) : '${toHex(c)}${a.toRadixString(16).padLeft(2, '0').toUpperCase()}';
}

void main() {
  final rn = jsonDecode(File('test/design_system/fixtures/rn_schemes.json').readAsStringSync()) as Map<String, dynamic>;

  for (final (name, scheme) in [('light', lightScheme), ('dark', darkScheme)]) {
    test('$name scheme matches the RN app role for role', () {
      final expected = (rn[name] as Map<String, dynamic>).cast<String, String>();
      final actual = scheme.toMap().map((k, v) => MapEntry(k, _hexWithAlpha(v)));
      expect(actual.keys.toSet(), expected.keys.toSet(), reason: 'role sets differ');
      expected.forEach((role, hex) => expect(actual[role], hex, reason: '$name.$role'));
    });
  }
}
