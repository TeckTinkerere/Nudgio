/**
 * Weekday multi-select row (MR-03 "Repeat editor" — Selected days).
 *
 * "The weekday row uses localized first-day-of-week ordering." Semantic
 * values are ISO weekday numbers (Monday = 1) per MR-13 ("Persist stable
 * semantic values... weekday stored as ISO number, displayed locally") — the
 * caller supplies both the ISO order to render in (already rotated to the
 * locale's first day) and each day's short localized label, so this
 * component holds no day-name text or locale logic of its own.
 */
import {Pressable, View} from 'react-native';

import {useRippleConfig, useTheme} from '../theme/useTheme';
import {transparent} from '../tokens';
import {Text} from './Text';

export interface WeekdayOption {
  /** ISO-8601 weekday number, Monday = 1 ... Sunday = 7. */
  readonly isoWeekday: number;
  /** Short localized label, e.g. "Mon" — already in the caller's locale order. */
  readonly label: string;
  /** Full localized name for the accessible name, e.g. "Monday". */
  readonly accessibleLabel: string;
}

export interface WeekdaySelectorProps {
  readonly options: readonly WeekdayOption[];
  readonly selected: readonly number[];
  readonly onChange: (next: readonly number[]) => void;
  readonly testID?: string;
}

export function WeekdaySelector({
  options,
  selected,
  onChange,
  testID,
}: WeekdaySelectorProps) {
  const theme = useTheme();
  const ripple = useRippleConfig();
  const selectedSet = new Set(selected);

  const toggle = (isoWeekday: number) => {
    const next = selectedSet.has(isoWeekday)
      ? selected.filter(day => day !== isoWeekday)
      : [...selected, isoWeekday].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <View
      testID={testID}
      style={{flexDirection: 'row', gap: theme.spacing.xxs, flexWrap: 'wrap'}}>
      {options.map(option => {
        const isSelected = selectedSet.has(option.isoWeekday);
        return (
          <Pressable
            key={option.isoWeekday}
            onPress={() => toggle(option.isoWeekday)}
            accessibilityRole="checkbox"
            accessibilityState={{checked: isSelected}}
            accessibilityLabel={option.accessibleLabel}
            android_ripple={{...ripple, borderless: true}}
            style={({pressed}) => ({
              width: theme.layout.minTouchTarget,
              height: theme.layout.minTouchTarget,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: isSelected ? 0 : theme.layout.borderWidth,
              borderColor: theme.color.outline,
              backgroundColor: isSelected
                ? theme.color.primary
                : pressed
                  ? theme.color.surfaceContainerHigh
                  : transparent,
            })}>
            <Text
              variant="labelLarge"
              style={{color: isSelected ? theme.color.onPrimary : theme.color.onSurfaceVariant}}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
