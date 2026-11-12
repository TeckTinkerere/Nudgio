// Semantic color roles and the brand / alarm / Material You schemes.
// Port of `colorRoles.ts`, `schemes.ts` and `materialYou.ts`.
import 'dart:ui' show Brightness, Color;

import 'color_utils.dart';
import 'tokens.dart';

/// The contract every surface codes against: a screen asks for
/// `theme.color.onSurfaceVariant`, never a literal brand hue.
class ColorRoles {
  const ColorRoles({
    required this.primary,
    required this.onPrimary,
    required this.primaryContainer,
    required this.onPrimaryContainer,
    required this.secondary,
    required this.onSecondary,
    required this.secondaryContainer,
    required this.onSecondaryContainer,
    required this.surface,
    required this.surfaceContainer,
    required this.surfaceContainerHigh,
    required this.onSurface,
    required this.onSurfaceVariant,
    required this.onSurfaceDisabled,
    required this.outline,
    required this.outlineVariant,
    required this.error,
    required this.onError,
    required this.errorContainer,
    required this.onErrorContainer,
    required this.warning,
    required this.warningContainer,
    required this.onWarningContainer,
    required this.success,
    required this.onSuccess,
    required this.successContainer,
    required this.onSuccessContainer,
    required this.scrim,
    required this.inverseSurface,
    required this.inverseOnSurface,
    required this.focusRing,
  });

  final Color primary, onPrimary, primaryContainer, onPrimaryContainer;
  final Color secondary, onSecondary, secondaryContainer, onSecondaryContainer;
  final Color surface, surfaceContainer, surfaceContainerHigh;
  final Color onSurface, onSurfaceVariant, onSurfaceDisabled;
  final Color outline, outlineVariant;
  final Color error, onError, errorContainer, onErrorContainer;
  final Color warning, warningContainer, onWarningContainer;
  final Color success, onSuccess, successContainer, onSuccessContainer;
  final Color scrim, inverseSurface, inverseOnSurface, focusRing;

  /// MR-13 high contrast: promote separators and secondary content.
  ColorRoles highContrast() => ColorRoles(
        primary: primary,
        onPrimary: onPrimary,
        primaryContainer: primaryContainer,
        onPrimaryContainer: onPrimaryContainer,
        secondary: secondary,
        onSecondary: onSecondary,
        secondaryContainer: secondaryContainer,
        onSecondaryContainer: onSecondaryContainer,
        surface: surface,
        surfaceContainer: surfaceContainer,
        surfaceContainerHigh: surfaceContainerHigh,
        onSurface: onSurface,
        onSurfaceVariant: onSurface,
        onSurfaceDisabled: onSurfaceDisabled,
        outline: outline,
        outlineVariant: outline,
        error: error,
        onError: onError,
        errorContainer: errorContainer,
        onErrorContainer: onErrorContainer,
        warning: warning,
        warningContainer: warningContainer,
        onWarningContainer: onWarningContainer,
        success: success,
        onSuccess: onSuccess,
        successContainer: successContainer,
        onSuccessContainer: onSuccessContainer,
        scrim: scrim,
        inverseSurface: inverseSurface,
        inverseOnSurface: inverseOnSurface,
        focusRing: focusRing,
      );

  /// Every role by name, for the parity test against the RN snapshot.
  Map<String, Color> toMap() => {
        'primary': primary,
        'onPrimary': onPrimary,
        'primaryContainer': primaryContainer,
        'onPrimaryContainer': onPrimaryContainer,
        'secondary': secondary,
        'onSecondary': onSecondary,
        'secondaryContainer': secondaryContainer,
        'onSecondaryContainer': onSecondaryContainer,
        'surface': surface,
        'surfaceContainer': surfaceContainer,
        'surfaceContainerHigh': surfaceContainerHigh,
        'onSurface': onSurface,
        'onSurfaceVariant': onSurfaceVariant,
        'onSurfaceDisabled': onSurfaceDisabled,
        'outline': outline,
        'outlineVariant': outlineVariant,
        'error': error,
        'onError': onError,
        'errorContainer': errorContainer,
        'onErrorContainer': onErrorContainer,
        'warning': warning,
        'warningContainer': warningContainer,
        'onWarningContainer': onWarningContainer,
        'success': success,
        'onSuccess': onSuccess,
        'successContainer': successContainer,
        'onSuccessContainer': onSuccessContainer,
        'scrim': scrim,
        'inverseSurface': inverseSurface,
        'inverseOnSurface': inverseOnSurface,
        'focusRing': focusRing,
      };
}

/// Status trio (MR-13 ACC-004): consumers must also render an icon and label.
class StatusRole {
  const StatusRole({required this.color, required this.container, required this.onContainer});

  /// Accent on the app surface (>=3:1). Not for content on [container].
  final Color color;
  final Color container;

  /// Text and icon color on [container] (>=4.5:1).
  final Color onContainer;
}

class StatusRoles {
  const StatusRoles({
    required this.ready,
    required this.limited,
    required this.actionNeeded,
    required this.neutral,
  });

  factory StatusRoles.of(ColorRoles s) => StatusRoles(
        ready: StatusRole(color: s.success, container: s.successContainer, onContainer: s.onSuccessContainer),
        limited: StatusRole(color: s.warning, container: s.warningContainer, onContainer: s.onWarningContainer),
        actionNeeded: StatusRole(color: s.error, container: s.errorContainer, onContainer: s.onErrorContainer),
        neutral: StatusRole(color: s.onSurfaceVariant, container: s.surfaceContainerHigh, onContainer: s.onSurface),
      );

  final StatusRole ready, limited, actionNeeded, neutral;

  Map<String, StatusRole> toMap() =>
      {'ready': ready, 'limited': limited, 'actionNeeded': actionNeeded, 'neutral': neutral};
}

ColorRoles _brandScheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final base = isDark ? BrandPalette.dark : BrandPalette.light;
  final opposite = isDark ? BrandPalette.light : BrandPalette.dark;
  const black = BrandPalette.black;
  const white = BrandPalette.white;
  final successContainer = blend(base.surface, base.success, isDark ? 0.24 : 0.12);

  return ColorRoles(
    primary: base.primary,
    onPrimary: base.onPrimary,
    primaryContainer: base.primaryContainer,
    onPrimaryContainer: base.onPrimaryContainer,
    secondary: base.secondary,
    onSecondary: base.onSecondary,
    secondaryContainer: base.secondaryContainer,
    onSecondaryContainer: base.onSecondaryContainer,
    surface: base.surface,
    surfaceContainer: base.surfaceContainer,
    surfaceContainerHigh: blend(base.surfaceContainer, isDark ? white : black, 0.04),
    onSurface: base.onSurface,
    onSurfaceVariant: base.onSurfaceVariant,
    onSurfaceDisabled: blend(base.surface, base.onSurface, StateLayerOpacity.disabledContent),
    outline: base.outline,
    outlineVariant: blend(base.surface, base.outline, 0.45),
    error: base.error,
    onError: readableOn(base.error, white, black),
    errorContainer: base.errorContainer,
    onErrorContainer: base.onErrorContainer,
    warning: base.warning,
    warningContainer: base.warningContainer,
    onWarningContainer: base.onWarningContainer,
    success: base.success,
    onSuccess: readableOn(base.success, white, black),
    successContainer: successContainer,
    onSuccessContainer: preferAccessible(successContainer, base.success, base.onSurface),
    scrim: withAlpha(black, isDark ? BrandPalette.scrimOpacityDark : BrandPalette.scrimOpacityLight),
    inverseSurface: opposite.surfaceContainer,
    inverseOnSurface: opposite.onSurface,
    focusRing: base.primary,
  );
}

final ColorRoles lightScheme = _brandScheme(Brightness.light);
final ColorRoles darkScheme = _brandScheme(Brightness.dark);

/// MR-04: the alarm surface is dark in both app themes and never follows
/// Material You, so 3am recognition does not depend on the wallpaper.
final ColorRoles alarmScheme = darkScheme;

/// Android's `system_accent*` / `system_neutral*` ramps (API 31+), keyed by
/// tone stop. Built by the host; null when unavailable.
class DynamicColorPayload {
  const DynamicColorPayload({
    required this.accent1,
    required this.accent2,
    required this.accent3,
    required this.neutral1,
    required this.neutral2,
  });

  static const toneStops = [0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

  final Map<int, Color> accent1, accent2, accent3, neutral1, neutral2;

  /// Runtime-decode the host payload (MR-18). Malformed input degrades to the
  /// brand palette instead of throwing during theme construction.
  static DynamicColorPayload? decode(Object? value) {
    if (value is! Map) return null;
    final hex = RegExp(r'^#[0-9a-fA-F]{6}$');
    Map<int, Color>? ramp(Object? raw) {
      if (raw is! Map) return null;
      final out = <int, Color>{};
      for (final stop in toneStops) {
        final entry = raw['$stop'];
        if (entry is! String || !hex.hasMatch(entry)) return null;
        out[stop] = Color(0xFF000000 | int.parse(entry.substring(1), radix: 16));
      }
      return out;
    }

    final a1 = ramp(value['accent1']), a2 = ramp(value['accent2']), a3 = ramp(value['accent3']);
    final n1 = ramp(value['neutral1']), n2 = ramp(value['neutral2']);
    if (a1 == null || a2 == null || a3 == null || n1 == null || n2 == null) return null;
    return DynamicColorPayload(accent1: a1, accent2: a2, accent3: a3, neutral1: n1, neutral2: n2);
  }
}

/// Map dynamic ramps onto roles. Status colors stay on brand so error,
/// success and warning keep their meaning on any wallpaper.
ColorRoles schemeFromDynamicColor(DynamicColorPayload p, Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final fallback = isDark ? darkScheme : lightScheme;
  Color t(Map<int, Color> ramp, int dark, int light) => ramp[isDark ? dark : light]!;

  final surface = t(p.neutral1, 900, 10);
  final onSurface = t(p.neutral1, 100, 900);
  final primary = t(p.accent1, 200, 600);
  final errorContainer = blend(surface, fallback.error, isDark ? 0.24 : 0.12);
  final successContainer = blend(surface, fallback.success, isDark ? 0.24 : 0.12);
  final warningContainer = blend(surface, fallback.warning, isDark ? 0.24 : 0.12);

  return ColorRoles(
    primary: primary,
    onPrimary: t(p.accent1, 800, 0),
    primaryContainer: t(p.accent1, 700, 100),
    onPrimaryContainer: t(p.accent1, 100, 900),
    secondary: t(p.accent2, 200, 600),
    onSecondary: t(p.accent2, 800, 0),
    secondaryContainer: t(p.accent2, 700, 100),
    onSecondaryContainer: t(p.accent2, 100, 900),
    surface: surface,
    surfaceContainer: t(p.neutral1, 800, 100),
    surfaceContainerHigh: t(p.neutral1, 700, 200),
    onSurface: onSurface,
    onSurfaceVariant: t(p.neutral2, 200, 700),
    onSurfaceDisabled: blend(surface, onSurface, 0.38),
    outline: t(p.neutral2, 400, 500),
    outlineVariant: t(p.neutral2, 700, 200),
    error: fallback.error,
    onError: fallback.onError,
    errorContainer: errorContainer,
    onErrorContainer: preferAccessible(errorContainer, fallback.error, onSurface),
    warning: fallback.warning,
    warningContainer: warningContainer,
    onWarningContainer: preferAccessible(warningContainer, fallback.warning, onSurface),
    success: fallback.success,
    onSuccess: fallback.onSuccess,
    successContainer: successContainer,
    onSuccessContainer: preferAccessible(successContainer, fallback.success, onSurface),
    scrim: withAlpha(BrandPalette.black, isDark ? 0.64 : 0.48),
    inverseSurface: t(p.neutral1, 100, 800),
    inverseOnSurface: t(p.neutral1, 800, 50),
    focusRing: readableOn(surface, primary, onSurface),
  );
}
