/**
 * Reminder Actions (DL-080) — the JS half: turning what people paste into a
 * launchable URI, mirroring native validation for instant editor feedback,
 * and recognizing common targets so the button can say "Open YouTube"
 * instead of "Open link".
 *
 * Native (`ReminderActionRules.kt`) stays the authority — a save with an
 * unsafe URI is rejected there regardless of what this file thinks. The two
 * are kept in step by the shared test cases in
 * `__tests__/reminderActions.test.ts` and `ReminderActionRulesTest.kt`.
 *
 * Deliberately no `URL` object: Hermes' `URL` is a partial polyfill whose
 * `hostname` throws, so the little parsing needed here is done by hand.
 */
import type {IconName} from '../../design-system';
import type {TranslationKey} from '../../localization';
import type {ReminderActionDto} from '../../native-client/types';

export const MAX_ACTION_URI_LENGTH = 2048;
export const MAX_ACTION_LABEL_LENGTH = 40;

const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** Schemes that could reach private files, run script, or name an explicit component. */
const BLOCKED_SCHEMES = new Set([
  'javascript', 'file', 'content', 'intent', 'data', 'about', 'blob',
  'android.resource', 'jar', 'vbscript',
]);

/**
 * What people actually paste or type, made launchable: a bare
 * `youtube.com/watch?v=…` gains `https://`, a phone number becomes `tel:`,
 * an email address becomes `mailto:`. Anything that already has a scheme is
 * only trimmed. Returns `''` for blank input.
 */
export const normalizeActionUri = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return '';
  }
  // A real scheme, not "example.com:8080/…" (a dot before the colon means host).
  const scheme = SCHEME.exec(trimmed)?.[1];
  if (scheme !== undefined && !scheme.includes('.')) {
    return trimmed;
  }
  if (/^\+?[\d\s().-]{6,}$/.test(trimmed) && /\d{3}/.test(trimmed.replace(/\D/g, ''))) {
    return `tel:${trimmed.replace(/[\s().-]/g, '')}`;
  }
  if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  if (/^[^\s/]+\.[a-zA-Z]{2,}([/:?#].*)?$/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

const hostOf = (uri: string): string | null => {
  const match = /^https?:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i.exec(uri);
  return match?.[1]?.toLowerCase() ?? null;
};

/** Mirrors `ReminderActionRules.isAllowedUri` exactly. */
export const isAllowedActionUri = (uri: string): boolean => {
  if (uri.length === 0 || uri.length > MAX_ACTION_URI_LENGTH) {
    return false;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(uri)) {
    return false;
  }
  const scheme = SCHEME.exec(uri)?.[1]?.toLowerCase();
  if (scheme === undefined || BLOCKED_SCHEMES.has(scheme)) {
    return false;
  }
  const rest = uri.slice(scheme.length + 1);
  if (rest.length === 0) {
    return false;
  }
  switch (scheme) {
    case 'http':
    case 'https':
      return (hostOf(uri) ?? '').length > 0;
    case 'tel':
      return (rest.match(/\d/g) ?? []).length >= 3;
    case 'mailto':
      return rest.includes('@');
    default:
      return true;
  }
};

export type ActionTarget = 'youtube' | 'spotify' | 'maps' | 'phone' | 'email' | 'sms' | 'web' | 'app';

const matchesHost = (host: string, domain: string): boolean =>
  host === domain || host.endsWith(`.${domain}`);

/** Which kind of place a link leads — drives the icon and the default button text. */
export const actionTargetOf = (uri: string): ActionTarget => {
  const scheme = SCHEME.exec(uri)?.[1]?.toLowerCase() ?? '';
  switch (scheme) {
    case 'tel':
      return 'phone';
    case 'mailto':
      return 'email';
    case 'sms':
    case 'smsto':
      return 'sms';
    case 'geo':
      return 'maps';
    case 'spotify':
      return 'spotify';
    case 'vnd.youtube':
    case 'youtube':
      return 'youtube';
    case 'http':
    case 'https':
      break;
    default:
      return 'app';
  }
  const host = hostOf(uri) ?? '';
  if (matchesHost(host, 'youtube.com') || host === 'youtu.be') {
    return 'youtube';
  }
  if (matchesHost(host, 'spotify.com') || host === 'spotify.link') {
    return 'spotify';
  }
  if (
    host === 'maps.app.goo.gl' ||
    host.startsWith('maps.google.') ||
    (/^(www\.)?google\.[a-z.]+$/.test(host) && /^https?:\/\/[^/]+\/maps/i.test(uri)) ||
    /^https?:\/\/goo\.gl\/maps/i.test(uri)
  ) {
    return 'maps';
  }
  return 'web';
};

/** A short, human host for "Opens example.com" hints; `null` for non-web links. */
export const displayHostOf = (uri: string): string | null => {
  const host = hostOf(uri);
  return host ? host.replace(/^www\./, '') : null;
};

export const ACTION_TARGET_ICON: Record<ActionTarget, IconName> = {
  youtube: 'play',
  spotify: 'audio',
  maps: 'place',
  phone: 'phone',
  email: 'mail',
  sms: 'mail',
  web: 'link',
  app: 'openExternal',
};

export const ACTION_TARGET_LABEL_KEY: Record<ActionTarget, TranslationKey> = {
  youtube: 'reminders.action.default.youtube',
  spotify: 'reminders.action.default.spotify',
  maps: 'reminders.action.default.maps',
  phone: 'reminders.action.default.phone',
  email: 'reminders.action.default.email',
  sms: 'reminders.action.default.sms',
  web: 'reminders.action.default.web',
  app: 'reminders.action.default.app',
};

/** The button text: the user's own words when they gave some, otherwise one derived from the link. */
export const actionButtonLabel = (
  action: ReminderActionDto,
  t: (key: TranslationKey) => string,
): string => {
  const custom = action.label?.trim();
  if (custom) {
    return custom;
  }
  return t(ACTION_TARGET_LABEL_KEY[actionTargetOf(action.uri)]);
};
