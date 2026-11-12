import 'package:flutter/material.dart';

import '../color_utils.dart';
import '../theme.dart';
import '../tokens.dart';

/// Port of `components/Card.tsx` plus the RN `useSurfaceStyle` rule: tonal
/// elevation always, and an outline in dark mode or high contrast so a shadow
/// is never the only boundary (MR-04).
class NCard extends StatelessWidget {
  const NCard({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.padding = Layout.cardPadding,
    this.elevationLevel = 1,
    this.selected = false,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double padding;

  /// 0-4, matching the `Elevation` tokens.
  final int elevationLevel;
  final bool selected;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final theme = NudgioTheme.of(context);
    final c = theme.color;
    final background =
        selected ? c.primaryContainer : applyTonalElevation(c.surfaceContainer, c.primary, elevationLevel);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(Radii.card),
      side: theme.needsSurfaceOutline
          ? BorderSide(color: c.outlineVariant, width: Layout.borderWidth)
          : BorderSide.none,
    );
    final content = Padding(padding: EdgeInsets.all(padding), child: child);
    final interactive = onTap != null || onLongPress != null;

    return Semantics(
      container: true,
      button: interactive,
      selected: interactive ? selected : null,
      label: semanticLabel,
      child: Material(
        color: background,
        elevation: elevationLevel.toDouble(),
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: interactive
            ? InkWell(
                onTap: onTap,
                onLongPress: onLongPress,
                highlightColor: c.surfaceContainerHigh,
                splashColor: c.onSurface.withValues(alpha: StateLayerOpacity.pressed),
                child: content,
              )
            : content,
      ),
    );
  }
}
