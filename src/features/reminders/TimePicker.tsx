/**
 * Time-of-day picker: a large digital clock where the hour and the minute
 * are each their own tap target, and tapping either opens an analog clock
 * overlay to set it — the same two-stage interaction the platform's own
 * alarm clock uses.
 *
 * Replaces the scroll-wheel columns this used to be. The wheels supported
 * only 5-minute steps and, because they were built on a `ScrollView` nested
 * inside the editor's own scroll view, the vertical drag was routinely
 * claimed by the parent — so in practice they could only be tapped, not
 * dragged. The analog dial owns its gesture outright (it lives in a modal,
 * with nothing above it competing) and gives every one of the 60 minutes.
 *
 * AM/PM stays inline as a segmented control rather than a third overlay:
 * it is a binary choice, and making it a two-tap flow to change one bit
 * would be worse than the wheel it replaced.
 *
 * Local to `features/reminders` rather than the design system: the
 * hour/minute/period value shape is domain-specific to scheduling.
 * `AnalogClockPicker` — the reusable half — is in the design system.
 */
import {useState} from 'react';
import {StyleSheet} from 'react-native';

import {AnalogClockPicker, SegmentedControl, Stack, Text, useTheme, type ClockMode} from '../../design-system';
import {AnimatedPressable} from '../../design-system';

export interface TimeOfDayValue {
  /** 1-12. */
  readonly hour: number;
  /** 0-59. Every minute is selectable, not just 5-minute steps. */
  readonly minute: number;
  readonly period: 'AM' | 'PM';
}

export interface TimePickerProps {
  readonly value: TimeOfDayValue;
  readonly onChange: (next: TimeOfDayValue) => void;
  readonly hourLabel: string;
  readonly minuteLabel: string;
  readonly amPmLabel: string;
  readonly doneLabel: string;
  readonly testID?: string;
}

const pad2 = (n: number): string => n.toString().padStart(2, '0');

export function TimePicker({
  value,
  onChange,
  hourLabel,
  minuteLabel,
  amPmLabel,
  doneLabel,
  testID,
}: TimePickerProps) {
  const theme = useTheme();
  const [editing, setEditing] = useState<ClockMode | null>(null);

  const fieldStyle = (active: boolean) => [
    styles.field,
    {
      backgroundColor: active ? theme.color.primaryContainer : theme.color.surfaceContainerHigh,
      borderRadius: theme.radius.card,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
  ];

  return (
    <Stack testID={testID} gap="sm" align="center">
      <Stack direction="row" align="center" justify="center" gap="xs">
        <AnimatedPressable
          onPress={() => setEditing('hour')}
          accessibilityRole="button"
          accessibilityLabel={`${hourLabel}: ${value.hour}`}
          style={fieldStyle(editing === 'hour')}>
          <Text variant="displaySmall" tabularNumbers>
            {value.hour}
          </Text>
        </AnimatedPressable>

        <Text variant="displaySmall">:</Text>

        <AnimatedPressable
          onPress={() => setEditing('minute')}
          accessibilityRole="button"
          accessibilityLabel={`${minuteLabel}: ${pad2(value.minute)}`}
          style={fieldStyle(editing === 'minute')}>
          <Text variant="displaySmall" tabularNumbers>
            {pad2(value.minute)}
          </Text>
        </AnimatedPressable>
      </Stack>

      <SegmentedControl
        accessibilityLabel={amPmLabel}
        options={[
          {value: 'AM', label: 'AM'},
          {value: 'PM', label: 'PM'},
        ]}
        value={value.period}
        onChange={period => onChange({...value, period})}
      />

      <AnalogClockPicker
        visible={editing !== null}
        mode={editing ?? 'hour'}
        value={editing === 'minute' ? value.minute : value.hour}
        onChange={next =>
          onChange(editing === 'minute' ? {...value, minute: next} : {...value, hour: next})
        }
        onDismiss={() => setEditing(null)}
        title={editing === 'minute' ? minuteLabel : hourLabel}
        doneLabel={doneLabel}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  field: {alignItems: 'center', justifyContent: 'center'},
});
