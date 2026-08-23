/**
 * Local time-of-day picker: three scrollable wheels (hour / minute / AM-PM),
 * the same layout every native alarm clock (iOS `UIDatePicker`, Android's
 * time picker) uses — MR-03 "Date and time are separate controls" is
 * satisfied by this being a self-contained time-only control, not by the
 * previous tap-stepper shape. `WheelPicker` (design system) owns the
 * scroll/momentum/snap physics; this component only supplies the three
 * value domains and keeps them mutually consistent.
 *
 * Local to `features/reminders` rather than the design system: the specific
 * hour/minute/period value shape is domain-specific to scheduling, not a
 * general-purpose primitive other features need yet.
 */
import {useMemo} from 'react';

import {Stack, WheelPicker} from '../../design-system';

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
  readonly amPmLabel: string;
  readonly testID?: string;
}

const pad2 = (n: number): string => n.toString().padStart(2, '0');

const HOURS = Array.from({length: 12}, (_, i) => i + 1).map(hour => ({value: hour, label: hour.toString()}));
const MINUTES = Array.from({length: 12}, (_, i) => i * 5).map(minute => ({
  value: minute,
  label: pad2(minute),
}));
const PERIODS: readonly {value: 'AM' | 'PM'; label: string}[] = [
  {value: 'AM', label: 'AM'},
  {value: 'PM', label: 'PM'},
];

export function TimePicker({value, onChange, hourLabel, minuteLabel, amPmLabel, testID}: TimePickerProps) {
  // Nearest 5-minute multiple: the wheel's domain is 5-minute steps, but an
  // initial value coming from elsewhere (e.g. "now") may not land exactly on
  // one — round rather than let `findIndex` fail to match anything.
  const roundedMinute = useMemo(() => Math.round(value.minute / 5) * 5, [value.minute]);

  return (
    <Stack testID={testID} direction="row" align="center" justify="center" gap="sm">
      <WheelPicker
        options={HOURS}
        value={value.hour}
        onChange={hour => onChange({...value, hour})}
        accessibilityLabel={hourLabel}
      />
      <WheelPicker
        options={MINUTES}
        value={roundedMinute}
        onChange={minute => onChange({...value, minute})}
        accessibilityLabel={minuteLabel}
      />
      <WheelPicker
        options={PERIODS}
        value={value.period}
        onChange={period => onChange({...value, period})}
        accessibilityLabel={amPmLabel}
      />
    </Stack>
  );
}
