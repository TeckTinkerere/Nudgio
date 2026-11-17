import 'package:flutter_test/flutter_test.dart';
import 'package:nudgio/features/reminders/reminder_actions.dart';
import 'package:nudgio/native/types.dart';

void main() {
  group('normalizeActionUri', () {
    for (final (input, expected) in [
      ('  https://example.com  ', 'https://example.com'),
      ('youtube.com/watch?v=abc', 'https://youtube.com/watch?v=abc'),
      ('www.youtube.com/watch?v=abc', 'https://www.youtube.com/watch?v=abc'),
      ('example.com:8080/path', 'https://example.com:8080/path'),
      ('+65 9123 4567', 'tel:+6591234567'),
      ('(555) 123-4567', 'tel:5551234567'),
      ('me@example.com', 'mailto:me@example.com'),
      ('spotify:track:abc', 'spotify:track:abc'),
      ('', ''),
      ('   ', ''),
    ]) {
      test('"$input" -> "$expected"', () => expect(normalizeActionUri(input), expected));
    }
  });

  // Mirrors ReminderActionRulesTest.kt: the two must agree.
  group('isAllowedActionUri', () {
    for (final uri in [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'http://example.com',
      'https://open.spotify.com/track/abc',
      'spotify:track:6rqhFgbbKwnb9MLmUQDhG6',
      'tel:+6591234567',
      'mailto:me@example.com',
      'geo:1.29,103.85?q=gym',
      'sms:+6591234567',
      'https://maps.app.goo.gl/abc',
      'https://ja.wikipedia.org/wiki/日本語',
      'duolingo://lesson',
    ]) {
      test('allows $uri', () => expect(isAllowedActionUri(uri), isTrue));
    }

    for (final uri in [
      '',
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'file:///sdcard/secret.jpg',
      'content://com.aslam.mediareminder.fileprovider/x',
      'intent://scan/#Intent;scheme=zxing;package=com.x;end',
      'data:text/html,hi',
      'https://',
      'https:///path',
      'https://exa mple.com',
      'no scheme here',
      'youtube.com/watch?v=x',
      'tel:12',
      'mailto:nobody',
      '1http://x.com',
      'https://example.com/${'a' * 2048}',
    ]) {
      test('blocks ${uri.length > 40 ? '${uri.substring(0, 40)}…' : uri}', () => expect(isAllowedActionUri(uri), isFalse));
    }
  });

  group('actionTargetOf', () {
    for (final (uri, target) in [
      ('https://www.youtube.com/watch?v=x', ActionTarget.youtube),
      ('https://m.youtube.com/watch?v=x', ActionTarget.youtube),
      ('https://youtu.be/x', ActionTarget.youtube),
      ('https://open.spotify.com/playlist/x', ActionTarget.spotify),
      ('spotify:album:x', ActionTarget.spotify),
      ('https://maps.app.goo.gl/x', ActionTarget.maps),
      ('https://www.google.com/maps/place/x', ActionTarget.maps),
      ('https://www.google.com/search?q=maps', ActionTarget.web),
      ('geo:0,0?q=gym', ActionTarget.maps),
      ('tel:+6591234567', ActionTarget.phone),
      ('mailto:a@b.co', ActionTarget.email),
      ('sms:123456', ActionTarget.sms),
      ('https://notyoutube.com/x', ActionTarget.web),
      ('duolingo://lesson', ActionTarget.app),
    ]) {
      test('$uri is ${target.name}', () => expect(actionTargetOf(uri), target));
    }
  });

  test('displayHostOf strips www and returns null for non-web links', () {
    expect(displayHostOf('https://www.example.com/a'), 'example.com');
    expect(displayHostOf('tel:123456'), isNull);
  });

  test('actionButtonLabel prefers the user label, else derives one from the link', () {
    String t(String key) => 't:$key';
    expect(actionButtonLabel(const ReminderAction(uri: 'https://youtu.be/x', label: 'Start lesson'), t), 'Start lesson');
    expect(actionButtonLabel(const ReminderAction(uri: 'https://youtu.be/x', label: '  '), t),
        't:reminders.action.default.youtube');
    expect(actionButtonLabel(const ReminderAction(uri: 'https://example.com'), t), 't:reminders.action.default.web');
  });

  group('action drafts', () {
    test('round-trips an existing action', () {
      const action = ReminderAction(uri: 'https://youtu.be/x', label: 'Go');
      expect(actionFromDraft(ActionDraft.fromAction(action)), isA<ValidAction>().having((v) => v.action, 'action', action));
    });

    test('is no action when disabled, even with a link typed', () {
      expect(actionFromDraft(const ActionDraft(enabled: false, link: 'https://x.com', label: '')), isA<NoAction>());
    });

    test('normalizes what was typed and flags what cannot open', () {
      expect(
        actionFromDraft(const ActionDraft(enabled: true, link: 'youtube.com/watch?v=x', label: '')),
        isA<ValidAction>().having((v) => v.action, 'action', const ReminderAction(uri: 'https://youtube.com/watch?v=x')),
      );
      expect(actionFromDraft(const ActionDraft(enabled: true, link: 'not a link', label: '')), isA<InvalidAction>());
      expect(actionFromDraft(const ActionDraft(enabled: true, link: '', label: '')), isA<InvalidAction>());
    });
  });
}
