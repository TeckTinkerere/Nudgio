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

class ShellScreen extends ConsumerStatefulWidget {
  const ShellScreen({super.key});

  @override
  ConsumerState<ShellScreen> createState() => _ShellScreenState();
}

/// Drains the native "an alarm's Open/Play asked to show this" slot at launch
/// and every time the app returns to the front, so the iPhone alarm's Open
/// button (which opens the app) lands on its reminder. Media never starts
/// here: that waits for an explicit Play (AGENTS.md).
class _ShellScreenState extends ConsumerState<ShellScreen> with WidgetsBindingObserver {
  PendingReminderOpen? _pending;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _drainPendingOpen();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _drainPendingOpen();
  }

  Future<void> _drainPendingOpen() async {
    final result = await ref.read(clientProvider).takePendingMediaOpen();
    if (!mounted) return;
    if (result case Ok(:final value?)) {
      setState(() => _pending = value);
      ref
        ..invalidate(startupProvider)
        ..invalidate(remindersProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
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
            if (_pending case final pending?)
              ListTile(
                key: const Key('pendingOpen'),
                leading: const Icon(Icons.alarm_on),
                title: Text(_pendingLabel(reminders, pending) ?? 'Opened from an alarm'),
                subtitle: Text(pending.mediaId == null ? 'Opened from an alarm' : 'Opened from an alarm · has media'),
                trailing: IconButton(
                  tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                  icon: const Icon(Icons.close),
                  onPressed: () => setState(() => _pending = null),
                ),
              ),
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

String? _pendingLabel(AsyncValue<Result<WirePage<ReminderSummary>>> reminders, PendingReminderOpen pending) {
  if (reminders case AsyncData(value: Ok(:final value))) {
    for (final reminder in value.items) {
      if (reminder.id == pending.reminderId) return reminder.label;
    }
  }
  return null;
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
