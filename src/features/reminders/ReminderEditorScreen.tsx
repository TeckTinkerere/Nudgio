/**
 * Create/edit reminder screen (MR-03 "Reminder editor").
 *
 * "The editor is a single scrollable form with progressive disclosure: What,
 * When, Alert style, Snooze, Options, Preview, Save reminder." Every section
 * below matches that list, in that order. "The Save button is enabled only
 * when data is structurally valid" — enforced by `isValid` gating `Button`'s
 * `disabled` prop, with the reason surfaced to assistive tech via
 * `disabledReason` (MR-13 ACC-001).
 *
 * Repeat type is a wrapping `Chip` row, not `SegmentedControl`: MR-03's MVP
 * list was three options ("Once, Every day, Selected days"), which fit one
 * unwrapped row; the recurrence engine now also supports Monthly, Yearly and
 * Custom (docs/decision-log.md DL-005), and six items in one non-wrapping row
 * would either overflow or shrink below the 48 dp touch-target floor.
 *
 * Save calls the real `saveReminder` mutation (`useSaveReminder`, wired once
 * the recurrence engine landed) instead of only closing the screen.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useMemo, useState} from 'react';
import {StyleSheet} from 'react-native';

import {NumberStepper} from './NumberStepper';
import {TimePicker, type TimeOfDayValue} from './TimePicker';
import {useSaveReminder} from './useSaveReminder';
import {weekdayOptions} from './weekdayOptions';
import type {RootStackParamList} from '../../app/navigation/types';
import {appConfig} from '../../core/config/appConfig';
import {
  AppBar,
  Banner,
  Button,
  Card,
  Chip,
  Icon,
  RadioCard,
  Screen,
  Sheet,
  Stack,
  StatusPill,
  Text,
  TextField,
  Toggle,
  WeekdaySelector,
} from '../../design-system';
import {useTranslation, type TranslationKey} from '../../localization';
import {findMockMedia, findMockReminder, mockMedia} from '../../mocks/fixtures';
import {mockProfiles} from '../../native-client';
import {isBuiltInProfileNameKey} from '../../native-client/reminderProfileNameKeys';
import type {Instant, LocalDate, LocalTime, ScheduleRuleDto, ZoneId} from '../../native-client/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderEditor'>;

type RepeatType = ScheduleRuleDto['type'];

const REPEAT_LABEL_KEY: Record<RepeatType, TranslationKey> = {
  once: 'reminders.repeat.once',
  daily: 'reminders.repeat.everyDay',
  weekdays: 'reminders.repeat.selectedDays',
  monthly: 'reminders.repeat.monthly',
  yearly: 'reminders.repeat.yearly',
  custom: 'reminders.repeat.custom',
};

const REPEAT_TYPES: readonly RepeatType[] = [
  'once',
  'daily',
  'weekdays',
  'monthly',
  'yearly',
  'custom',
];

const PROFILE_ICON: Record<string, 'notification' | 'reminders' | 'clock'> = {
  'profile.gentle.name': 'notification',
  'profile.standard.name': 'reminders',
  'profile.persistent.name': 'clock',
};

const PROFILE_DESCRIPTION_KEY: Record<string, TranslationKey> = {
  'profile.gentle.name': 'profile.gentle.description',
  'profile.standard.name': 'profile.standard.description',
  'profile.persistent.name': 'profile.persistent.description',
};


const to24Hour = (time: TimeOfDayValue): {hour: number; minute: number} => {
  const hour24 =
    time.period === 'AM'
      ? time.hour === 12
        ? 0
        : time.hour
      : time.hour === 12
        ? 12
        : time.hour + 12;
  return {hour: hour24, minute: time.minute};
};

const toLocalTime = (time: TimeOfDayValue): LocalTime => {
  const {hour, minute} = to24Hour(time);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00` as LocalTime;
};

const monthName = (month: number): string =>
  new Intl.DateTimeFormat(undefined, {month: 'long'}).format(new Date(2000, month - 1, 1));

const todayLocalDate = (): LocalDate => {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}` as LocalDate;
};

const deviceZone = (): ZoneId => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone as ZoneId;
  } catch {
    return 'UTC' as ZoneId;
  }
};

export function ReminderEditorScreen({navigation, route}: Props) {
  const t = useTranslation();
  const existing = route.params.reminderId ? findMockReminder(route.params.reminderId) : undefined;
  const isNew = existing === undefined;
  const saveReminder = useSaveReminder();

  const [mediaId, setMediaId] = useState(existing?.mediaId ?? mockMedia[0]?.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [label, setLabel] = useState(existing?.label ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [repeatType, setRepeatType] = useState<RepeatType>(existing?.schedule.type ?? 'daily');
  const [time, setTime] = useState<TimeOfDayValue>({hour: 6, minute: 15, period: 'AM'});
  const [weekdays, setWeekdays] = useState<readonly number[]>([1, 2, 3, 4, 5]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [intervalDays, setIntervalDays] = useState(3);
  const [profileId, setProfileId] = useState(existing?.profileId ?? mockProfiles[1]?.id);
  const [snoozeMinutes, setSnoozeMinutes] = useState(
    existing?.snooze.defaultMinutes ?? appConfig.snooze.presetMinutes[1],
  );
  const [historyEnabled, setHistoryEnabled] = useState(existing?.historyEnabled ?? true);
  const [labelTouched, setLabelTouched] = useState(false);

  const selectedMedia = mediaId ? findMockMedia(mediaId) : undefined;

  /**
   * The authoritative `ScheduleRuleDto` for the current form state. MR-08:
   * "UI never calculates authoritative next occurrence" — this is only used
   * to build the request and to render a *local preview*; the actual next
   * occurrence in `ReminderDetail.nextOccurrence` always comes back from the
   * native `OccurrenceCalculator`.
   */
  const scheduleRule = useMemo((): ScheduleRuleDto => {
    const localTime = toLocalTime(time);
    switch (repeatType) {
      case 'once': {
        const {hour, minute} = to24Hour(time);
        const next = new Date();
        next.setHours(hour, minute, 0, 0);
        if (next.getTime() <= Date.now()) {
          next.setDate(next.getDate() + 1);
        }
        return {
          type: 'once',
          instant: next.toISOString() as Instant,
          originZone: deviceZone(),
        };
      }
      case 'daily':
        return {type: 'daily', localTime, zonePolicy: 'follow_device'};
      case 'weekdays':
        return {type: 'weekdays', localTime, isoWeekdays: weekdays, zonePolicy: 'follow_device'};
      case 'monthly':
        return {type: 'monthly', localTime, dayOfMonth, zonePolicy: 'follow_device'};
      case 'yearly':
        return {type: 'yearly', localTime, month, dayOfMonth, zonePolicy: 'follow_device'};
      case 'custom':
        return {
          type: 'custom',
          localTime,
          intervalDays,
          anchorDate: todayLocalDate(),
          zonePolicy: 'follow_device',
        };
    }
  }, [repeatType, time, weekdays, dayOfMonth, month, intervalDays]);

  const previewText = useMemo(() => {
    const {hour, minute} = to24Hour(time);
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= Date.now()) {
      next.setDate(next.getDate() + 1);
    }
    // Client-side approximation only (see `scheduleRule`'s doc comment): for
    // weekly/monthly/yearly/custom this walks forward from "tomorrow at the
    // chosen time" to the next date the rule actually matches, purely so the
    // Preview card has something concrete to show before Save round-trips.
    if (repeatType === 'weekdays' && weekdays.length > 0) {
      const targetSet = new Set(weekdays);
      for (let i = 0; i < 7; i += 1) {
        const isoWeekday = ((next.getDay() + 6) % 7) + 1;
        if (targetSet.has(isoWeekday)) {
          break;
        }
        next.setDate(next.getDate() + 1);
      }
    } else if (repeatType === 'monthly') {
      next.setDate(1);
      next.setMonth(next.getMonth() + (next.getDate() > dayOfMonth ? 1 : 0));
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dayOfMonth, daysInMonth));
    } else if (repeatType === 'yearly') {
      const daysInMonth = new Date(next.getFullYear(), month, 0).getDate();
      next.setMonth(month - 1, Math.min(dayOfMonth, daysInMonth));
      if (next.getTime() <= Date.now()) {
        next.setFullYear(next.getFullYear() + 1);
      }
    } else if (repeatType === 'custom') {
      // Approximation: next multiple of `intervalDays` from today.
      next.setDate(next.getDate());
    }
    const date = new Intl.DateTimeFormat(undefined, {weekday: 'long', day: 'numeric', month: 'long'}).format(next);
    const timeLabel = new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit'}).format(next);
    return t('reminders.editor.previewNext', {date, time: timeLabel});
  }, [t, time, repeatType, weekdays, dayOfMonth, month]);

  const isValid = label.trim().length > 0 && selectedMedia !== undefined;

  const handleSave = () => {
    if (!isValid || !selectedMedia || !profileId) {
      return;
    }
    saveReminder.mutate(
      {
        id: existing?.id,
        mediaId: selectedMedia.id,
        label: label.trim(),
        notes: notes.trim().length > 0 ? notes.trim() : undefined,
        schedule: scheduleRule,
        profileId,
        snooze: {
          defaultMinutes: snoozeMinutes,
          allowCustom: true,
          minimumMinutes: appConfig.snooze.minimumMinutes,
          maximumMinutes: appConfig.snooze.maximumMinutes,
        },
        enabledIntent: existing?.enabledIntent ?? true,
      },
      {onSuccess: () => navigation.goBack()},
    );
  };

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={isNew ? t('reminders.editor.newTitle') : t('reminders.editor.editTitle')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <Stack gap="xl" paddingVertical="md">
        {/* What */}
        <Stack gap="xs">
          <Text variant="titleLarge">{t('reminders.editor.what')}</Text>
          {selectedMedia ? (
            <Card onPress={() => setPickerOpen(true)}>
              <Stack direction="row" align="center" gap="sm">
                <Icon name="video" />
                <Stack style={styles.flexFill} gap={2}>
                  <Text variant="titleMedium">{selectedMedia.title}</Text>
                  <Text variant="labelMedium" tone="variant">
                    {t('reminders.editor.changeMedia')}
                  </Text>
                </Stack>
                <Icon name="chevronRight" />
              </Stack>
            </Card>
          ) : (
            <Button label={t('reminders.editor.chooseMedia')} variant="outlined" onPress={() => setPickerOpen(true)} />
          )}
        </Stack>

        {/* When */}
        <Stack gap="xs">
          <Text variant="titleLarge">{t('reminders.editor.when')}</Text>
          <Stack direction="row" gap="xxs" wrap accessibilityLabel={t('reminders.editor.when')}>
            {REPEAT_TYPES.map(type => (
              <Chip
                key={type}
                label={t(REPEAT_LABEL_KEY[type])}
                selected={repeatType === type}
                onPress={() => setRepeatType(type)}
              />
            ))}
          </Stack>

          {repeatType === 'weekdays' ? (
            <Stack gap="xxs">
              <Text variant="labelLarge" tone="variant">
                {t('reminders.editor.weekdays')}
              </Text>
              <WeekdaySelector
                options={weekdayOptions(t)}
                selected={weekdays}
                onChange={setWeekdays}
              />
            </Stack>
          ) : null}

          {repeatType === 'monthly' || repeatType === 'yearly' ? (
            <Stack direction="row" gap="lg">
              {repeatType === 'yearly' ? (
                <Stack gap="xxs" align="center">
                  <Text variant="labelLarge" tone="variant">
                    {t('reminders.editor.month')}
                  </Text>
                  <NumberStepper
                    value={month}
                    onChange={setMonth}
                    min={1}
                    max={12}
                    formatValue={monthName}
                    accessibleLabel={`${t('reminders.editor.month')}: ${monthName(month)}`}
                    increaseLabel={t('reminders.editor.increase')}
                    decreaseLabel={t('reminders.editor.decrease')}
                  />
                </Stack>
              ) : null}
              <Stack gap="xxs" align="center">
                <Text variant="labelLarge" tone="variant">
                  {t('reminders.editor.dayOfMonth')}
                </Text>
                <NumberStepper
                  value={dayOfMonth}
                  onChange={setDayOfMonth}
                  min={1}
                  max={31}
                  accessibleLabel={`${t('reminders.editor.dayOfMonth')}: ${dayOfMonth}`}
                  increaseLabel={t('reminders.editor.increase')}
                  decreaseLabel={t('reminders.editor.decrease')}
                />
              </Stack>
            </Stack>
          ) : null}

          {repeatType === 'custom' ? (
            <Stack gap="xxs" align="center">
              <Text variant="labelLarge" tone="variant">
                {t('reminders.editor.intervalDays')}
              </Text>
              <NumberStepper
                value={intervalDays}
                onChange={setIntervalDays}
                min={1}
                max={365}
                formatValue={days => t('reminders.editor.intervalDaysValue', {days})}
                accessibleLabel={t('reminders.editor.intervalDaysValue', {days: intervalDays})}
                increaseLabel={t('reminders.editor.increase')}
                decreaseLabel={t('reminders.editor.decrease')}
              />
            </Stack>
          ) : null}

          <Stack gap="xxs">
            <Text variant="labelLarge" tone="variant">
              {t('reminders.editor.time')}
            </Text>
            <TimePicker
              value={time}
              onChange={setTime}
              hourLabel={t('reminders.editor.time')}
              minuteLabel={t('reminders.editor.time')}
              increaseLabel={t('reminders.editor.increase')}
              decreaseLabel={t('reminders.editor.decrease')}
            />
          </Stack>
        </Stack>

        {/* Alert style */}
        <Stack gap="xs">
          <Text variant="titleLarge">{t('reminders.editor.alertStyle')}</Text>
          <Stack gap="xs" accessibilityLabel={t('reminders.editor.alertStyle')}>
            {mockProfiles.map(profile => (
              <RadioCard
                key={profile.id}
                title={isBuiltInProfileNameKey(profile.nameKey) ? t(profile.nameKey) : profile.nameKey}
                description={t(PROFILE_DESCRIPTION_KEY[profile.nameKey] ?? 'profile.gentle.description')}
                icon={PROFILE_ICON[profile.nameKey] ?? 'notification'}
                selected={profile.id === profileId}
                onPress={() => setProfileId(profile.id)}
                notice={
                  profile.nameKey === 'profile.persistent.name'
                    ? t('profile.persistent.notice')
                    : undefined
                }
              />
            ))}
          </Stack>
        </Stack>

        {/* Snooze */}
        <Stack gap="xs">
          <Text variant="titleLarge">{t('reminders.editor.snooze')}</Text>
          <Stack direction="row" gap="xxs" wrap accessibilityLabel={t('reminders.editor.snoozeDefault')}>
            {appConfig.snooze.presetMinutes.map(minutes => (
              <Chip
                key={minutes}
                label={t('reminders.editor.snoozeMinutes', {minutes})}
                selected={snoozeMinutes === minutes}
                onPress={() => setSnoozeMinutes(minutes)}
              />
            ))}
          </Stack>
        </Stack>

        {/* Options */}
        <Stack gap="sm">
          <Text variant="titleLarge">{t('reminders.editor.options')}</Text>
          <TextField
            label={t('reminders.editor.label')}
            placeholder={t('reminders.editor.labelPlaceholder')}
            value={label}
            onChangeText={value => {
              setLabel(value);
              setLabelTouched(true);
            }}
            required
            error={labelTouched && label.trim().length === 0 ? t('reminders.editor.validationLabelRequired') : undefined}
          />
          <TextField
            label={t('library.detail.notes')}
            placeholder={t('reminders.editor.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <Stack direction="row" align="center" justify="space-between">
            <Stack style={styles.flexFill} gap={2}>
              <Text variant="titleMedium">{t('reminders.editor.historyToggle')}</Text>
              <Text variant="bodyMedium" tone="variant">
                {t('reminders.editor.historyHelper')}
              </Text>
            </Stack>
            <Toggle
              value={historyEnabled}
              onValueChange={setHistoryEnabled}
              label={t('reminders.editor.historyToggle')}
            />
          </Stack>
        </Stack>

        {/* Preview */}
        <Stack gap="xs">
          <Text variant="titleLarge">{t('reminders.editor.preview')}</Text>
          <Card>
            <Text variant="titleMedium">{previewText}</Text>
            <StatusPill kind="ready" label={t('today.status.ready')} />
          </Card>
        </Stack>

        {saveReminder.isError ? (
          <Banner
            kind="actionNeeded"
            title={t('error.unexpected.title')}
            effect={t('error.unexpected.effect')}
            diagnosticCode={saveReminder.error.correlationId}
          />
        ) : null}

        <Button
          label={t('reminders.editor.save')}
          onPress={handleSave}
          loading={saveReminder.isPending}
          disabled={!isValid}
          disabledReason={
            !selectedMedia
              ? t('reminders.editor.validationMediaRequired')
              : t('reminders.editor.validationLabelRequired')
          }
          fullWidth
        />
      </Stack>

      <Sheet
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        title={t('reminders.editor.chooseMedia')}
        closeLabel={t('action.close')}>
        {/*
          Plain map, not `VirtualizedList`: `Sheet`'s body is already a
          `ScrollView`, and React Native warns (and pays a real perf cost)
          when a `FlatList` is nested inside one. The mock media catalog is
          small and bounded; a production picker at library scale would be
          its own full-screen searchable route, not a sheet.
        */}
        {mockMedia.map(item => (
          <Card
            key={item.id}
            onPress={() => {
              setMediaId(item.id);
              setPickerOpen(false);
            }}
            selected={item.id === mediaId}>
            <Text variant="titleMedium">{item.title}</Text>
          </Card>
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
});
