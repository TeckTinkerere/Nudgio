import 'package:flutter/material.dart';

import '../theme.dart';
import '../tokens.dart';

enum ButtonVariant { filled, tonal, outlined, text, destructive }

enum ButtonSize { standard, alarm }

/// Port of `components/Button.tsx` (MR-04 "Buttons").
///
/// The label never shrinks or truncates (MR-13): it wraps instead. While
/// loading, the spinner takes the icon slot and the label stays, so the
/// button keeps its width.
class NButton extends StatelessWidget {
  const NButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = ButtonVariant.filled,
    this.size = ButtonSize.standard,
    this.icon,
    this.loading = false,
    this.disabled = false,
    this.disabledReason,
    this.fullWidth = false,
  });

  final String label;
  final VoidCallback onPressed;
  final ButtonVariant variant;
  final ButtonSize size;
  final IconData? icon;
  final bool loading;
  final bool disabled;

  /// Read by screen readers as the hint when [disabled].
  final String? disabledReason;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final c = NudgioTheme.of(context).color;
    final inert = disabled || loading;

    final (Color background, Color content, Color border) = switch (variant) {
      ButtonVariant.filled => (c.primary, c.onPrimary, Colors.transparent),
      ButtonVariant.tonal => (c.secondaryContainer, c.onSecondaryContainer, Colors.transparent),
      ButtonVariant.outlined => (Colors.transparent, c.primary, c.outline),
      ButtonVariant.text => (Colors.transparent, c.primary, Colors.transparent),
      ButtonVariant.destructive => (c.error, c.onError, Colors.transparent),
    };
    final filledLike = variant == ButtonVariant.filled || variant == ButtonVariant.destructive;
    final contentColor = inert ? c.onSurfaceDisabled : content;
    final fill = inert ? (filledLike ? c.surfaceContainerHigh : Colors.transparent) : background;
    final isAlarm = size == ButtonSize.alarm;

    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(isAlarm ? Radii.alarmAction : Radii.field),
      side: variant == ButtonVariant.outlined
          ? BorderSide(color: inert ? c.outlineVariant : border, width: Layout.borderWidth)
          : BorderSide.none,
    );

    final leading = loading
        ? SizedBox.square(
            dimension: 18,
            child: ExcludeSemantics(child: CircularProgressIndicator(strokeWidth: 2, color: contentColor)),
          )
        : icon == null
            ? null
            : Icon(icon, size: 18, color: contentColor);

    final body = Row(
      mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (leading != null) ...[leading, const SizedBox(width: Spacing.xs)],
        Flexible(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelLarge!.copyWith(color: contentColor),
          ),
        ),
      ],
    );

    return Semantics(
      button: true,
      enabled: !inert,
      label: label,
      hint: disabled ? disabledReason : null,
      excludeSemantics: true,
      child: Material(
        color: fill,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: inert ? null : onPressed,
          splashColor: contentColor.withValues(alpha: StateLayerOpacity.pressed),
          highlightColor: contentColor.withValues(alpha: StateLayerOpacity.hover),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: isAlarm ? Layout.alarmActionPreferredHeight : Layout.minTouchTarget,
              minWidth: Layout.minTouchTarget,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: Spacing.xl, vertical: Spacing.sm),
              child: Center(widthFactor: fullWidth ? null : 1, child: body),
            ),
          ),
        ),
      ),
    );
  }
}
