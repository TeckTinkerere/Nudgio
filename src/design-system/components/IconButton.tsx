/**
 * Icon-only button.
 *
 * `label` is required at the type level. MR-04: "Every icon-only button
 * requires an accessibility label and tooltip where supported", and MR-13
 * ACC-001 makes an unlabeled control a release blocker. Making the prop
 * non-optional turns that from a review item into a compile error.
 */
import {Pressable, type StyleProp, type ViewStyle} from 'react-native';

import {Icon, type IconName, type IconSizeToken} from '../icons';
import {useRippleConfig, useTheme} from '../theme/useTheme';

export interface IconButtonProps {
  readonly name: IconName;
  /** Required. Describes the action, not the glyph: "More options", not "Dots". */
  readonly label: string;
  readonly onPress: () => void;
  readonly size?: IconSizeToken;
  readonly tone?: 'default' | 'variant' | 'primary' | 'error';
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export function IconButton({
  name,
  label,
  onPress,
  size = 'md',
  tone = 'default',
  disabled = false,
  selected = false,
  style,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const ripple = useRippleConfig();

  const color = (): string => {
    if (disabled) {
      return theme.color.onSurfaceDisabled;
    }
    switch (tone) {
      case 'variant':
        return theme.color.onSurfaceVariant;
      case 'primary':
        return theme.color.primary;
      case 'error':
        return theme.color.error;
      case 'default':
        return theme.color.onSurface;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled, selected}}
      testID={testID}
      // `borderless`: icon buttons are circular controls that commonly sit
      // flush against an edge (AppBar actions, Sheet's close button) — a
      // borderless ripple can radiate slightly past the icon without being
      // clipped to a hard rectangle, matching Android's own icon-button ripple.
      android_ripple={disabled ? undefined : {...ripple, borderless: true}}
      style={({pressed}) => [
        {
          // ACC-002 floor regardless of the glyph size inside.
          minWidth: theme.layout.minTouchTarget,
          minHeight: theme.layout.minTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.full,
          backgroundColor: selected
            ? theme.color.primaryContainer
            : pressed
              ? theme.color.surfaceContainerHigh
              : 'transparent',
        },
        style,
      ]}>
      <Icon name={name} size={size} color={color()} />
    </Pressable>
  );
}
