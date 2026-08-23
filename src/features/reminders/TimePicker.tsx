/**
 * Local time-of-day picker.
 *
 * Stores hours in 0–23. Display follows the same 12/24 preference as
 * `formatLocalTime` so the editor never disagrees with Upcoming/Reminders.
 */
import {IconButton, SegmentedControl, Stack, Text} from '../../design-system';
import {is24HourClock} from '../../localization';

export interface TimeOfDayValue {
  /** 0–23. */
  readonly hour: number;
  /** 0–59, always a multiple of 5 from this control. */
  readonly minute: number;
}

export interface TimePickerProps {
  readonly value: TimeOfDayValue;
  readonly onChange: (next: TimeOfDayValue) => void;
  readonly use24Hour: boolean | null;
  readonly hourLabel: string;
  readonly minuteLabel: string;
  readonly periodLabel: string;
  readonly amLabel: string;
  readonly pmLabel: string;
  readonly increaseLabel: string;
  readonly decreaseLabel: string;
  readonly testID?: string;
}

const pad2 = (n: number): string => n.toString().padStart(2, '0');

const clampHour24 = (hour: number): number => (hour + 24) % 24;
const clampMinute = (minute: number): number => (minute + 60) % 60;

const toPeriod = (hour: number): 'AM' | 'PM' => (hour < 12 ? 'AM' : 'PM');
const toHour12 = (hour: number): number => {
  const mod = hour % 12;
  return mod === 0 ? 12 : mod;
};

const fromHour12 = (hour12: number, period: 'AM' | 'PM'): number => {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
};

export function TimePicker({
  value,
  onChange,
  use24Hour,
  hourLabel,
  minuteLabel,
  periodLabel,
  amLabel,
  pmLabel,
  increaseLabel,
  decreaseLabel,
  testID,
}: TimePickerProps) {
  const use24 = is24HourClock(use24Hour);
  const period = toPeriod(value.hour);

  const stepHour = (delta: number) => {
    if (use24) {
      onChange({...value, hour: clampHour24(value.hour + delta)});
      return;
    }
    const next12 = ((toHour12(value.hour) - 1 + delta + 12) % 12) + 1;
    onChange({...value, hour: fromHour12(next12, period)});
  };

  const stepMinute = (delta: number) =>
    onChange({...value, minute: clampMinute(value.minute + delta * 5)});

  const hourDisplay = use24 ? pad2(value.hour) : toHour12(value.hour).toString();

  return (
    <Stack testID={testID} gap="sm" align="center">
      <Stack direction="row" align="center" justify="center" gap="md">
        <Stepper
          formatted={hourDisplay}
          accessibleLabel={`${hourLabel}: ${hourDisplay}`}
          onIncrease={() => stepHour(1)}
          onDecrease={() => stepHour(-1)}
          increaseLabel={`${increaseLabel} ${hourLabel}`}
          decreaseLabel={`${decreaseLabel} ${hourLabel}`}
        />
        <Text variant="displaySmall">:</Text>
        <Stepper
          formatted={pad2(value.minute)}
          accessibleLabel={`${minuteLabel}: ${pad2(value.minute)}`}
          onIncrease={() => stepMinute(1)}
          onDecrease={() => stepMinute(-1)}
          increaseLabel={`${increaseLabel} ${minuteLabel}`}
          decreaseLabel={`${decreaseLabel} ${minuteLabel}`}
        />
      </Stack>

      {use24 ? null : (
        <SegmentedControl
          accessibilityLabel={periodLabel}
          options={[
            {value: 'AM', label: amLabel},
            {value: 'PM', label: pmLabel},
          ]}
          value={period}
          onChange={next => onChange({...value, hour: fromHour12(toHour12(value.hour), next)})}
        />
      )}
    </Stack>
  );
}

interface StepperProps {
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
