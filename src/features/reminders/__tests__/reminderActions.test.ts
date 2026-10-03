import {actionFromDraft, draftFromAction} from '../editor/ReminderActionSection';
import {
  actionButtonLabel,
  actionTargetOf,
  displayHostOf,
  isAllowedActionUri,
  normalizeActionUri,
} from '../reminderActions';

describe('normalizeActionUri', () => {
  it.each([
    ['  https://example.com  ', 'https://example.com'],
    ['youtube.com/watch?v=abc', 'https://youtube.com/watch?v=abc'],
    ['www.youtube.com/watch?v=abc', 'https://www.youtube.com/watch?v=abc'],
    ['example.com:8080/path', 'https://example.com:8080/path'],
    ['+65 9123 4567', 'tel:+6591234567'],
    ['(555) 123-4567', 'tel:5551234567'],
    ['me@example.com', 'mailto:me@example.com'],
    ['spotify:track:abc', 'spotify:track:abc'],
    ['', ''],
    ['   ', ''],
  ])('%p -> %p', (input, expected) => {
    expect(normalizeActionUri(input)).toBe(expected);
  });
});

// Mirrors ReminderActionRulesTest.kt — the two must agree.
describe('isAllowedActionUri', () => {
  it.each([
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
  ])('allows %p', uri => {
    expect(isAllowedActionUri(uri)).toBe(true);
  });

  it.each([
    '',
    // eslint-disable-next-line no-script-url -- the point of the test is that these are refused.
    'javascript:alert(1)',
    // eslint-disable-next-line no-script-url
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
    `https://example.com/${'a'.repeat(2048)}`,
  ])('blocks %p', uri => {
    expect(isAllowedActionUri(uri)).toBe(false);
  });
});

describe('actionTargetOf', () => {
  it.each([
    ['https://www.youtube.com/watch?v=x', 'youtube'],
    ['https://m.youtube.com/watch?v=x', 'youtube'],
    ['https://youtu.be/x', 'youtube'],
    ['https://open.spotify.com/playlist/x', 'spotify'],
    ['spotify:album:x', 'spotify'],
    ['https://maps.app.goo.gl/x', 'maps'],
    ['https://www.google.com/maps/place/x', 'maps'],
    ['https://www.google.com/search?q=maps', 'web'],
    ['geo:0,0?q=gym', 'maps'],
    ['tel:+6591234567', 'phone'],
    ['mailto:a@b.co', 'email'],
    ['sms:123456', 'sms'],
    ['https://notyoutube.com/x', 'web'],
    ['duolingo://lesson', 'app'],
  ])('%p is %p', (uri, target) => {
    expect(actionTargetOf(uri)).toBe(target);
  });
});

describe('displayHostOf', () => {
  it('strips www and returns null for non-web links', () => {
    expect(displayHostOf('https://www.example.com/a')).toBe('example.com');
    expect(displayHostOf('tel:123456')).toBeNull();
  });
});

describe('actionButtonLabel', () => {
  const t = (key: string) => `t:${key}`;
  it('prefers the user label, else derives one from the link', () => {
    expect(actionButtonLabel({type: 'open_link', uri: 'https://youtu.be/x', label: 'Start lesson'}, t)).toBe('Start lesson');
    expect(actionButtonLabel({type: 'open_link', uri: 'https://youtu.be/x', label: '  '}, t)).toBe(
      't:reminders.action.default.youtube',
    );
    expect(actionButtonLabel({type: 'open_link', uri: 'https://example.com', label: null}, t)).toBe(
      't:reminders.action.default.web',
    );
  });
});

describe('action drafts', () => {
  it('round-trips an existing action', () => {
    const action = {type: 'open_link' as const, uri: 'https://youtu.be/x', label: 'Go'};
    expect(actionFromDraft(draftFromAction(action))).toEqual(action);
  });

  it('is null when disabled, even with a link typed', () => {
    expect(actionFromDraft({enabled: false, link: 'https://x.com', label: ''})).toBeNull();
  });

  it('normalizes what was typed and flags what cannot open', () => {
    expect(actionFromDraft({enabled: true, link: 'youtube.com/watch?v=x', label: ''})).toEqual({
      type: 'open_link',
      uri: 'https://youtube.com/watch?v=x',
      label: null,
    });
    expect(actionFromDraft({enabled: true, link: 'not a link', label: ''})).toBe('invalid');
    expect(actionFromDraft({enabled: true, link: '', label: ''})).toBe('invalid');
  });
});
