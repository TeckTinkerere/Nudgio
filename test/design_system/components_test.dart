// F3 exit evidence for the first components: goldens in light, dark and at
// 200% text scale (MR-13 ACC-003), plus behaviour and semantics checks.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/design_system/components/button.dart';
import 'package:nudgio/design_system/components/card.dart';
import 'package:nudgio/design_system/components/status_pill.dart';
import 'package:nudgio/design_system/theme.dart';

Widget _host(Widget child, {Brightness brightness = Brightness.light, double textScale = 1}) => MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(brightness: brightness),
      home: MediaQuery(
        data: MediaQueryData(size: const Size(360, 640), textScaler: TextScaler.linear(textScale)),
        child: Scaffold(body: Padding(padding: const EdgeInsets.all(16), child: child)),
      ),
    );

Widget _gallery() => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final v in ButtonVariant.values) NButton(label: v.name, onPressed: () {}, variant: v),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          NButton(label: 'Disabled', onPressed: () {}, disabled: true),
          NButton(label: 'Loading', onPressed: () {}, loading: true),
          NButton(label: 'Snooze', onPressed: () {}, variant: ButtonVariant.tonal, size: ButtonSize.alarm, icon: Icons.snooze),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final k in StatusKind.values) StatusPill(kind: k, label: k.name),
        ]),
        const SizedBox(height: 8),
        const Row(children: [
          Expanded(child: NCard(child: Text('Card'))),
          SizedBox(width: 8),
          Expanded(child: NCard(selected: true, child: Text('Selected'))),
        ]),
      ],
    );

void main() {
  group('goldens', () {
    for (final (name, brightness, scale) in [
      ('light', Brightness.light, 1.0),
      ('dark', Brightness.dark, 1.0),
      ('light_200', Brightness.light, 2.0),
      ('dark_200', Brightness.dark, 2.0),
    ]) {
      testWidgets('component gallery $name', (tester) async {
        tester.view
          ..physicalSize = const Size(360, 960)
          ..devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(_host(SingleChildScrollView(child: _gallery()), brightness: brightness, textScale: scale));
        // The loading spinner animates forever; take one deterministic frame.
        await tester.pump(const Duration(milliseconds: 100));
        await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/components_$name.png'));
      });
    }
  });

  group('NButton', () {
    testWidgets('meets the 48dp touch floor and fires', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_host(Center(child: NButton(label: 'Go', onPressed: () => taps++))));
      final size = tester.getSize(find.byType(NButton));
      expect(size.height, greaterThanOrEqualTo(48));
      expect(size.width, greaterThanOrEqualTo(48));
      await tester.tap(find.byType(NButton));
      expect(taps, 1);
    });

    testWidgets('alarm size is at least 64dp tall', (tester) async {
      await tester.pumpWidget(_host(Center(child: NButton(label: 'Stop', onPressed: () {}, size: ButtonSize.alarm))));
      expect(tester.getSize(find.byType(NButton)).height, greaterThanOrEqualTo(64));
    });

    testWidgets('disabled and loading buttons ignore taps and say why', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_host(Column(children: [
        NButton(label: 'Save', onPressed: () => taps++, disabled: true, disabledReason: 'Pick a time first'),
        NButton(label: 'Busy', onPressed: () => taps++, loading: true),
      ])));
      await tester.tap(find.text('Save'));
      await tester.tap(find.text('Busy'));
      expect(taps, 0);
      final semantics = tester.getSemantics(find.bySemanticsLabel('Save'));
      expect(semantics.hint, 'Pick a time first');
    });

    testWidgets('loading keeps the label so the width does not jump', (tester) async {
      Future<double> widthOf(bool loading) async {
        await tester.pumpWidget(_host(Center(child: NButton(label: 'Import', onPressed: () {}, loading: loading, icon: Icons.add))));
        return tester.getSize(find.byType(NButton)).width;
      }

      expect(await widthOf(true), await widthOf(false));
    });

    testWidgets('a long label wraps at 200% instead of overflowing', (tester) async {
      await tester.pumpWidget(_host(
        NButton(label: 'Allow exact alarms in system settings', onPressed: () {}, fullWidth: true),
        textScale: 2,
      ));
      expect(tester.takeException(), isNull);
    });
  });

  group('StatusPill', () {
    testWidgets('pairs every kind with an icon and announces its label', (tester) async {
      await tester.pumpWidget(_host(Column(children: [
        for (final k in StatusKind.values) StatusPill(kind: k, label: 'label ${k.name}'),
      ])));
      expect(find.byType(Icon), findsNWidgets(StatusKind.values.length));
      for (final k in StatusKind.values) {
        expect(find.bySemanticsLabel('label ${k.name}'), findsOneWidget);
      }
    });
  });

  group('NCard', () {
    ShapeBorder? shapeOf(WidgetTester tester) =>
        tester.widget<Material>(find.descendant(of: find.byType(NCard), matching: find.byType(Material))).shape;

    testWidgets('has an outline in dark mode and none in light', (tester) async {
      await tester.pumpWidget(_host(const NCard(child: Text('x'))));
      expect((shapeOf(tester)! as RoundedRectangleBorder).side, BorderSide.none);
      await tester.pumpWidget(_host(const NCard(child: Text('x')), brightness: Brightness.dark));
      await tester.pumpAndSettle(); // MaterialApp animates theme changes
      expect((shapeOf(tester)! as RoundedRectangleBorder).side, isNot(BorderSide.none));
    });

    testWidgets('is a button only when tappable', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_host(NCard(onTap: () => taps++, semanticLabel: 'Open', child: const Text('x'))));
      await tester.tap(find.byType(NCard));
      expect(taps, 1);
      expect(tester.getSemantics(find.bySemanticsLabel(RegExp('Open'))).flagsCollection.isButton, isTrue);
    });
  });
}
