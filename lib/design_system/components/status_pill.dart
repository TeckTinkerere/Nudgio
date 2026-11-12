import 'package:flutter/material.dart';

import '../color_roles.dart';
import '../theme.dart';
import '../tokens.dart';

enum StatusKind { ready, limited, actionNeeded, neutral }

/// Port of `components/StatusPill.tsx`. Always icon + label, never color
/// alone (MR-13 ACC-004). Icon and text both use `onContainer`: the amber
/// `color` measures under 3:1 on its own light container.
///
/// Icons are Material placeholders until the brand icon set is ported.
class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.kind, required this.label, this.highEmphasis = true});

  final StatusKind kind;
  final String label;
  final bool highEmphasis;

  static StatusRole roleFor(StatusRoles s, StatusKind kind) => switch (kind) {
        StatusKind.ready => s.ready,
        StatusKind.limited => s.limited,
        StatusKind.actionNeeded => s.actionNeeded,
        StatusKind.neutral => s.neutral,
      };

  static IconData iconFor(StatusKind kind) => switch (kind) {
        StatusKind.ready => Icons.check,
        StatusKind.limited => Icons.warning_amber_rounded,
        StatusKind.actionNeeded => Icons.error_outline,
        StatusKind.neutral => Icons.info_outline,
      };

  @override
  Widget build(BuildContext context) {
    final role = roleFor(NudgioTheme.of(context).status, kind);
    return Semantics(
      label: label,
      excludeSemantics: true,
      child: Container(
        constraints: const BoxConstraints(minHeight: 24),
        padding: const EdgeInsets.symmetric(horizontal: Spacing.xs, vertical: Spacing.xxs),
        decoration: BoxDecoration(
          color: highEmphasis ? role.container : Colors.transparent,
          borderRadius: BorderRadius.circular(Radii.chip),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(iconFor(kind), size: 16, color: role.onContainer),
            const SizedBox(width: Spacing.xxs),
            Flexible(
              child: Text(label, style: Theme.of(context).textTheme.labelMedium!.copyWith(color: role.onContainer)),
            ),
          ],
        ),
      ),
    );
  }
}
