import '../../native/types.dart';

/// Reminder Actions (DL-080), the Dart half: making what people paste
/// launchable, mirroring native validation for instant editor feedback, and
/// recognizing common targets so the button can say "Open YouTube".
///
/// Native (`ReminderActionRules.kt`, and the Swift port) stays the authority.
/// The shared cases in `test/features/reminders/reminder_actions_test.dart`
/// and `ReminderActionRulesTest.kt` keep the two in step.
const maxActionUriLength = 2048;
const maxActionLabelLength = 40;

final _scheme = RegExp(r'^([a-zA-Z][a-zA-Z0-9+.-]*):');

/// Schemes that could reach private files, run script, or name a component.
const _blockedSchemes = {
  'javascript', 'file', 'content', 'intent', 'data', 'about', 'blob', //
  'android.resource', 'jar', 'vbscript',
};

String? _schemeOf(String uri) => _scheme.firstMatch(uri)?.group(1);

/// What people paste or type, made launchable: `youtube.com/watch?v=…` gains
/// `https://`, a phone number becomes `tel:`, an address becomes `mailto:`.
/// Anything with a scheme is only trimmed. Blank input gives `''`.
String normalizeActionUri(String input) {
  final trimmed = input.trim();
  if (trimmed.isEmpty) return '';
  // A real scheme, not "example.com:8080/…" (a dot before the colon is a host).
  final scheme = _schemeOf(trimmed);
  if (scheme != null && !scheme.contains('.')) return trimmed;
  if (RegExp(r'^\+?[\d\s().-]{6,}$').hasMatch(trimmed) &&
      RegExp(r'\d{3}').hasMatch(trimmed.replaceAll(RegExp(r'\D'), ''))) {
    return 'tel:${trimmed.replaceAll(RegExp(r'[\s().-]'), '')}';
  }
  if (RegExp(r'^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$').hasMatch(trimmed)) return 'mailto:$trimmed';
  if (RegExp(r'^[^\s/]+\.[a-zA-Z]{2,}([/:?#].*)?$').hasMatch(trimmed)) return 'https://$trimmed';
  return trimmed;
}

String? _hostOf(String uri) =>
    RegExp(r'^https?://(?:[^@/?#]*@)?([^/?#:]+)', caseSensitive: false).firstMatch(uri)?.group(1)?.toLowerCase();

/// Mirrors `ReminderActionRules.isAllowedUri` exactly.
bool isAllowedActionUri(String uri) {
  if (uri.isEmpty || uri.length > maxActionUriLength) return false;
  if (RegExp(r'[\s\u0000-\u001f\u007f]').hasMatch(uri)) return false;
  final scheme = _schemeOf(uri)?.toLowerCase();
  if (scheme == null || _blockedSchemes.contains(scheme)) return false;
  final rest = uri.substring(scheme.length + 1);
  if (rest.isEmpty) return false;
  return switch (scheme) {
    'http' || 'https' => (_hostOf(uri) ?? '').isNotEmpty,
    'tel' => RegExp(r'\d').allMatches(rest).length >= 3,
    'mailto' => rest.contains('@'),
    _ => true,
  };
}

enum ActionTarget { youtube, spotify, maps, phone, email, sms, web, app }

bool _matchesHost(String host, String domain) => host == domain || host.endsWith('.$domain');

/// Which kind of place a link leads: drives the icon and default button text.
ActionTarget actionTargetOf(String uri) {
  switch (_schemeOf(uri)?.toLowerCase() ?? '') {
    case 'tel':
      return ActionTarget.phone;
    case 'mailto':
      return ActionTarget.email;
    case 'sms' || 'smsto':
      return ActionTarget.sms;
    case 'geo':
      return ActionTarget.maps;
    case 'spotify':
      return ActionTarget.spotify;
    case 'vnd.youtube' || 'youtube':
      return ActionTarget.youtube;
    case 'http' || 'https':
      break;
    default:
      return ActionTarget.app;
  }
  final host = _hostOf(uri) ?? '';
  if (_matchesHost(host, 'youtube.com') || host == 'youtu.be') return ActionTarget.youtube;
  if (_matchesHost(host, 'spotify.com') || host == 'spotify.link') return ActionTarget.spotify;
  if (host == 'maps.app.goo.gl' ||
      host.startsWith('maps.google.') ||
      (RegExp(r'^(www\.)?google\.[a-z.]+$').hasMatch(host) &&
          RegExp(r'^https?://[^/]+/maps', caseSensitive: false).hasMatch(uri)) ||
      RegExp(r'^https?://goo\.gl/maps', caseSensitive: false).hasMatch(uri)) {
    return ActionTarget.maps;
  }
  return ActionTarget.web;
}

/// A short host for "Opens example.com" hints; null for non-web links.
String? displayHostOf(String uri) => _hostOf(uri)?.replaceFirst(RegExp(r'^www\.'), '');

/// Translation keys for the derived button text, as in `en.ts`.
String actionTargetLabelKey(ActionTarget target) => 'reminders.action.default.${target.name}';

/// The user's own words when they gave some, otherwise one derived from the link.
String actionButtonLabel(ReminderAction action, String Function(String key) t) {
  final custom = action.label?.trim();
  if (custom != null && custom.isNotEmpty) return custom;
  return t(actionTargetLabelKey(actionTargetOf(action.uri)));
}

/// The editor's raw fields; normalized only when read.
final class ActionDraft {
  const ActionDraft({required this.enabled, required this.link, required this.label});

  factory ActionDraft.fromAction(ReminderAction? action) =>
      ActionDraft(enabled: action != null, link: action?.uri ?? '', label: action?.label ?? '');

  final bool enabled;
  final String link;
  final String label;
}

/// The draft as the editor saves it.
sealed class DraftAction {
  const DraftAction();
}

final class NoAction extends DraftAction {
  const NoAction();
}

/// The user asked for a link that cannot be opened.
final class InvalidAction extends DraftAction {
  const InvalidAction();
}

final class ValidAction extends DraftAction {
  const ValidAction(this.action);
  final ReminderAction action;
}

DraftAction actionFromDraft(ActionDraft draft) {
  if (!draft.enabled) return const NoAction();
  final uri = normalizeActionUri(draft.link);
  if (!isAllowedActionUri(uri)) return const InvalidAction();
  final label = draft.label.trim();
  return ValidAction(ReminderAction(uri: uri, label: label.isEmpty ? null : label));
}
