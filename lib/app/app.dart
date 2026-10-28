import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/result.dart';
import '../features/reminders/reminder_status.dart';
import '../native/types.dart';
import 'providers.dart';

/// The F2 shell: proves the Flutter engine reaches the native store on both
/// platforms. Brand theme, navigation and the real screens arrive in F3/F4
/// (plan §7); until then this is a QA build surface only.
class NudgioApp extends StatelessWidget {
  const NudgioApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Nudgio',
        theme: ThemeData(colorSchemeSeed: const Color(0xFF6B4EFF), useMaterial3: true),
        darkTheme: ThemeData(
          colorSchemeSeed: const Color(0xFF6B4EFF),
          brightness: Brightness.dark,
          useMaterial3: true,
        ),
        home: const ShellScreen(),
      );
}

class ShellScreen extends ConsumerWidget {
  const ShellScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final startup = ref.watch(startupProvider);
    final reminders = ref.watch(remindersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Nudgio')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref
            ..invalidate(startupProvider)
            ..invalidate(remindersProvider);
          await ref.read(remindersProvider.future);
        },
        child: ListView(
          children: [
            switch (startup) {
              AsyncData(value: Ok(:final value)) => ListTile(
                  key: const Key('startup'),
                  title: Text('${value.platform} · schema v${value.schemaVersion} · ${value.appVersion}'),
                  subtitle: Text('${value.activeReminderCount} active reminders · ${value.mediaCount} media'),
                ),
              AsyncData(value: Err(:final error)) => ListTile(
                  key: const Key('startupError'),
                  title: Text(error.messageKey),
                  subtitle: Text(error.code),
                ),
              _ => const LinearProgressIndicator(),
            },
            const Divider(),
            ...switch (reminders) {
              AsyncData(value: Ok(:final value)) when value.items.isEmpty => [
                  const ListTile(title: Text('No reminders yet')),
                ],
              AsyncData(value: Ok(:final value)) => [
                  for (final reminder in sortByStatus(value.items, DateTime.now())) _ReminderTile(reminder),
                ],
              AsyncData(value: Err(:final error)) => [ListTile(title: Text(error.code))],
              _ => const <Widget>[],
            },
          ],
        ),
      ),
    );
  }
}

class _ReminderTile extends StatelessWidget {
  const _ReminderTile(this.reminder);
  final ReminderSummary reminder;

  @override
  Widget build(BuildContext context) {
    final status = switch (reminderStatus(reminder, DateTime.now())) {
      NextAt(:final at) => 'Next ${MaterialLocalizations.of(context).formatShortDate(at.toLocal())} '
          '${TimeOfDay.fromDateTime(at.toLocal()).format(context)}',
      MediaMissing() => 'Media missing',
      Paused() => 'Paused',
      Done() => 'Done',
      Unscheduled() => 'Not scheduled',
    };
    return ListTile(
      title: Text(reminder.label),
      subtitle: Text('${reminder.repeatSummary} · $status'),
      leading: Icon(reminder.mediaId == null ? Icons.alarm : Icons.perm_media_outlined),
    );
  }
}
