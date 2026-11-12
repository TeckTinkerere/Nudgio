// Theme construction. Port of `buildTheme.ts`, adapted to Flutter: the
// semantic roles ride on `ThemeData` as a `ThemeExtension`, and the Material
// `ColorScheme` / `TextTheme` are filled from the same roles so stock widgets
// already look on-brand before each design-system component is ported.
import 'package:flutter/material.dart';

import 'color_roles.dart';
import 'tokens.dart';

enum ColorSource { brand, materialYou }

/// Read with `NudgioTheme.of(context)`.
@immutable
class NudgioTheme extends ThemeExtension<NudgioTheme> {
  const NudgioTheme({required this.brightness, required this.colorSource, required this.color, required this.status});

  final Brightness brightness;
  final ColorSource colorSource;
  final ColorRoles color;
  final StatusRoles status;

  static NudgioTheme of(BuildContext context) => Theme.of(context).extension<NudgioTheme>()!;

  @override
  NudgioTheme copyWith({ColorRoles? color}) => NudgioTheme(
        brightness: brightness,
        colorSource: colorSource,
        color: color ?? this.color,
        status: StatusRoles.of(color ?? this.color),
      );

  // Theme switches are instant (MR-04: no decorative motion), so no lerp.
  @override
  NudgioTheme lerp(NudgioTheme? other, double t) => t < 0.5 || other == null ? this : other;
}

TextTheme _textTheme(Color onSurface) {
  TextStyle s(TypeRole role) => TextStyle(
        fontSize: role.style.fontSize,
        height: role.style.height,
        fontWeight: role.style.fontWeight,
        color: onSurface,
      );
  return TextTheme(
    displaySmall: s(TypeRole.displaySmall),
    headlineLarge: s(TypeRole.headlineLarge),
    headlineMedium: s(TypeRole.headlineMedium),
    titleLarge: s(TypeRole.titleLarge),
    titleMedium: s(TypeRole.titleMedium),
    bodyLarge: s(TypeRole.bodyLarge),
    bodyMedium: s(TypeRole.bodyMedium),
    labelLarge: s(TypeRole.labelLarge),
    labelMedium: s(TypeRole.labelMedium),
  );
}

ThemeData _themeData(Brightness brightness, ColorSource source, ColorRoles c) {
  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.primary,
    onPrimary: c.onPrimary,
    primaryContainer: c.primaryContainer,
    onPrimaryContainer: c.onPrimaryContainer,
    secondary: c.secondary,
    onSecondary: c.onSecondary,
    secondaryContainer: c.secondaryContainer,
    onSecondaryContainer: c.onSecondaryContainer,
    error: c.error,
    onError: c.onError,
    errorContainer: c.errorContainer,
    onErrorContainer: c.onErrorContainer,
    surface: c.surface,
    onSurface: c.onSurface,
    onSurfaceVariant: c.onSurfaceVariant,
    surfaceContainer: c.surfaceContainer,
    surfaceContainerHigh: c.surfaceContainerHigh,
    outline: c.outline,
    outlineVariant: c.outlineVariant,
    scrim: c.scrim,
    inverseSurface: c.inverseSurface,
    onInverseSurface: c.inverseOnSurface,
    inversePrimary: c.primaryContainer,
    // Tonal elevation is applied explicitly by components (MR-04).
    surfaceTint: c.primary,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.surface,
    textTheme: _textTheme(c.onSurface),
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
    focusColor: c.focusRing.withValues(alpha: StateLayerOpacity.focus),
    cardTheme: CardThemeData(
      color: c.surfaceContainer,
      elevation: Elevation.level1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.card),
        // MR-04: never a shadow-only boundary in dark mode.
        side: brightness == Brightness.dark ? BorderSide(color: c.outlineVariant) : BorderSide.none,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: c.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.dialog)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: c.inverseSurface,
      contentTextStyle: TextStyle(color: c.inverseOnSurface),
      behavior: SnackBarBehavior.floating,
    ),
    extensions: [NudgioTheme(brightness: brightness, colorSource: source, color: c, status: StatusRoles.of(c))],
  );
}

/// Build the app theme. Brand palette is the default; Material You applies
/// only when the user opted in and the host reported a palette. Font scale,
/// reduced motion and width class come from `MediaQuery` at use sites rather
/// than being baked in here, unlike the RN theme object.
ThemeData buildTheme({
  required Brightness brightness,
  DynamicColorPayload? dynamicColor,
  bool useMaterialYou = false,
  bool highContrast = false,
}) {
  final dynamic = useMaterialYou && dynamicColor != null;
  var color = dynamic
      ? schemeFromDynamicColor(dynamicColor, brightness)
      : (brightness == Brightness.dark ? darkScheme : lightScheme);
  if (highContrast) color = color.highContrast();
  return _themeData(brightness, dynamic ? ColorSource.materialYou : ColorSource.brand, color);
}

/// The alarm theme: always dark brand, never Material You (MR-04).
ThemeData buildAlarmTheme({bool highContrast = false}) => _themeData(
      Brightness.dark,
      ColorSource.brand,
      highContrast ? alarmScheme.highContrast() : alarmScheme,
    );
