import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nudgio/app/app.dart';
import 'package:nudgio/core/logging/logger.dart';
import 'package:nudgio/core/result.dart';
import 'package:nudgio/native/nudgio_client.dart';
import 'package:nudgio/native/nudgio_host.dart';
import 'package:nudgio/native/types.dart';

/// Runs on a real Android emulator and a real iOS simulator in CI: the Dart
/// client against the real native core (Room on Android, the Swift kernel on
/// iPhone), with no fakes. It proves the channel, both dispatchers and the
/// wire format agree on an actual device runtime.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final client = NudgioClient(host: MethodChannelNudgioHost(), logger: const ConsoleLogger());

  testWidgets('create, list, pause and delete an alarm with no attachment', (tester) async {
    final startup = await client.getStartupSnapshot();
    expect(startup, isA<Ok<StartupSnapshot>>(), reason: '$startup');
    final platform = (startup as Ok<StartupSnapshot>).value.platform;

    final profiles = (await client.listProfiles() as Ok<List<ReminderProfile>>).value;
    expect(profiles, isNotEmpty, reason: 'built-in profiles are seeded on $platform');

    final saved = await client.saveReminder(SaveReminderRequest(
      label: 'Integration check',
      schedule: const DailyRule(localTime: '07:30:00'),
      profileId: profiles.first.id,
      snooze: const SnoozePolicy(defaultMinutes: 10, allowCustom: true, minimumMinutes: 1, maximumMinutes: 60),
      enabledIntent: true,
    ));
    expect(saved, isA<Ok<SaveReminderResult>>(), reason: '$saved');
    final reminder = (saved as Ok<SaveReminderResult>).value.reminder;
    expect(reminder.mediaId, isNull);
    expect(reminder.repeatSummary, isNotEmpty);

    final listed = (await client.listReminders() as Ok<WirePage<ReminderSummary>>).value;
    expect(listed.items.map((r) => r.id), contains(reminder.id));

    final disabled = (await client.setReminderEnabled(reminder.id, enabled: false) as Ok<EnableResult>).value;
    expect(disabled.reminder.enabledIntent, isFalse);
    expect(disabled.nextOccurrence, isNull);

    await tester.pumpWidget(const ProviderScope(child: NudgioApp()));
    await tester.pumpAndSettle();
    expect(find.text('Integration check'), findsOneWidget);
    expect(find.textContaining(platform), findsOneWidget);

    final deleted = await client.deleteReminder(reminder.id);
    expect(deleted, isA<Ok<MutationResult>>(), reason: '$deleted');
    final after = (await client.listReminders() as Ok<WirePage<ReminderSummary>>).value;
    expect(after.items.map((r) => r.id), isNot(contains(reminder.id)));
  });

  testWidgets('an unknown reminder is a typed validation error, not a crash', (tester) async {
    final result = await client.getReminder('00000000-0000-4000-8000-00000000dead');
    expect(result, isA<Err<ReminderDetail>>());
    expect((result as Err).error.code, 'MR_VALIDATION_FAILED');
  });
}
