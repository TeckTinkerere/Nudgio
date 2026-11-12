// Color math for role derivation and MR-13 ACC-005 contrast checks.
// Port of `src/design-system/theme/colorUtils.ts`; pure and dependency-free.
import 'dart:math' as math;
import 'dart:ui' show Color;

int _channel(double unit) => (unit * 255).round().clamp(0, 255);

/// 0-255 channels of an opaque color.
({int r, int g, int b}) rgbOf(Color c) => (r: _channel(c.r), g: _channel(c.g), b: _channel(c.b));

/// `#RRGGBB`, uppercase, for diagnostics and the cross-platform parity test.
String toHex(Color c) {
  final (:r, :g, :b) = rgbOf(c);
  String two(int v) => v.toRadixString(16).padLeft(2, '0');
  return '#${two(r)}${two(g)}${two(b)}'.toUpperCase();
}

/// Composite [foreground] over [background] at [alpha], rounded to 8-bit
/// channels exactly as the TypeScript `blend` does so both apps derive the
/// same hex values.
Color blend(Color background, Color foreground, double alpha) {
  final t = alpha.clamp(0.0, 1.0);
  final bg = rgbOf(background);
  final fg = rgbOf(foreground);
  int mix(int a, int b) => (a + (b - a) * t).round().clamp(0, 255);
  return Color.fromARGB(255, mix(bg.r, fg.r), mix(bg.g, fg.g), mix(bg.b, fg.b));
}

Color withAlpha(Color c, double alpha) {
  final (:r, :g, :b) = rgbOf(c);
  return Color.fromARGB((alpha.clamp(0.0, 1.0) * 255).round(), r, g, b);
}

double _linearize(int channel8Bit) {
  final c = channel8Bit / 255;
  return c <= 0.04045 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
}

/// WCAG 2.x relative luminance, 0 (black) to 1 (white).
double relativeLuminance(Color c) {
  final (:r, :g, :b) = rgbOf(c);
  return 0.2126 * _linearize(r) + 0.7152 * _linearize(g) + 0.0722 * _linearize(b);
}

/// WCAG contrast ratio between two opaque colors, 1:1 to 21:1.
double contrastRatio(Color a, Color b) {
  final la = relativeLuminance(a);
  final lb = relativeLuminance(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// MR-13 ACC-005 thresholds.
abstract final class ContrastMinimum {
  static const normalText = 4.5;
  static const largeText = 3.0;
  static const uiComponent = 3.0;
}

/// Whichever of [light] / [dark] reads better on [background].
Color readableOn(Color background, Color light, Color dark) =>
    contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;

/// Keep [preferred] when it meets [minimum] on [background], else [fallback].
Color preferAccessible(
  Color background,
  Color preferred,
  Color fallback, {
  double minimum = ContrastMinimum.normalText,
}) =>
    contrastRatio(preferred, background) >= minimum ? preferred : fallback;

const _tonalOverlayAlpha = {0: 0.0, 1: 0.05, 2: 0.08, 3: 0.11, 4: 0.12};

/// Material 3 tonal elevation: tint toward the primary hue instead of relying
/// on a shadow (MR-04 forbids shadow-only boundaries in dark mode).
Color applyTonalElevation(Color surface, Color tint, int level) =>
    blend(surface, tint, _tonalOverlayAlpha[level] ?? 0.12);
