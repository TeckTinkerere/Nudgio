/**
 * Material 3 segmented button group.
 *
 * Used where MR-03 asks for a small, mutually-exclusive choice presented
 * inline rather than as a picker sheet — the reminder editor's repeat type
 * ("Once, Every day, Selected days"). Radio semantics (`accessibilityRole=
 * "radio"` per segment, `radiogroup` on the container), not tabs: selecting
 * a segment changes a value, it does not navigate.
 */
import {Pressable, View} from 'react-native';

import {Text} from './Text';
import {useRippleConfig, useTheme} from '../theme/useTheme';


export interface SegmentedControlOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentedControlOption<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  /** Accessible name for the whole group, e.g. "Repeat". */
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const ripple = useRippleConfig();

  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        borderRadius: theme.radius.field,
        borderWidth: theme.layout.borderWidth,
        borderColor: theme.color.outline,
        overflow: 'hidden',
      }}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{selected, checked: selected}}
            accessibilityLabel={option.label}
            android_ripple={ripple}
            style={({pressed}) => ({
              flex: 1,
              minHeight: theme.layout.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.xs,
              backgroundColor: selected
                ? theme.color.secondaryContainer
                : pressed
                  ? theme.color.surfaceContainerHigh
                  : theme.color.surface,
              // Interior dividers between segments; the group's own border
              // already draws the outer edge.
              borderLeftWidth: index === 0 ? 0 : theme.layout.borderWidth,
              borderLeftColor: theme.color.outline,
            })}>
            <Text
              variant="labelLarge"
              numberOfLines={1}
              style={{
                color: selected
                  ? theme.color.onSecondaryContainer
                  : theme.color.onSurfaceVariant,
              }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
