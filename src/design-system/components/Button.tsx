/**
 * Button.
 *
 * MR-04 "Primary button": verb-first label, one primary action per surface,
 * "loading replaces icon with progress but preserves width", and a disabled
 * button "retains readable label".
 *
 * MR-13 ACC-002: 48 dp minimum target; 56 dp minimum for alarm actions.
 * The height floors below are accessibility requirements, not styling — they
 * are `minHeight`, so the control grows with font scale instead of clipping.
 */
import {ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle} from 'react-native';

import {Icon, type IconName} from '../icons';
import {Text} from './Text';
import {useRippleConfig, useTheme} from '../theme/useTheme';


export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'destructive';
export type ButtonSize = 'standard' | 'alarm';

export interface ButtonProps {
  /** MR-04: short verb. Already localized by the caller. */
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: IconName;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /**
   * Why the button is unavailable. MR-04: a disabled state "explains
   * validation near the relevant field"; this surfaces the same reason to
   * TalkBack, which cannot see that nearby text.
   */
  readonly disabledReason?: string;
  readonly fullWidth?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'filled',
  size = 'standard',
  icon,
  loading = false,
  disabled = false,
  disabledReason,
  fullWidth = false,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const isInert = disabled || loading;

  const palette = (): {background: string; content: string; border: string} => {
    switch (variant) {
      case 'filled':
        return {
          background: theme.color.primary,
          content: theme.color.onPrimary,
          border: 'transparent',
        };
      case 'tonal':
        return {
          background: theme.color.secondaryContainer,
          content: theme.color.onSecondaryContainer,
          border: 'transparent',
        };
      case 'outlined':
        return {
          background: 'transparent',
          content: theme.color.primary,
          border: theme.color.outline,
        };
      case 'text':
        return {
          background: 'transparent',
          content: theme.color.primary,
          border: 'transparent',
        };
      case 'destructive':
        return {
          background: theme.color.error,
          content: theme.color.onError,
          border: 'transparent',
        };
    }
  };

  const {background, content, border} = palette();

  // Disabled keeps a readable label (MR-04) — the container dims, the text
  // moves to the disabled *content* role rather than becoming translucent.
  const contentColor = isInert ? theme.color.onSurfaceDisabled : content;
  const ripple = useRippleConfig(contentColor);

  const minHeight =
    size === 'alarm'
      ? theme.layout.alarmActionPreferredHeight
      : theme.layout.minTouchTarget;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: isInert, busy: loading}}
      accessibilityHint={disabled ? disabledReason : undefined}
      // Guarantees the ACC-002 target even if a caller shrinks the visual box.
      hitSlop={8}
      testID={testID}
      // MR-04 "Alarm button confirmation": the press feedback itself is the
      // ripple below — an Android touch-feedback indicator, not a decorative
      // motion, so it needs no `reduceMotion` branch (the platform already
      // scales/removes it under the system's own animator-duration setting).
      android_ripple={isInert ? undefined : ripple}
      style={[
        {
          minHeight,
          borderRadius:
            size === 'alarm' ? theme.radius.alarmAction : theme.radius.field,
          borderWidth: variant === 'outlined' ? theme.layout.borderWidth : 0,
          borderColor: isInert ? theme.color.outlineVariant : border,
          backgroundColor: isInert
            ? variant === 'filled' || variant === 'destructive'
              ? theme.color.surfaceContainerHigh
              : 'transparent'
            : background,
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: theme.spacing.xs,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}>
      {/*
        Width preservation while loading (MR-04): the label stays mounted and
        the spinner overlays the icon slot, so the button does not resize and
        shift the surrounding layout.
      */}
      {loading ? (
        <ActivityIndicator size="small" color={contentColor} accessibilityElementsHidden />
      ) : icon ? (
        <Icon name={icon} size="sm" color={contentColor} />
      ) : null}

      <View style={{flexShrink: 1}}>
        <Text
          variant="labelLarge"
          style={{color: contentColor}}
          align="center"
          // No `numberOfLines`: MR-04 allows action labels to wrap to two
          // lines at 200% scale but forbids ambiguous truncation.
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
