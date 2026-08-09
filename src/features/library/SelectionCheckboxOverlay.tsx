/**
 * Decorative selection checkmark drawn over a `MediaCard` in Library
 * selection mode. Purely visual (`pointerEvents="none"`): the whole card's
 * own `Pressable` is the tap target that toggles selection, so this never
 * needs its own accessible name — the card's existing accessibility label
 * already announces the asset.
 */
import {StyleSheet, View} from 'react-native';

import {Icon, useTheme} from '../../design-system';

export interface SelectionCheckboxOverlayProps {
  readonly selected: boolean;
}

const BADGE_SIZE = 24;

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function SelectionCheckboxOverlay({selected}: SelectionCheckboxOverlayProps) {
  const theme = useTheme();
  const borderWidth = selected ? 0 : theme.layout.borderWidth;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        {
          top: theme.spacing.xxs,
          start: theme.spacing.xxs,
          borderRadius: theme.radius.full,
          backgroundColor: selected ? theme.color.primary : theme.color.surface,
          borderWidth,
          borderColor: theme.color.outline,
        },
      ]}>
      {selected ? <Icon name="check" size="sm" color={theme.color.onPrimary} /> : null}
    </View>
  );
}
