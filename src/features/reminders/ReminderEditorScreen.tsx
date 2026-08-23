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
import {useEffect, useMemo, useState} from 'react';
import {Image, ScrollView, StyleSheet, View} from 'react-native';

import {NumberStepper} from './NumberStepper';
import {PROFILE_DESCRIPTION_KEY, PROFILE_ICON} from './profileDisplay';
import {TimePicker, type TimeOfDayValue} from './TimePicker';
import {useReminderDetail} from './useReminderDetail';
import {useSaveReminder} from './useSaveReminder';
import {weekdayOptions} from './weekdayOptions';
import type {RootStackParamList} from '../../app/navigation/types';
import {rootRoutes} from '../../constants/routes';
import {appConfig} from '../../core/config/appConfig';
import {
  AppBar,
  Banner,
  Button,
  Card,
  Chip,
  Dialog,
  ErrorState,
  Icon,
  LoadingState,
  RadioCard,
  Screen,
  TextField,
  Toggle,
  WeekdaySelector,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {useTheme} from '../../design-system/theme/useTheme';
import {useCapabilitySnapshot, useMediaList, useOpenCapabilitySettings, usePreferences, useProfiles} from '../../hooks';
import {formatLocalTime, useTranslation, type TranslationKey} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import {isBuiltInProfileNameKey} from '../../native-client/reminderProfileNameKeys';
import type {
  Instant,
  LocalDate,
  LocalTime,
  MediaKind,
  MediaSummary,
  ReminderDetail,
  ReminderProfile,
  ScheduleRuleDto,
  UUID,
  ZoneId,
} from '../../native-client/types';

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

/** Shown on the "What" card's fallback avatar when the selected item has no thumbnail. */
const MEDIA_KIND_ICON: Record<MediaKind, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
};


const toLocalTime = (time: TimeOfDayValue): LocalTime =>
  `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}:00` as LocalTime;

const clockFromLocalTime = (localTime: string | undefined): TimeOfDayValue => {
  if (!localTime) {
    return {hour: 6, minute: 15};
  }
  const [hourPart, minutePart] = localTime.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  return {
    hour: Number.isFinite(hour) ? hour : 6,
    minute: Number.isFinite(minute) ? minute - (minute % 5) : 15,
  };
};

const clockFromInstant = (instant: string | undefined): TimeOfDayValue => {
  if (!instant) {
    return {hour: 6, minute: 15};
  }
  const date = new Date(instant);
  return {hour: date.getHours(), minute: date.getMinutes() - (date.getMinutes() % 5)};
};

const initialClock = (existing: ReminderDetail | undefined): TimeOfDayValue => {
  if (!existing) {
    return {hour: 6, minute: 15};
  }
  if (existing.schedule.type === 'once') {
    return clockFromInstant(existing.schedule.instant);
  }
  return clockFromLocalTime(existing.schedule.localTime);
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

/**
 * Loads the real reminder to edit before the form ever mounts — the form's
 * fields are seeded once, from `useState`'s initializer, so if `existing`
 * were allowed to arrive asynchronously *after* the form mounted, the
 * already-mounted fields would silently keep their blank/default values
 * instead of catching up to the loaded data.
 */
export function ReminderEditorScreen({navigation, route}: Props) {
  const t = useTranslation();
  const reminderId = route.params.reminderId;
  const reminderDetail = useReminderDetail(reminderId);
  // Real, Room-seeded profiles (MR-08 `listProfiles`) — the form used to
  // read the hardcoded `mockProfiles` fixture directly for both the default
  // selection and the "Alert style" list (see `useProfiles`'s doc). Gated
  // here the same way as `existing`: the form's `useState` initializers
  // seed once from whatever `profiles.data` was at mount time, so it must
  // already be loaded before the form ever mounts.
  const profiles = useProfiles();
  const backAction = {label: t('action.back'), onPress: () => navigation.goBack()};
  const title = t('reminders.editor.editTitle');

  if ((reminderId !== undefined && reminderDetail.isPending) || profiles.isPending) {
    return (
      <Screen hasAppBar>
        <AppBar title={title} back={backAction} />
        <LoadingState label={t('loading.startingUp')} />
      </Screen>
    );
  }

  if (reminderId !== undefined && reminderDetail.isError) {
    return (
      <Screen hasAppBar>
        <AppBar title={title} back={backAction} />
        <ErrorState
          title={t('error.unexpected.title')}
          effect={t('error.unexpected.effect')}
          recoveryAction={{label: t('action.retry'), onPress: () => reminderDetail.refetch()}}
          diagnosticCode={reminderDetail.error.correlationId}
        />
      </Screen>
    );
  }

  if (profiles.isError) {
    return (
      <Screen hasAppBar>
        <AppBar title={title} back={backAction} />
        <ErrorState
          title={t('error.unexpected.title')}
          effect={t('error.unexpected.effect')}
          recoveryAction={{label: t('action.retry'), onPress: () => profiles.refetch()}}
          diagnosticCode={profiles.error.correlationId}
        />
      </Screen>
    );
  }

  return (
    <ReminderEditorForm
      navigation={navigation}
      existing={reminderId !== undefined ? reminderDetail.data : undefined}
      prefillMediaId={route.params.mediaId}
      profiles={profiles.data}
    />
  );
}

interface ReminderEditorFormProps {
  readonly navigation: Props['navigation'];
  readonly existing: ReminderDetail | undefined;
  readonly prefillMediaId: UUID | undefined;
  readonly profiles: readonly ReminderProfile[];
}

function ReminderEditorForm({navigation, existing, prefillMediaId, profiles}: ReminderEditorFormProps) {
  const t = useTranslation();
  const isNew = existing === undefined;
  const saveReminder = useSaveReminder();

  // Media is optional. Native save inserts a text asset when `mediaId` is
  // omitted so the Room FK stays satisfied without forcing an import.
  const [mediaId, setMediaId] = useState(existing?.mediaId ?? prefillMediaId);
  // `prefillMediaId` doubles as this screen's own "return value" from
  // `SelectMediaScreen`: confirming a pick there merges a new `mediaId` into
  // this route's params (`navigation.navigate(..., {merge: true})`), which
  // arrives here as a changed `prefillMediaId` prop. `useState`'s initializer
  // above only ever runs once at mount, so without this effect a pick made
  // after the form was already open would never actually apply.
  useEffect(() => {
    if (prefillMediaId !== undefined) {
      setMediaId(prefillMediaId);
    }
  }, [prefillMediaId]);
  // MR-09 anticipates a large library; this unpaginated lookup (used only to
  // resolve `mediaId` into the full `MediaSummary` the "What" card renders)
  // is a known v1 scale limit shared with `mockMedia`'s previous placeholder
  // — 200 covers real usage today. `SelectMediaScreen` runs its own,
  // separately-filtered `useMediaList` query for actual browsing.
  const mediaList = useMediaList({sort: 'recent', limit: 200});
  const [label, setLabel] = useState(existing?.label ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [repeatType, setRepeatType] = useState<RepeatType>(existing?.schedule.type ?? 'daily');
  const [time, setTime] = useState<TimeOfDayValue>(() => initialClock(existing));
  const [weekdays, setWeekdays] = useState<readonly number[]>([1, 2, 3, 4, 5]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [intervalDays, setIntervalDays] = useState(3);
  const [profileId, setProfileId] = useState(existing?.profileId ?? profiles[1]?.id);
  const [snoozeMinutes, setSnoozeMinutes] = useState(
    existing?.snooze.defaultMinutes ?? appConfig.snooze.presetMinutes[1],
  );
  const [historyEnabled, setHistoryEnabled] = useState(existing?.historyEnabled ?? true);
  const preferences = usePreferences();
  const use24Hour = preferences.data?.use24HourTime ?? null;
  const [labelTouched, setLabelTouched] = useState(false);

  // Every Save while notifications are blocked shows this nag (not just
  // once) — the user explicitly asked to be reminded each time, since the
  // OS gives no other signal once a permission dialog stops appearing.
  const capability = useCapabilitySnapshot();
  const openCapabilitySettings = useOpenCapabilitySettings();
  const [notificationsWarningOpen, setNotificationsWarningOpen] = useState(false);
  const notificationsBlocked = capability.data?.items.some(
    item => item.kind === 'notifications' && item.status !== 'ready',
  ) ?? false;

  const selectedMedia = mediaId
    ? mediaList.data?.items.find(item => item.id === mediaId)
    : undefined;

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
        const next = new Date();
        next.setHours(time.hour, time.minute, 0, 0);
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
    const next = new Date();
    next.setHours(time.hour, time.minute, 0, 0);
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
    const timeLabel = formatLocalTime(next, use24Hour);
    return t('reminders.editor.previewNext', {date, time: timeLabel});
  }, [t, time, repeatType, weekdays, dayOfMonth, month, use24Hour]);

  const isValid = label.trim().length > 0 && profileId !== undefined;

  useEffect(() => {
    if (!isNew || labelTouched || label.trim().length > 0 || selectedMedia === undefined) {
      return;
    }
    setLabel(selectedMedia.title);
  }, [isNew, label, labelTouched, selectedMedia]);

  const performSave = () => {
    if (!profileId) {
      return;
    }
    saveReminder.mutate(
      {
        id: existing?.id,
        ...(selectedMedia ? {mediaId: selectedMedia.id} : {}),
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

  const handleSave = () => {
    if (!isValid || !profileId) {
      return;
    }
    if (notificationsBlocked) {
      setNotificationsWarningOpen(true);
      return;
    }
    performSave();
  };

  return (
    <Screen hasAppBar>
      <AppBar
        title={isNew ? t('reminders.editor.newTitle') : t('reminders.editor.editTitle')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.formScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator>
        <Stack gap="xl" paddingVertical="md">
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

          <Stack gap="xs">
            <Text variant="titleLarge">{t('reminders.editor.mediaSection')}</Text>
            {selectedMedia ? (
              <Stack gap="xxs">
                <MediaWhatCard
                  media={selectedMedia}
                  changeLabel={t('reminders.editor.changeMedia')}
                  onPress={() => navigation.navigate(rootRoutes.selectMedia, {selectedMediaId: mediaId})}
                />
                {isNew ? (
                  <Button
                    label={t('reminders.editor.removeMedia')}
                    variant="text"
                    onPress={() => setMediaId(undefined)}
                  />
                ) : null}
              </Stack>
            ) : (
              <Button
                label={t('reminders.editor.chooseMedia')}
                variant="outlined"
                onPress={() => navigation.navigate(rootRoutes.selectMedia, {selectedMediaId: mediaId})}
              />
            )}
          </Stack>

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
                use24Hour={use24Hour}
                hourLabel={t('reminders.editor.time')}
                minuteLabel={t('reminders.editor.time')}
                periodLabel={t('reminders.editor.period')}
                amLabel={t('reminders.editor.periodAm')}
                pmLabel={t('reminders.editor.periodPm')}
                increaseLabel={t('reminders.editor.increase')}
                decreaseLabel={t('reminders.editor.decrease')}
              />
            </Stack>
          </Stack>

          <Stack gap="xs">
            <Text variant="titleLarge">{t('reminders.editor.alertStyle')}</Text>
            <Stack gap="xs" accessibilityLabel={t('reminders.editor.alertStyle')}>
              {profiles.map(profile => (
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

          <Stack gap="sm">
            <Text variant="titleLarge">{t('reminders.editor.options')}</Text>
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

          <Stack gap="xs">
            <Text variant="titleLarge">{t('reminders.editor.preview')}</Text>
            <Card>
              <Text variant="titleMedium">{previewText}</Text>
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
        </Stack>
      </ScrollView>

      <View style={styles.saveBar}>
        <Button
          label={t('reminders.editor.save')}
          onPress={handleSave}
          loading={saveReminder.isPending}
          disabled={!isValid}
          disabledReason={t('reminders.editor.validationLabelRequired')}
          fullWidth
        />
      </View>

      <Dialog
        visible={notificationsWarningOpen}
        title={t('reminders.editor.notificationsBlockedTitle')}
        body={t('reminders.editor.notificationsBlockedBody')}
        cancel={{
          label: t('reminders.editor.notificationsBlockedContinue'),
          onPress: () => {
            setNotificationsWarningOpen(false);
            performSave();
          },
        }}
        confirm={{
          label: t('reminders.editor.notificationsBlockedOpenSettings'),
          onPress: () => {
            setNotificationsWarningOpen(false);
            openCapabilitySettings.mutate('notifications');
          },
        }}
      />
    </Screen>
  );
}

interface MediaWhatCardProps {
  readonly media: MediaSummary;
  readonly changeLabel: string;
  readonly onPress: () => void;
}

/**
 * Extracted so its thumbnail-or-icon branching and theme-dependent style
 * don't add to `ReminderEditorForm`'s own cognitive complexity (code-health
 * hook, this slice) — a real thumbnail here (previously always a bare kind
 * icon) is what actually makes "What" recognizable at a glance instead of
 * every video/audio/image reminder showing the same generic glyph.
 */
function MediaWhatCard({media, changeLabel, onPress}: MediaWhatCardProps) {
  const theme = useTheme();
  const thumbnail = thumbnailImageSource(media.thumbnailToken);

  const avatarStyle = StyleSheet.create({
    box: {
      width: theme.layout.reminderThumbnailSize,
      height: theme.layout.reminderThumbnailSize,
      borderRadius: theme.radius.card,
      backgroundColor: theme.color.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });

  return (
    <Card onPress={onPress}>
      <Stack direction="row" align="center" gap="sm">
        <Stack style={avatarStyle.box} align="center" justify="center">
          {thumbnail ? (
            <Image
              source={thumbnail}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : (
            <Icon name={MEDIA_KIND_ICON[media.kind]} color={theme.color.onSurfaceVariant} />
          )}
        </Stack>
        <Stack style={styles.flexFill} gap={2}>
          <Text variant="titleMedium">{media.title}</Text>
          <Text variant="labelMedium" tone="variant">
            {changeLabel}
          </Text>
        </Stack>
        <Icon name="chevronRight" color={theme.color.onSurfaceVariant} />
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
  formScroll: {paddingBottom: 24},
  saveBar: {paddingHorizontal: 16, paddingVertical: 12},
});
