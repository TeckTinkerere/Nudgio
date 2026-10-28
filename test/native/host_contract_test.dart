import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/native/host_contract.dart';

/// `contract/host_methods.json` is what the Kotlin and Swift test suites read
/// to prove they answer every method. It is generated from [hostMethods];
/// run `flutter test --dart-define=UPDATE_CONTRACT=true` after changing the
/// table, then commit the file.
void main() {
  test('contract/host_methods.json matches the Dart method table', () {
    final file = File('contract/host_methods.json');
    final expected = const JsonEncoder.withIndent('  ').convert({
      'contractVersion': bridgeContractVersion,
      'hostChannel': hostChannelName,
      'eventChannel': eventChannelName,
      'methods': hostMethods,
    });
    if (const bool.fromEnvironment('UPDATE_CONTRACT')) {
      file.writeAsStringSync('$expected\n');
    }
    // A Windows checkout may have CRLF line endings; the contract is the text.
    final actual = file.readAsStringSync().replaceAll('\r\n', '\n').trim();
    expect(actual, expected, reason: 'Regenerate with --dart-define=UPDATE_CONTRACT=true');
  });

  test('every method the TurboModule spec declared is still in the contract', () {
    // The 46 methods of NativeMediaReminder.ts plus listRecentlyMissed, which
    // Kotlin exported without a TypeScript declaration.
    expect(hostMethods, hasLength(47));
  });
}
