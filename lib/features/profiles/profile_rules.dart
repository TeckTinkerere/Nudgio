/// Custom alert profiles (DL-123), the pure part: the bounds the editor
/// offers, checking a draft before it is sent, and what may be deleted.
///
/// Native decides (`ProfileRules.kt`); this mirrors it so the editor can mark
/// a field before the round trip, and `profile_rules_test.dart` mirrors
/// `ProfileRulesTest.kt` so the two cannot drift apart unnoticed.
library;

import '../../native/types.dart';

const minTimeoutSeconds = 15;
const maxTimeoutSeconds = 600;
const minRetryCount = 0;
const maxRetryCount = 3;
const minGraceSeconds = 60;
const maxGraceSeconds = 3600;
const minSnoozeMinutes = 1;
const maxSnoozeMinutes = 120;
const maxProfileNameLength = 40;
const maxCustomProfiles = 20;

/// Built-in names are localization keys under this prefix.
const builtInNamePrefix = 'profile.';

/// The wire names native rejects with (`AppError.field`), plus [limit].
enum ProfileField {
  name,
  fullScreenWhenLocked,
  timeoutSeconds,
  retryCount,
  graceSeconds,
  defaultSnoozeMinutes,
  limit,
}

/// What the editor holds while the user changes a profile.
final class ProfileDraft {
  const ProfileDraft({
    this.id,
    this.entityVersion,
    this.isBuiltIn = false,
    required this.name,
    required this.fullScreenWhenLocked,
    required this.timeoutSeconds,
    required this.retryCount,
    required this.graceSeconds,
    required this.defaultSnoozeMinutes,
  });

  /// A new profile starts from Standard's values: it rings, for five minutes,
  /// and comes back once.
  const ProfileDraft.blank()
      : id = null,
        entityVersion = null,
        isBuiltIn = false,
        name = '',
        fullScreenWhenLocked = true,
        timeoutSeconds = 300,
        retryCount = 1,
        graceSeconds = 600,
        defaultSnoozeMinutes = 10;

  factory ProfileDraft.from(ReminderProfile profile) => ProfileDraft(
        id: profile.id,
        entityVersion: profile.entityVersion,
        isBuiltIn: profile.isBuiltIn,
        name: profile.nameKey,
        fullScreenWhenLocked: profile.fullScreenWhenLocked,
        timeoutSeconds: profile.timeoutSeconds,
        retryCount: profile.retryCount,
        graceSeconds: profile.graceSeconds,
        defaultSnoozeMinutes: profile.defaultSnoozeMinutes,
      );

  final String? id;
  final int? entityVersion;
  final bool isBuiltIn;
  final String name;
  final bool fullScreenWhenLocked;
  final int timeoutSeconds;
  final int retryCount;
  final int graceSeconds;
  final int defaultSnoozeMinutes;

  /// A built-in keeps its name and whether it rings, so neither is sent.
  SaveProfileRequest toRequest() => SaveProfileRequest(
        id: id,
        expectedEntityVersion: entityVersion,
        name: isBuiltIn ? null : cleanProfileName(name),
        fullScreenWhenLocked: isBuiltIn ? null : fullScreenWhenLocked,
        timeoutSeconds: timeoutSeconds,
        retryCount: retryCount,
        graceSeconds: graceSeconds,
        defaultSnoozeMinutes: defaultSnoozeMinutes,
      );
}

/// Trimmed with inner whitespace collapsed; null when empty, too long, holding
/// a control character, or shaped like a built-in's key.
String? cleanProfileName(String? raw) {
  if (raw == null) return null;
  final name = raw.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (name.isEmpty || name.length > maxProfileNameLength) return null;
  if (name.runes.any((r) => r < 0x20 || (r >= 0x7f && r <= 0x9f))) return null;
  if (name.toLowerCase().startsWith(builtInNamePrefix)) return null;
  return name;
}

/// The first problem with [draft], in the order native reports them, or null
/// when it can be saved. [all] is every stored profile.
ProfileField? checkProfileDraft(ProfileDraft draft, List<ReminderProfile> all) {
  bool within(int value, int min, int max) => value >= min && value <= max;
  if (!within(draft.timeoutSeconds, minTimeoutSeconds, maxTimeoutSeconds)) return ProfileField.timeoutSeconds;
  if (!within(draft.retryCount, minRetryCount, maxRetryCount)) return ProfileField.retryCount;
  if (!within(draft.graceSeconds, minGraceSeconds, maxGraceSeconds)) return ProfileField.graceSeconds;
  if (!within(draft.defaultSnoozeMinutes, minSnoozeMinutes, maxSnoozeMinutes)) {
    return ProfileField.defaultSnoozeMinutes;
  }
  if (draft.isBuiltIn) return null;

  final name = cleanProfileName(draft.name);
  if (name == null) return ProfileField.name;
  final others = all.where((p) => !p.isBuiltIn && p.id != draft.id);
  if (others.any((p) => p.nameKey.toLowerCase() == name.toLowerCase())) return ProfileField.name;
  if (draft.id == null && others.length >= maxCustomProfiles) return ProfileField.limit;
  return null;
}

/// Only a custom profile that no reminder uses can be deleted.
bool canDeleteProfile(ReminderProfile profile) => !profile.isBuiltIn && profile.reminderCount == 0;

/// The longest one alarm can keep coming back: every ring plus every wait
/// between rings. Shown in the editor so "3 retries" is a time, not a number.
Duration longestAlert(ProfileDraft draft) => Duration(
      seconds: draft.timeoutSeconds * (draft.retryCount + 1) + draft.graceSeconds * draft.retryCount,
    );
