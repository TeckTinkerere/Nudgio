/**
 * Time-of-day picker: the three-column scroll wheel every alarm clock on
 * Android uses — hour, minute, and (in 12-hour mode) AM/PM — with the
 * selected value centred and its neighbours fading away above and below.
 *
 * Each column is a `WheelPicker`, which owns its vertical drag outright via
 * a gesture handler rather than a nested `ScrollView`; the wheel that used
 * to be here could only be tapped, because the editor's own scroll view
 * claimed every drag before the column saw it. `onInteractionChange` is
 * forwarded up so the screen can freeze that scroll view while a column is
 * being dragged. All sixty minutes are selectable, not five-minute steps.
 *
 * The 12/24-hour split follows the user's `use24HourTime` preference: in
 * 24-hour mode the hour column runs 00-23 and the AM/PM column disappears
 * entirely, rather than being shown-but-ignored. The value shape stays
 * 12-hour internally (`hour` 1-12 plus `period`) so the editor's conversion
 * to `LocalTime` is the same in both modes.
 *
 * Local to `features/reminders` rather than the design system: the
 * hour/minute/period value shape is domain-specific to scheduling, and the
 * selection tick is a haptics-policy call, which `design-system` components
 * are not allowed to make.
 */
import {useCallback, useMemo} from 'react';

import {Stack, Text, WheelPicker, type WheelPickerOption} from '../../design-system';
import {useHaptics} from '../../hooks';

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
  /** Follows the `use24HourTime` preference. */
  readonly use24Hour?: boolean;
  /** True while a column is being dragged — the screen's scroll view must yield. */
  readonly onInteractionChange?: (active: boolean) => void;
  readonly testID?: string;
}

const pad2 = (n: number): string => n.toString().padStart(2, '0');

/** 12-hour value -> the 0-23 hour it denotes. */
export const toHour24 = (hour12: number, period: 'AM' | 'PM'): number => {
  const base = hour12 % 12;
  return period === 'AM' ? base : base + 12;
};

/** The inverse: 0-23 -> the hour/period pair the value shape stores. */
export const fromHour24 = (hour24: number): {hour: number; period: 'AM' | 'PM'} => ({
  hour: hour24 % 12 === 0 ? 12 : hour24 % 12,
  period: hour24 < 12 ? 'AM' : 'PM',
});

const MINUTE_OPTIONS: readonly WheelPickerOption<number>[] = Array.from(
  {length: 60},
  (_, minute) => ({value: minute, label: pad2(minute)}),
);

const HOUR_12_OPTIONS: readonly WheelPickerOption<number>[] = Array.from(
  {length: 12},
  (_, index) => ({value: index + 1, label: pad2(index + 1)}),
);

const HOUR_24_OPTIONS: readonly WheelPickerOption<number>[] = Array.from(
  {length: 24},
  (_, hour) => ({value: hour, label: pad2(hour)}),
);

const PERIOD_OPTIONS: readonly WheelPickerOption<'AM' | 'PM'>[] = [
  {value: 'AM', label: 'AM'},
  {value: 'PM', label: 'PM'},
];

export function TimePicker({
  value,
  onChange,
  hourLabel,
  minuteLabel,
  amPmLabel,
  use24Hour = false,
  onInteractionChange,
  testID,
}: TimePickerProps) {
  const haptics = useHaptics();

  // A short tick as each value passes the centre — the physical detent a
  // real wheel has, and the only feedback available while the finger is
  // covering the number it is choosing.
  const tick = useCallback(() => haptics.trigger('light'), [haptics]);

  const hourOptions = use24Hour ? HOUR_24_OPTIONS : HOUR_12_OPTIONS;
  const hourValue = useMemo(
    () => (use24Hour ? toHour24(value.hour, value.period) : value.hour),
    [use24Hour, value.hour, value.period],
  );

  const onHourChange = useCallback(
    (next: number) => {
      onChange(use24Hour ? {...value, ...fromHour24(next)} : {...value, hour: next});
    },
    [onChange, use24Hour, value],
  );

  return (
    <Stack testID={testID} direction="row" align="center" justify="center" gap="xs">
      <WheelPicker
        options={hourOptions}
        value={hourValue}
        onChange={onHourChange}
        accessibilityLabel={hourLabel}
        onInteractionChange={onInteractionChange}
        onTick={tick}
      />

      <Text variant="headlineMedium" tabularNumbers>
        :
      </Text>

      <WheelPicker
        options={MINUTE_OPTIONS}
        value={value.minute}
        onChange={minute => onChange({...value, minute})}
        accessibilityLabel={minuteLabel}
        onInteractionChange={onInteractionChange}
        onTick={tick}
      />

      {use24Hour ? null : (
        <WheelPicker
          options={PERIOD_OPTIONS}
          value={value.period}
          onChange={period => onChange({...value, period})}
          accessibilityLabel={amPmLabel}
          labelVariant="titleLarge"
          onInteractionChange={onInteractionChange}
          onTick={tick}
        />
      )}
    </Stack>
  );
}
