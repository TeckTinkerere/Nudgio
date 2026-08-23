/**
 * Material 3 floating action button (MR-03 "Navigation model": "A floating
 * action button labeled Add opens a modal action sheet...").
 *
 * Always absolutely positioned, bottom-right — a FAB that scrolls with
 * content or sits inline is not a FAB, so the component owns that instead of
 * exposing a generic `style` escape hatch a caller could use to break it.
 * `bottomOffset` is the one thing a host screen legitimately controls: how
 * far up from the screen's bottom edge it sits (e.g. clearing a tab bar).
 *
 * `label` is required for the same reason `IconButton`'s is (MR-13 ACC-001):
 * an icon-only control needs an accessible name, and making the prop
 * non-optional turns a missing one into a compile error rather than a review
 * item. 56 dp is the M3 standard FAB size — there is no existing shape token
 * for it since this is the first FAB in the design system.
 */
import {Pressable, StyleSheet} from 'react-native';

import {Icon, type IconName} from '../icons';
import {useRippleConfig, useTheme} from '../theme/useTheme';

export interface FABProps {
  readonly icon: IconName;
  /** Accessible name for the action, e.g. "Add". */
  readonly label: string;
  readonly onPress: () => void;
  /** Distance from the screen's bottom edge, e.g. clearing a tab bar. Defaults to a plain safe-area-free margin. */
  readonly bottomOffset?: number;
  readonly testID?: string;
}

const SIZE = 56;
const DEFAULT_MARGIN = 16;

export function FAB({icon, label, onPress, bottomOffset = DEFAULT_MARGIN, testID}: FABProps) {
  const theme = useTheme();
  const ripple = useRippleConfig();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={ripple}
      style={({pressed}) => [
        styles.base,
        {
          right: theme.spacing.md,
          bottom: bottomOffset,
          backgroundColor: theme.color.primaryContainer,
          elevation: theme.elevation.level3,
          borderRadius: theme.radius.full,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <Icon name={icon} color={theme.color.onPrimaryContainer} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
