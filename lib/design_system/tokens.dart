// Design tokens (MR-04), ported one-for-one from `src/design-system/tokens`.
//
// These are the only literal design values in the Flutter app. Product code
// reads semantic roles through `NudgioTheme`, never these raw values, so a
// density or palette change is a one-file edit (same rule as the RN app).
import 'dart:math' as math;
import 'dart:ui' show Color, FontWeight;

import 'package:flutter/animation.dart' show Cubic, Curve, Curves;

/// Ink & Apricot brand palette (MR-04 "Color system").
abstract final class BrandPalette {
  static const light = BrandScheme(
    primary: Color(0xFF2D4DB5),
    onPrimary: Color(0xFFFFFFFF),
    primaryContainer: Color(0xFFE7ECFB),
    onPrimaryContainer: Color(0xFF2D4DB5),
    secondary: Color(0xFFE9B58E),
    onSecondary: Color(0xFF56321C),
    secondaryContainer: Color(0xFFF8E9DC),
    onSecondaryContainer: Color(0xFF70401F),
    surface: Color(0xFFF7F4EE),
    surfaceContainer: Color(0xFFFFFEFA),
    onSurface: Color(0xFF202638),
    onSurfaceVariant: Color(0xFF5F6675),
    outline: Color(0xFF767E90),
    error: Color(0xFFB42332),
    errorContainer: Color(0xFFFCE8E9),
    onErrorContainer: Color(0xFFB42332),
    warning: Color(0xFF805600),
    warningContainer: Color(0xFFFFF0CA),
    onWarningContainer: Color(0xFF805600),
    success: Color(0xFF2D4DB5),
  );

  static const dark = BrandScheme(
    primary: Color(0xFFBAC8FF),
    onPrimary: Color(0xFF172654),
    primaryContainer: Color(0xFF26314E),
    onPrimaryContainer: Color(0xFFBAC8FF),
    secondary: Color(0xFFF1BE98),
    onSecondary: Color(0xFF56321C),
    secondaryContainer: Color(0xFF392A21),
    onSecondaryContainer: Color(0xFFFFD2AF),
    surface: Color(0xFF11141D),
    surfaceContainer: Color(0xFF1D2230),
    onSurface: Color(0xFFF3F1EC),
    onSurfaceVariant: Color(0xFFBCC2D0),
    outline: Color(0xFF858FA5),
    error: Color(0xFFFFB5BE),
    errorContainer: Color(0xFF421F29),
    onErrorContainer: Color(0xFFFFB5BE),
    warning: Color(0xFFFFE0A0),
    warningContainer: Color(0xFF382B12),
    onWarningContainer: Color(0xFFFFE0A0),
    success: Color(0xFFBAC8FF),
  );

  /// MR-04 scrim: black at 48% in light, 64% in dark.
  static const scrimOpacityLight = 0.48;
  static const scrimOpacityDark = 0.64;

  static const black = Color(0xFF000000);
  static const white = Color(0xFFFFFFFF);
}

class BrandScheme {
  const BrandScheme({
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
    required this.onSurface,
    required this.onSurfaceVariant,
    required this.outline,
    required this.error,
    required this.errorContainer,
    required this.onErrorContainer,
    required this.warning,
    required this.warningContainer,
    required this.onWarningContainer,
    required this.success,
  });

  final Color primary, onPrimary, primaryContainer, onPrimaryContainer;
  final Color secondary, onSecondary, secondaryContainer, onSecondaryContainer;
  final Color surface, surfaceContainer, onSurface, onSurfaceVariant, outline;
  final Color error, errorContainer, onErrorContainer;
  final Color warning, warningContainer, onWarningContainer;
  final Color success;
}

/// Material state-layer opacities (MR-04 "States").
abstract final class StateLayerOpacity {
  static const hover = 0.08;
  static const focus = 0.12;
  static const pressed = 0.12;
  static const dragged = 0.16;
  static const disabledContainer = 0.12;
  static const disabledContent = 0.38;
}

/// Spacing scale, 4 dp base (MR-04 "Spacing and grid").
abstract final class Spacing {
  static const baseUnit = 4.0;
  static const none = 0.0;
  static const xxs = 4.0;
  static const xs = 8.0;
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 20.0;
  static const xl = 24.0;
  static const xxl = 32.0;
  static const xxxl = 40.0;
}

/// Fixed product protections. Several are MR-13 ACC-002 floors and MUST NOT
/// be lowered to make a layout fit.
abstract final class Layout {
  static const screenPaddingHorizontal = Spacing.md;
  static const dialogPadding = Spacing.xl;
  static const cardPadding = Spacing.md;
  static const sectionGap = Spacing.xl;
  static const contentMaxWidth = 840.0;
  static const minTouchTarget = 48.0;
  static const alarmActionMinHeight = 56.0;
  static const alarmActionPreferredHeight = 64.0;
  static const listRowMinHeight = 64.0;
  static const reminderThumbnailSize = 64.0;
  static const focusRingWidth = 2.0;
  static const borderWidth = 1.0;

  /// `min(144dp, 20% of usable viewport)` (MR-04 / MR-03).
  static double inAppStripMaxHeight(double usableViewportHeight) =>
      math.min(144, usableViewportHeight * 0.2);
}

/// Corner radii (MR-04 "Shape and elevation").
abstract final class Radii {
  static const none = 0.0;
  static const chip = 8.0;
  static const field = 12.0;
  static const card = 16.0;
  static const alarmAction = 20.0;
  static const dueStrip = 20.0;
  static const dialog = 24.0;
  static const sheet = 28.0;
  static const full = 9999.0;
}

/// Elevation levels in dp; the theme also maps each to a tonal tint.
abstract final class Elevation {
  static const level0 = 0.0;
  static const level1 = 1.0;
  static const level2 = 2.0;
  static const level3 = 3.0;
  static const level4 = 4.0;
}

class TypeStyle {
  const TypeStyle(this.fontSize, this.lineHeight, this.fontWeight);
  final double fontSize;
  final double lineHeight;
  final FontWeight fontWeight;

  /// Flutter's `height` is a multiple of the font size.
  double get height => lineHeight / fontSize;
}

/// Type scale in sp (MR-04 "Typography"). Never disables system font scaling.
enum TypeRole {
  displaySmall(TypeStyle(36, 44, FontWeight.w500)),
  headlineLarge(TypeStyle(32, 40, FontWeight.w500)),
  headlineMedium(TypeStyle(28, 36, FontWeight.w500)),
  titleLarge(TypeStyle(22, 28, FontWeight.w600)),
  titleMedium(TypeStyle(16, 24, FontWeight.w600)),
  bodyLarge(TypeStyle(16, 24, FontWeight.w400)),
  bodyMedium(TypeStyle(14, 20, FontWeight.w400)),
  labelLarge(TypeStyle(14, 20, FontWeight.w600)),
  labelMedium(TypeStyle(12, 16, FontWeight.w600));

  const TypeRole(this.style);
  final TypeStyle style;

  /// Control-label roles that must never shrink to fit (MR-04, MR-13).
  bool get nonShrinkable => switch (this) {
        labelLarge || bodyLarge || titleMedium || titleLarge => true,
        _ => false,
      };
}

/// MR-13 font-scale thresholds for reflowing rather than clipping.
abstract final class FontScaleBreakpoints {
  static const large = 1.3;
  static const extraLarge = 1.6;
  static const maximum = 2.0;
}

enum ReducedMotion { instant, fade, nonVisual }

/// Material 3 easing curves.
abstract final class Easing {
  static const Curve standard = Cubic(0.2, 0.0, 0.0, 1.0);
  static const Curve emphasizedDecelerate = Cubic(0.05, 0.7, 0.1, 1.0);
  static const Curve emphasizedAccelerate = Cubic(0.3, 0.0, 0.8, 0.15);
  static const Curve linear = Curves.linear;
}

/// Motion tokens (MR-04, MR-13 ACC-006). Each declares its reduced-motion
/// counterpart; there is deliberately no looping token.
enum MotionToken {
  navigation(250, Easing.standard, ReducedMotion.fade, 100),
  cardExpand(200, Easing.emphasizedDecelerate, ReducedMotion.instant, 0),
  stripEnter(220, Easing.emphasizedDecelerate, ReducedMotion.fade, 100),
  snackbar(200, Easing.standard, ReducedMotion.fade, 100),
  alarmButtonConfirm(120, Easing.standard, ReducedMotion.nonVisual, 0);

  const MotionToken(this.durationMs, this.curve, this.reduced, this.reducedDurationMs);
  final int durationMs;
  final Curve curve;
  final ReducedMotion reduced;
  final int reducedDurationMs;

  Duration resolve({required bool reduceMotion}) =>
      Duration(milliseconds: reduceMotion ? reducedDurationMs : durationMs);
}

/// Material window size classes (MR-04 "Responsive behavior").
enum WidthClass {
  compact,
  medium,
  expanded;

  static const compactMaxWidth = 600.0;
  static const mediumMaxWidth = 840.0;

  static WidthClass forWidth(double width) => width < compactMaxWidth
      ? compact
      : width < mediumMaxWidth
          ? medium
          : expanded;

  bool get usesRail => this != compact;

  /// MR-03: two-column grid on typical phones.
  int get mediaGridColumns => switch (this) { compact => 2, medium => 3, expanded => 4 };
}
