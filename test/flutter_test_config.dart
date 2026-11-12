// Golden baselines are recorded on Windows but CI runs on ubuntu-latest.
// flutter_test renders text in the Ahem box font, so layout is identical;
// only edge anti-aliasing differs between platforms. Allow a small pixel
// difference rather than keeping two baseline sets.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

const _tolerance = 0.005; // 0.5% of pixels

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  if (goldenFileComparator is LocalFileComparator) {
    final base = (goldenFileComparator as LocalFileComparator).basedir;
    goldenFileComparator = _TolerantComparator(Uri.parse('$base/x.dart'));
  }
  await testMain();
}

class _TolerantComparator extends LocalFileComparator {
  _TolerantComparator(super.testFile);

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(imageBytes, await getGoldenBytes(golden));
    if (result.passed || result.diffPercent <= _tolerance) {
      result.dispose();
      return true;
    }
    final error = await generateFailureOutput(result, golden, basedir);
    result.dispose();
    throw FlutterError(error);
  }
}
