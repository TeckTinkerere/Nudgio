/**
 * Filter / category chip.
 *
 * MR-13: "chip rows wrap/scroll with clear focus" at large font scale, and
 * selection is never signalled by color alone — a selected chip also carries a
 * check icon and reports `selected` to assistive tech.
 */
import {Pressable, View} from 'react-native';

import {Icon, type IconName} from '../icons';
import {Text} from './Text';
import {useRippleConfig, useTheme} from '../theme/useTheme';
import {transparent} from '../tokens';


export interface ChipProps {
  readonly label: string;
  readonly selected?: boolean;
  /**
   * Omit for a static info tag (e.g. a duration or file-size label). Without
   * a real action, an `accessibilityRole="button"` control that does nothing
   * on activation is a dead end for TalkBack — so a chip with no `onPress`
   * renders as a plain, non-interactive tag instead.
   */
  readonly onPress?: () => void;
  readonly icon?: IconName;
  readonly disabled?: boolean;
  /** Optional trailing count, e.g. a filter match total. */
  readonly count?: number;
  readonly testID?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  count,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const ripple = useRippleConfig();

  const contentColor = disabled
    ? theme.color.onSurfaceDisabled
    : selected
      ? theme.color.onPrimaryContainer
      : theme.color.onSurfaceVariant;

  // ACC-004: a check icon accompanies the selected fill.
  const leadingIcon: IconName | undefined = selected ? 'check' : icon;
  const accessibleLabel = count === undefined ? label : `${label}, ${count}`;

  const content = (
    <>
      {leadingIcon ? <Icon name={leadingIcon} size="xs" color={contentColor} /> : null}
      <Text variant="labelMedium" style={{color: contentColor}}>
        {label}
      </Text>
      {count === undefined ? null : (
        <Text variant="labelMedium" style={{color: contentColor}} tabularNumbers>
          {count}
        </Text>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={accessibleLabel}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xxs,
          minHeight: theme.layout.minTouchTarget,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.chip,
          borderWidth: selected ? 0 : theme.layout.borderWidth,
          borderColor: theme.color.outline,
          backgroundColor: selected ? theme.color.primaryContainer : transparent,
        }}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel}
      accessibilityState={{selected, disabled}}
      testID={testID}
      android_ripple={disabled ? undefined : ripple}
      style={({pressed}) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
        // ACC-002: chips are interactive, so they meet the 48 dp floor.
        minHeight: theme.layout.minTouchTarget,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.chip,
        borderWidth: selected ? 0 : theme.layout.borderWidth,
        borderColor: theme.color.outline,
        backgroundColor: selected
          ? theme.color.primaryContainer
          : pressed
            ? theme.color.surfaceContainerHigh
            : 'transparent',
      })}>
      {content}
    </Pressable>
  );
}
