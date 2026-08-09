/**
 * Local time-of-day picker.
 *
 * No native date/time picker library is installed (this build stays on the
 * existing dependency set — see the routing decision earlier in this
 * session). Hour/minute steppers plus an AM/PM segmented control give the
 * same MR-03 "Date and time are separate controls" result with large,
 * accessible touch targets and no new dependency. Local to `features/
 * reminders` rather than the design system: it is domain-specific to
 * scheduling, not a general-purpose primitive other features need yet.
 */
import {IconButton, SegmentedControl, Stack, Text} from '../../design-system';

export interface TimeOfDayValue {
  /** 1-12. */
  readonly hour: number;
  /** 0-59, always a multiple of 5 from this control. */
  readonly minute: number;
  readonly period: 'AM' | 'PM';
}

export interface TimePickerProps {
  readonly value: TimeOfDayValue;
  readonly onChange: (next: TimeOfDayValue) => void;
  readonly hourLabel: string;
  readonly minuteLabel: string;
  readonly increaseLabel: string;
  readonly decreaseLabel: string;
  readonly testID?: string;
}

const pad2 = (n: number): string => n.toString().padStart(2, '0');

const clampHour = (hour: number): number => ((hour - 1 + 12) % 12) + 1;
const clampMinute = (minute: number): number => (minute + 60) % 60;

export function TimePicker({
  value,
  onChange,
  hourLabel,
  minuteLabel,
  increaseLabel,
  decreaseLabel,
  testID,
}: TimePickerProps) {
  const stepHour = (delta: number) => onChange({...value, hour: clampHour(value.hour + delta)});
  const stepMinute = (delta: number) =>
    onChange({...value, minute: clampMinute(value.minute + delta * 5)});

  return (
    // Column, not one long row: hour/minute steppers at `displaySmall` plus
    // an AM/PM segmented control together are wider than a typical phone's
    // available width once insets are subtracted, and `Stack` does not wrap
    // by default — a single row silently clipped the segmented control off
    // the right edge of the screen (unreachable, not just ugly). Stacking
    // the segmented control on its own centered row below guarantees it
    // fits at any phone width without depending on wrap/measurement.
    <Stack testID={testID} gap="sm" align="center">
      <Stack direction="row" align="center" justify="center" gap="md">
        <Stepper
          value={value.hour}
          formatted={value.hour.toString()}
          accessibleLabel={`${hourLabel}: ${value.hour}`}
          onIncrease={() => stepHour(1)}
          onDecrease={() => stepHour(-1)}
          increaseLabel={`${increaseLabel} ${hourLabel}`}
          decreaseLabel={`${decreaseLabel} ${hourLabel}`}
        />
        <Text variant="displaySmall">:</Text>
        <Stepper
          value={value.minute}
          formatted={pad2(value.minute)}
          accessibleLabel={`${minuteLabel}: ${pad2(value.minute)}`}
          onIncrease={() => stepMinute(1)}
          onDecrease={() => stepMinute(-1)}
          increaseLabel={`${increaseLabel} ${minuteLabel}`}
          decreaseLabel={`${decreaseLabel} ${minuteLabel}`}
        />
      </Stack>

      <SegmentedControl
        accessibilityLabel="AM or PM"
        options={[
          {value: 'AM', label: 'AM'},
          {value: 'PM', label: 'PM'},
        ]}
        value={value.period}
        onChange={period => onChange({...value, period})}
      />
    </Stack>
  );
}

interface StepperProps {
  readonly value: number;
  readonly formatted: string;
  readonly accessibleLabel: string;
  readonly onIncrease: () => void;
  readonly onDecrease: () => void;
  readonly increaseLabel: string;
  readonly decreaseLabel: string;
}

function Stepper({
  formatted,
  accessibleLabel,
  onIncrease,
  onDecrease,
  increaseLabel,
  decreaseLabel,
}: StepperProps) {
  return (
    <Stack align="center" gap="xxs">
      <IconButton name="chevronUp" label={increaseLabel} onPress={onIncrease} />
      <Text variant="displaySmall" tabularNumbers accessibilityLabel={accessibleLabel}>
        {formatted}
      </Text>
      <IconButton name="chevronDown" label={decreaseLabel} onPress={onDecrease} />
    </Stack>
  );
}
