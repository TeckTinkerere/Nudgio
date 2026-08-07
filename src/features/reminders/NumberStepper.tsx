/**
 * Bounded numeric stepper for day-of-month, month and custom-interval
 * fields in the reminder editor.
 *
 * Deliberately not shared with `TimePicker`'s internal hour/minute stepper:
 * that one renders at `displaySmall` because the time is the primary datum
 * on the "When" section, while day-of-month/month/interval are secondary
 * refinements at `titleLarge`. Same increment/decrement shape, different
 * visual weight for a reason — merging them would either shrink the time
 * display or inflate these secondary fields.
 */
import {IconButton, Stack, Text} from '../../design-system';

export interface NumberStepperProps {
  readonly value: number;
  readonly onChange: (next: number) => void;
  readonly min: number;
  readonly max: number;
  readonly formatValue?: (value: number) => string;
  /** Accessible name for the value itself, e.g. "Day of month: 14". */
  readonly accessibleLabel: string;
  readonly increaseLabel: string;
  readonly decreaseLabel: string;
  readonly testID?: string;
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  formatValue,
  accessibleLabel,
  increaseLabel,
  decreaseLabel,
  testID,
}: NumberStepperProps) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));

  return (
    <Stack testID={testID} align="center" gap="xxs">
      <IconButton
        name="chevronUp"
        label={increaseLabel}
        onPress={() => onChange(clamp(value + 1))}
      />
      <Text variant="titleLarge" tabularNumbers accessibilityLabel={accessibleLabel}>
        {formatValue ? formatValue(value) : value.toString()}
      </Text>
      <IconButton
        name="chevronDown"
        label={decreaseLabel}
        onPress={() => onChange(clamp(value - 1))}
      />
    </Stack>
  );
}
