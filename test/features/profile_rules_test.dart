import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/features/profiles/profile_rules.dart';
import 'package:nudgio/native/types.dart';

// Mirrors ProfileRulesTest.kt: the two must agree.
void main() {
  const gentle = ReminderProfile(
    id: '00000000-0000-4000-8000-000000000001',
    nameKey: 'profile.gentle.name',
    isBuiltIn: true,
    fullScreenWhenLocked: false,
    timeoutSeconds: 60,
    retryCount: 0,
    graceSeconds: 300,
    defaultSnoozeMinutes: 10,
    entityVersion: 1,
    reminderCount: 2,
  );
  const morning = ReminderProfile(
    id: 'custom-1',
    nameKey: 'Morning',
    isBuiltIn: false,
    fullScreenWhenLocked: true,
    timeoutSeconds: 300,
    retryCount: 1,
    graceSeconds: 600,
    defaultSnoozeMinutes: 10,
    entityVersion: 4,
  );
  const all = [gentle, morning];

  ProfileDraft draft({
    String? id,
    String name = 'Medication',
    bool isBuiltIn = false,
    int timeoutSeconds = 120,
    int retryCount = 2,
    int graceSeconds = 300,
    int defaultSnoozeMinutes = 15,
  }) =>
      ProfileDraft(
        id: id,
        isBuiltIn: isBuiltIn,
        name: name,
        fullScreenWhenLocked: true,
        timeoutSeconds: timeoutSeconds,
        retryCount: retryCount,
        graceSeconds: graceSeconds,
        defaultSnoozeMinutes: defaultSnoozeMinutes,
      );

  group('checkProfileDraft', () {
    test('a sound draft passes, and so does the blank starting point once named', () {
      expect(checkProfileDraft(draft(), all), isNull);
      expect(checkProfileDraft(const ProfileDraft.blank(), all), ProfileField.name);
    });

    test('every bound is inclusive and one step outside is refused', () {
      expect(
        checkProfileDraft(draft(timeoutSeconds: 15, retryCount: 0, graceSeconds: 60, defaultSnoozeMinutes: 1), all),
        isNull,
      );
      expect(
        checkProfileDraft(
          draft(timeoutSeconds: 600, retryCount: 3, graceSeconds: 3600, defaultSnoozeMinutes: 120),
          all,
        ),
        isNull,
      );
      expect(checkProfileDraft(draft(timeoutSeconds: 14), all), ProfileField.timeoutSeconds);
      expect(checkProfileDraft(draft(timeoutSeconds: 601), all), ProfileField.timeoutSeconds);
      expect(checkProfileDraft(draft(retryCount: -1), all), ProfileField.retryCount);
      expect(checkProfileDraft(draft(retryCount: 4), all), ProfileField.retryCount);
      expect(checkProfileDraft(draft(graceSeconds: 59), all), ProfileField.graceSeconds);
      expect(checkProfileDraft(draft(graceSeconds: 3601), all), ProfileField.graceSeconds);
      expect(checkProfileDraft(draft(defaultSnoozeMinutes: 0), all), ProfileField.defaultSnoozeMinutes);
      expect(checkProfileDraft(draft(defaultSnoozeMinutes: 121), all), ProfileField.defaultSnoozeMinutes);
    });

    test('a name another custom profile has is refused whatever the case', () {
      expect(checkProfileDraft(draft(name: 'morning'), all), ProfileField.name);
      // Keeping its own name while editing is not a clash.
      expect(checkProfileDraft(draft(id: morning.id, name: 'MORNING'), all), isNull);
    });

    test('a built-in is checked on its numbers only', () {
      expect(checkProfileDraft(draft(id: gentle.id, isBuiltIn: true, name: ''), all), isNull);
      expect(
        checkProfileDraft(draft(id: gentle.id, isBuiltIn: true, timeoutSeconds: 5), all),
        ProfileField.timeoutSeconds,
      );
    });

    test('the twenty-first custom profile is refused but editing at the limit is not', () {
      final twenty = [
        for (var i = 1; i <= 20; i++)
          ReminderProfile(
            id: 'c$i',
            nameKey: 'Custom $i',
            isBuiltIn: false,
            fullScreenWhenLocked: true,
            timeoutSeconds: 300,
            retryCount: 1,
            graceSeconds: 600,
            defaultSnoozeMinutes: 10,
            entityVersion: 1,
          ),
      ];
      expect(checkProfileDraft(draft(), [gentle, ...twenty]), ProfileField.limit);
      expect(checkProfileDraft(draft(id: 'c1', name: 'Renamed'), [gentle, ...twenty]), isNull);
      expect(checkProfileDraft(draft(), [gentle, ...twenty.take(19)]), isNull);
    });
  });

  group('cleanProfileName', () {
    for (final (input, expected) in <(String?, String?)>[
      ('  Night \t shift ', 'Night shift'),
      ('a' * 40, 'a' * 40),
      ('a' * 41, null),
      ('   ', null),
      (null, null),
      ('bad\u0007name', null),
      ('profile.gentle.name', null),
      ('Profile.mine', null),
    ]) {
      test('"$input" -> $expected', () => expect(cleanProfileName(input), expected));
    }
  });

  group('the request the editor sends', () {
    test('a new custom profile sends a cleaned name and no id', () {
      expect(draft(name: '  Medication   time ').toRequest().toWire(), {
        'name': 'Medication time',
        'fullScreenWhenLocked': true,
        'timeoutSeconds': 120,
        'retryCount': 2,
        'graceSeconds': 300,
        'defaultSnoozeMinutes': 15,
      });
    });

    test('an edit carries the id and the version it loaded', () {
      final wire = ProfileDraft.from(morning).toRequest().toWire();
      expect(wire['id'], 'custom-1');
      expect(wire['expectedEntityVersion'], 4);
      expect(wire['name'], 'Morning');
    });

    test('a built-in sends its numbers and neither its name nor whether it rings', () {
      final wire = ProfileDraft.from(gentle).toRequest().toWire();
      expect(wire.containsKey('name'), isFalse);
      expect(wire.containsKey('fullScreenWhenLocked'), isFalse);
      expect(wire['timeoutSeconds'], 60);
    });
  });

  test('only an unused custom profile can be deleted', () {
    expect(canDeleteProfile(morning), isTrue);
    expect(canDeleteProfile(gentle), isFalse);
    expect(
      canDeleteProfile(
        const ReminderProfile(
          id: 'c',
          nameKey: 'Used',
          isBuiltIn: false,
          fullScreenWhenLocked: true,
          timeoutSeconds: 300,
          retryCount: 1,
          graceSeconds: 600,
          defaultSnoozeMinutes: 10,
          entityVersion: 1,
          reminderCount: 1,
        ),
      ),
      isFalse,
    );
  });

  test('the longest alert is every ring plus every wait between rings', () {
    // Persistent's seed: 10 min x 4 rings + 15 min x 3 waits.
    expect(
      longestAlert(draft(timeoutSeconds: 600, retryCount: 3, graceSeconds: 900)),
      const Duration(minutes: 85),
    );
    expect(longestAlert(draft(timeoutSeconds: 60, retryCount: 0)), const Duration(seconds: 60));
  });
}
