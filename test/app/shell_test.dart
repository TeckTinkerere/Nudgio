import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/app/app.dart';
import 'package:nudgio/app/providers.dart';
import 'package:nudgio/native/testing/fake_host.dart';

import '../support/fixtures.dart';

void main() {
  testWidgets('the shell lists reminders from the host, soonest first', (tester) async {
    final host = FakeNudgioHost()
      ..answer('getStartupSnapshot', fixture('startup_snapshot'))
      ..answer('listReminders', fixture('reminder_page'));

    await tester.pumpWidget(ProviderScope(
      overrides: [hostProvider.overrideWithValue(host)],
      child: const NudgioApp(),
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining('schema v9'), findsOneWidget);
    expect(find.text('Morning stretch'), findsOneWidget);
    expect(find.text('Take medicine'), findsOneWidget);
    // The alarm with no attachment gets the plain alarm icon (DL-118).
    expect(find.byIcon(Icons.alarm), findsOneWidget);
    final labels = tester.widgetList<ListTile>(find.byType(ListTile)).map((tile) => (tile.title as Text?)?.data);
    expect(labels.toList().indexOf('Morning stretch'), lessThan(labels.toList().indexOf('Take medicine')));
  });

  testWidgets('a startup failure shows its message key, not a crash', (tester) async {
    final host = FakeNudgioHost()..answer('listReminders', fixture('reminder_page'));

    await tester.pumpWidget(ProviderScope(
      overrides: [hostProvider.overrideWithValue(host)],
      child: const NudgioApp(),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('startupError')), findsOneWidget);
    expect(find.text('error.notImplemented'), findsOneWidget);
  });
}
