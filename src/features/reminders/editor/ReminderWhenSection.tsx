/**
 * Editor section "When". Time comes first — it is the one thing every
 * reminder has — then how it repeats, then whatever that repeat needs
 * (weekdays, a day of the month, an interval), and a plain-language line
 * confirming the result ("Every day at 7:00 AM · Mon, Tue").
 *
 * Repeat type is a wrapping `Chip` row, not `SegmentedControl`: six options
 * in one non-wrapping row would overflow or shrink below the 48 dp
 * touch-target floor (docs/decision-log.md DL-005).
 */
import {EditorSectionHeading} from './EditorSectionHeading';
import {Chip, Stack, Text, WeekdaySelector} from '../../../design-system';
import {useTranslation, type TranslationKey} from '../../../localization';
import type {ScheduleRuleDto} from '../../../native-client/types';
import {NumberStepper} from '../NumberStepper';
import {TimePicker, type TimeOfDayValue} from '../TimePicker';
import {weekdayOptions} from '../weekdayOptions';

export type RepeatType = ScheduleRuleDto['type'];

export const REPEAT_LABEL_KEY: Record<RepeatType, TranslationKey> = {
  once: 'reminders.repeat.once',
  daily: 'reminders.repeat.everyDay',
  weekdays: 'reminders.repeat.selectedDays',
  monthly: 'reminders.repeat.monthly',
  yearly: 'reminders.repeat.yearly',
  custom: 'reminders.repeat.custom',
};

export const REPEAT_TYPES: readonly RepeatType[] = ['once', 'daily', 'weekdays', 'monthly', 'yearly', 'custom'];

export const monthName = (month: number): string =>
  new Intl.DateTimeFormat(undefined, {month: 'long'}).format(new Date(2000, month - 1, 1));

export interface ReminderWhenSectionProps {
  readonly time: TimeOfDayValue;
  readonly onTimeChange: (next: TimeOfDayValue) => void;
  readonly repeatType: RepeatType;
  readonly onRepeatTypeChange: (next: RepeatType) => void;
  readonly weekdays: readonly number[];
  readonly onWeekdaysChange: (next: readonly number[]) => void;
  readonly dayOfMonth: number;
  readonly onDayOfMonthChange: (next: number) => void;
  readonly month: number;
  readonly onMonthChange: (next: number) => void;
  readonly intervalDays: number;
  readonly onIntervalDaysChange: (next: number) => void;
  /** Plain-language confirmation of the whole schedule. */
  readonly summary: string;
}

export function ReminderWhenSection(props: ReminderWhenSectionProps) {
  const t = useTranslation();
  const {repeatType} = props;

  return (
    <Stack gap="sm">
      <EditorSectionHeading label={t('reminders.editor.when')} />
      <TimePicker
        value={props.time}
        onChange={props.onTimeChange}
        hourLabel={t('reminders.editor.hour')}
        minuteLabel={t('reminders.editor.minute')}
        amPmLabel={t('reminders.editor.amPm')}
        doneLabel={t('action.done')}
      />
      <Stack direction="row" gap="xxs" wrap accessibilityLabel={t('reminders.editor.repeat')}>
        {REPEAT_TYPES.map(type => (
          <Chip
            key={type}
            label={t(REPEAT_LABEL_KEY[type])}
            selected={repeatType === type}
            onPress={() => props.onRepeatTypeChange(type)}
          />
        ))}
      </Stack>

      {repeatType === 'weekdays' ? (
        <Stack gap="xxs">
          <Text variant="labelLarge" tone="variant">{t('reminders.editor.weekdays')}</Text>
          <WeekdaySelector options={weekdayOptions(t)} selected={props.weekdays} onChange={props.onWeekdaysChange} />
          {props.weekdays.length === 0 ? (
            <Text variant="bodyMedium" tone="error">{t('reminders.editor.validationWeekdaysRequired')}</Text>
          ) : null}
        </Stack>
      ) : null}

      {repeatType === 'monthly' || repeatType === 'yearly' ? (
        <Stack direction="row" gap="lg" wrap>
          {repeatType === 'yearly' ? (
            <Stack gap="xxs" align="center">
              <Text variant="labelLarge" tone="variant">{t('reminders.editor.month')}</Text>
              <NumberStepper
                value={props.month}
                onChange={props.onMonthChange}
                min={1}
                max={12}
                formatValue={monthName}
                accessibleLabel={`${t('reminders.editor.month')}: ${monthName(props.month)}`}
                increaseLabel={t('reminders.editor.increase')}
                decreaseLabel={t('reminders.editor.decrease')}
              />
            </Stack>
          ) : null}
          <Stack gap="xxs" align="center">
            <Text variant="labelLarge" tone="variant">{t('reminders.editor.dayOfMonth')}</Text>
            <NumberStepper
              value={props.dayOfMonth}
              onChange={props.onDayOfMonthChange}
              min={1}
              max={31}
              accessibleLabel={`${t('reminders.editor.dayOfMonth')}: ${props.dayOfMonth}`}
              increaseLabel={t('reminders.editor.increase')}
              decreaseLabel={t('reminders.editor.decrease')}
            />
          </Stack>
        </Stack>
      ) : null}

      {repeatType === 'custom' ? (
        <Stack gap="xxs" align="center">
          <Text variant="labelLarge" tone="variant">{t('reminders.editor.intervalDays')}</Text>
          <NumberStepper
            value={props.intervalDays}
            onChange={props.onIntervalDaysChange}
            min={1}
            max={365}
            formatValue={days => t('reminders.editor.intervalDaysValue', {days})}
            accessibleLabel={t('reminders.editor.intervalDaysValue', {days: props.intervalDays})}
            increaseLabel={t('reminders.editor.increase')}
            decreaseLabel={t('reminders.editor.decrease')}
          />
        </Stack>
      ) : null}

      <Text variant="bodyMedium" tone="variant" testID="reminder-schedule-summary">{props.summary}</Text>
    </Stack>
  );
}
