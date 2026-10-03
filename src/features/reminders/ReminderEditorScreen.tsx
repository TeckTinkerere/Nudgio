/**
 * Create/edit reminder screen.
 *
 * Media leads. The form used to open with two boxed text fields and put the
 * media below them as a heading, a paragraph and three chunky buttons — so
 * the first thing anyone met when creating a reminder was a form, and the
 * one thing that makes this app not a clock looked like an attachment row.
 * Now the stage comes first and the words sit under the thing they are
 * about: media, what it says, when it returns, what it opens afterwards,
 * and — collapsed, because the defaults are right for most reminders — how
 * loudly it alerts. Each section is its own component in `./editor/`; this
 * file owns the form state and the save.
 *
 * Save lives in the app bar as well as at the end, so it is reachable from
 * anywhere in a long form. It is never silently disabled: an incomplete
 * form marks what is missing and names the first problem.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useEffect, useMemo, useState} from 'react';

import {ReminderActionSection, actionFromDraft, draftFromAction, type ActionDraft} from './editor/ReminderActionSection';
import {ReminderAlertSection} from './editor/ReminderAlertSection';
import {ReminderMediaSection} from './editor/ReminderMediaSection';
import {
  REPEAT_LABEL_KEY,
  ReminderWhenSection,
  monthName,
  type RepeatType,
} from './editor/ReminderWhenSection';
import type {TimeOfDayValue} from './TimePicker';
import {useReminderDetail} from './useReminderDetail';
import {useSaveReminder} from './useSaveReminder';
import {weekdayOptions} from './weekdayOptions';
import type {RootStackParamList} from '../../app/navigation/types';
import {useToast} from '../../app/toast/ToastProvider';
import {rootRoutes} from '../../constants/routes';
import {appConfig} from '../../core/config/appConfig';
import {
  AppBar,
  Banner,
  Button,
  Dialog,
  ErrorState,
  LoadingState,
  Screen,
  Stack,
  StatusPill,
  TextField,
  useFloatingAppBar,
} from '../../design-system';
import {
  useCapabilitySnapshot,
  useOpenCapabilitySettings,
  usePreferences,
  useProfiles,
} from '../../hooks';
import {useTranslation, type TranslationKey} from '../../localization';
import type {
  Instant,
  LocalDate,
  LocalTime,
  ReminderDetail,
  ReminderProfile,
  ScheduleRuleDto,
  UUID,
  ZoneId,
} from '../../native-client/types';
import {statusKindFor, statusLabelKeyFor} from '../home/capabilityStatus';
import {useMediaDetail} from '../library/useMediaDetail';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderEditor'>;


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

const timeFromLocalTime = (localTime: string): TimeOfDayValue => {
  const [hh = 6, mm = 0] = localTime.split(':').map(Number);
  const period = hh < 12 ? 'AM' : 'PM';
  const hour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return {hour, minute: mm, period};
};

const initialTimeFromSchedule = (schedule: ScheduleRuleDto | undefined): TimeOfDayValue => {
  if (!schedule) {return {hour: 6, minute: 15, period: 'AM'};}
  if (schedule.type === 'once') {
    const d = new Date(schedule.instant);
    const h24 = d.getHours();
    const period = h24 < 12 ? 'AM' : 'PM';
    const hour = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    return {hour, minute: d.getMinutes(), period};
  }
  return timeFromLocalTime(schedule.localTime);
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
  const duplicateFromId = reminderId === undefined ? route.params.duplicateFromId : undefined;
  const sourceId = reminderId ?? duplicateFromId;
  const reminderDetail = useReminderDetail(sourceId);
  // Real, Room-seeded profiles (MR-08 `listProfiles`) — the form used to
  // read the hardcoded `mockProfiles` fixture directly for both the default
  // selection and the "Alert style" list (see `useProfiles`'s doc). Gated
  // here the same way as `existing`: the form's `useState` initializers
  // seed once from whatever `profiles.data` was at mount time, so it must
  // already be loaded before the form ever mounts.
  const profiles = useProfiles();
  // Gated alongside `profiles` for the same reason: the form seeds
  // `snoozeMinutes` from this once, in a `useState` initializer, so the
  // preference must already be resolved before the form mounts or a new
  // reminder silently keeps the build-time default instead of the user's.
  const preferences = usePreferences();
  const backAction = {label: t('action.back'), onPress: () => navigation.goBack()};
  const title = reminderId === undefined ? t('reminders.editor.newTitle') : t('reminders.editor.editTitle');

  if (
    (sourceId !== undefined && reminderDetail.isPending) ||
    profiles.isPending ||
    preferences.isPending
  ) {
    return (
      <Screen hasAppBar>
        <AppBar title={title} back={backAction} />
        <LoadingState label={t('loading.startingUp')} />
      </Screen>
    );
  }

  if (sourceId !== undefined && reminderDetail.isError) {
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
      template={duplicateFromId !== undefined ? reminderDetail.data : undefined}
      prefillMediaId={route.params.mediaId}
      profiles={profiles.data}
      defaultSnoozeMinutes={preferences.data?.defaultSnoozeMinutes ?? appConfig.snooze.presetMinutes[1]!}
      use24HourTime={preferences.data?.use24HourTime ?? null}
    />
  );
}

interface ReminderEditorFormProps {
  readonly navigation: Props['navigation'];
  readonly existing: ReminderDetail | undefined;
  /** A reminder to copy from ("Duplicate"); only seeds the form, never saved over. */
  readonly template?: ReminderDetail;
  readonly prefillMediaId: UUID | undefined;
  readonly profiles: readonly ReminderProfile[];
  /** Settings' "Default snooze duration" — the seed for a *new* reminder. */
  readonly defaultSnoozeMinutes: number;
  readonly use24HourTime: boolean | null;
}

function ReminderEditorForm({
  navigation,
  existing,
  template,
  prefillMediaId,
  profiles,
  defaultSnoozeMinutes,
  use24HourTime,
}: ReminderEditorFormProps) {
  const t = useTranslation();
  const {showToast} = useToast();
  const isNew = existing === undefined;
  const saveReminder = useSaveReminder();
  // Initial values come from the reminder being edited or duplicated; only
  // `existing` decides what Save overwrites (`id`, `entityVersion`).
  const seed = existing ?? template;

  // No mock fallback: an unset `mediaId` correctly leaves the form invalid
  // until the user picks a real item, rather than silently pointing a saved
  // reminder at a fixture id that does not exist in Room.
  const [mediaId, setMediaId] = useState(seed?.mediaId ?? prefillMediaId);
  // `prefillMediaId` doubles as this screen's own "return value" from
  // `SelectMediaScreen`: confirming a pick there merges a new `mediaId` into
  // this route's params (`navigation.popTo(..., {merge: true})`), which
  // arrives here as a changed `prefillMediaId` prop. `useState`'s initializer
  // above only ever runs once at mount, so without this effect a pick made
  // after the form was already open would never actually apply.
  useEffect(() => {
    if (prefillMediaId !== undefined) {
      setMediaId(prefillMediaId);
    }
  }, [prefillMediaId]);
  // Resolve the selected item directly, even beyond the first library page.
  const mediaDetail = useMediaDetail(mediaId);
  const [label, setLabel] = useState(seed?.label ?? '');
  const [notes, setNotes] = useState(seed?.notes ?? '');
  const [repeatType, setRepeatType] = useState<RepeatType>(seed?.schedule.type ?? 'daily');
  const [time, setTime] = useState<TimeOfDayValue>(() => initialTimeFromSchedule(seed?.schedule));
  const [weekdays, setWeekdays] = useState<readonly number[]>(
    () =>
      seed?.schedule.type === 'weekdays' ? seed.schedule.isoWeekdays : [1, 2, 3, 4, 5],
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    () =>
      seed?.schedule.type === 'monthly' || seed?.schedule.type === 'yearly'
        ? seed.schedule.dayOfMonth
        : 1,
  );
  const [month, setMonth] = useState(
    () =>
      seed?.schedule.type === 'yearly'
        ? seed.schedule.month
        : new Date().getMonth() + 1,
  );
  const [intervalDays, setIntervalDays] = useState(
    () => (seed?.schedule.type === 'custom' ? seed.schedule.intervalDays : 3),
  );
  const [profileId, setProfileId] = useState(seed?.profileId ?? profiles[1]?.id);
  // Settings' preference, not `appConfig`: the build constant is only the
  // fallback for a preferences read that failed. Using it unconditionally
  // made "Default snooze duration" in Settings a control that changed
  // nothing for every reminder created afterwards.
  const [snoozeMinutes, setSnoozeMinutes] = useState(
    seed?.snooze.defaultMinutes ?? defaultSnoozeMinutes,
  );
  const [historyEnabled, setHistoryEnabled] = useState(seed?.historyEnabled ?? true);
  const [actionDraft, setActionDraft] = useState<ActionDraft>(() => draftFromAction(seed?.action));
  const [labelTouched, setLabelTouched] = useState(false);
  const [actionTouched, setActionTouched] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const appBar = useFloatingAppBar();

  // Every Save while notifications are blocked shows this nag (not just
  // once) — the user explicitly asked to be reminded each time, since the
  // OS gives no other signal once a permission dialog stops appearing.
  const capability = useCapabilitySnapshot();
  const openCapabilitySettings = useOpenCapabilitySettings();
  const [notificationsWarningOpen, setNotificationsWarningOpen] = useState(false);
  const notificationsBlocked = capability.data?.items.some(
    item => item.kind === 'notifications' && item.status !== 'ready',
  ) ?? false;
  // Same nag, for the capability that actually determines whether the alarm
  // fires *on time*: exact-alarm access has no runtime dialog of its own
  // (Android only offers a Settings deep link) and no other prompt anywhere
  // in the app ever surfaces it proactively — previously the only way to
  // notice and fix this was to already know to visit the Health screen.
  const [exactAlarmWarningOpen, setExactAlarmWarningOpen] = useState(false);
  const exactAlarmBlocked = capability.data?.items.some(
    item => item.kind === 'exact_alarm' && item.status !== 'ready',
  ) ?? false;

  const selectedMedia = mediaDetail.data;
  const action = actionFromDraft(actionDraft);

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

  const scheduleSummary = useMemo(() => {
    const {hour, minute} = to24Hour(time);
    const clock = new Date();
    clock.setHours(hour, minute, 0, 0);
    const timeLabel = new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit',
      ...(use24HourTime === null ? {} : {hour12: !use24HourTime})}).format(clock);
    const repeat = repeatType === 'custom'
      ? t('reminders.editor.intervalDaysValue', {days: intervalDays}) : t(REPEAT_LABEL_KEY[repeatType]);
    const base = t('reminders.editor.scheduleSummary', {repeat, time: timeLabel});
    if (repeatType === 'weekdays' && weekdays.length > 0) {
      const days = weekdayOptions(t).filter(option => weekdays.includes(option.isoWeekday));
      return `${base} · ${days.map(option => option.label).join(', ')}`;
    }
    if (repeatType === 'monthly' || repeatType === 'yearly') {
      const monthLabel = repeatType === 'yearly' ? monthName(month) : t(REPEAT_LABEL_KEY.monthly);
      return `${base} · ${t('reminders.editor.monthDaySummary', {day: dayOfMonth, month: monthLabel})}`;
    }
    return base;
  }, [t, time, repeatType, intervalDays, use24HourTime, weekdays, dayOfMonth, month]);

  // The first problem, in the order the form reads — the one the toast names.
  const problem = firstProblem({
    label,
    hasMedia: selectedMedia !== undefined,
    repeatType,
    weekdayCount: weekdays.length,
    actionInvalid: action === 'invalid',
    hasProfile: Boolean(profileId),
  });

  const performSave = () => {
    if (!selectedMedia || !profileId || action === 'invalid') {
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
        historyEnabled,
        action,
      },
      {onSuccess: () => navigation.goBack()},
    );
  };

  /**
   * Save is never a greyed-out mystery: tapping it with something missing
   * marks every field that needs attention and names the first one.
   */
  const handleSave = () => {
    if (problem !== null) {
      setSaveAttempted(true);
      showToast({message: t(problem), tone: 'error'});
      return;
    }
    if (notificationsBlocked) {
      setNotificationsWarningOpen(true);
      return;
    }
    if (exactAlarmBlocked) {
      setExactAlarmWarningOpen(true);
      return;
    }
    performSave();
  };

  const continuePastNotificationsWarning = () => {
    setNotificationsWarningOpen(false);
    if (exactAlarmBlocked) {
      setExactAlarmWarningOpen(true);
      return;
    }
    performSave();
  };

  const showLabelError = (labelTouched || saveAttempted) && !label.trim();

  return (
    <Screen
      hasAppBar
      scrollable
      onScroll={appBar.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{paddingTop: appBar.barHeight}}
      appBarSlot={
        <AppBar
          title={isNew ? t('reminders.editor.newTitle') : t('reminders.editor.editTitle')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
          trailing={
            <Button label={t('action.save')} variant="text" onPress={handleSave}
              loading={saveReminder.isPending} testID="reminder-save-top" />
          }
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
        />
      }>
      <Stack gap="xl" paddingVertical="md">
        <ReminderMediaSection
          media={selectedMedia}
          loading={mediaId !== undefined && mediaDetail.isPending}
          failed={mediaDetail.isError}
          onRetry={() => mediaDetail.refetch()}
          onPicked={setMediaId}
          onChooseFromLibrary={() => navigation.navigate(rootRoutes.selectMedia, {selectedMediaId: mediaId})}
          error={saveAttempted ? t('reminders.editor.validationMediaRequired') : undefined}
        />

        {/* What it says, under the thing it is about. */}
        <Stack gap="sm">
          <TextField
            label={t('reminders.editor.titleLabel')}
            placeholder={t('reminders.editor.titlePlaceholder')}
            value={label}
            onChangeText={setLabel}
            onBlur={() => setLabelTouched(true)}
            maxLength={160}
            required
            error={showLabelError ? t('reminders.editor.validationLabelRequired') : undefined}
            testID="reminder-title"
          />
          <TextField
            label={t('reminders.editor.messageLabel')}
            placeholder={t('reminders.editor.messagePlaceholder')}
            value={notes}
            onChangeText={setNotes}
            maxLength={4000}
            multiline
            testID="reminder-message"
          />
        </Stack>

        <ReminderWhenSection
          time={time}
          onTimeChange={setTime}
          repeatType={repeatType}
          onRepeatTypeChange={setRepeatType}
          weekdays={weekdays}
          onWeekdaysChange={setWeekdays}
          dayOfMonth={dayOfMonth}
          onDayOfMonthChange={setDayOfMonth}
          month={month}
          onMonthChange={setMonth}
          intervalDays={intervalDays}
          onIntervalDaysChange={setIntervalDays}
          summary={scheduleSummary}
        />

        <ReminderActionSection
          value={actionDraft}
          onChange={setActionDraft}
          showErrors={actionTouched || saveAttempted}
          onLinkBlur={() => setActionTouched(true)}
        />

        <ReminderAlertSection
          profiles={profiles}
          profileId={profileId}
          onProfileChange={setProfileId}
          snoozeMinutes={snoozeMinutes}
          onSnoozeChange={setSnoozeMinutes}
          historyEnabled={historyEnabled}
          onHistoryChange={setHistoryEnabled}
        />

        {capability.data && capability.data.overall !== 'ok' ? (
          <StatusPill kind={statusKindFor(capability.data.overall)} label={t(statusLabelKeyFor(capability.data.overall))} />
        ) : null}

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
          fullWidth
          testID="reminder-save"
        />
      </Stack>

      <Dialog
        visible={notificationsWarningOpen}
        title={t('reminders.editor.notificationsBlockedTitle')}
        body={t('reminders.editor.notificationsBlockedBody')}
        cancel={{
          label: t('reminders.editor.notificationsBlockedContinue'),
          onPress: continuePastNotificationsWarning,
        }}
        confirm={{
          label: t('reminders.editor.notificationsBlockedOpenSettings'),
          onPress: () => {
            setNotificationsWarningOpen(false);
            openCapabilitySettings.mutate('notifications');
          },
        }}
      />

      <Dialog
        visible={exactAlarmWarningOpen}
        title={t('reminders.editor.exactAlarmBlockedTitle')}
        body={t('reminders.editor.exactAlarmBlockedBody')}
        cancel={{
          label: t('reminders.editor.exactAlarmBlockedContinue'),
          onPress: () => {
            setExactAlarmWarningOpen(false);
            performSave();
          },
        }}
        confirm={{
          label: t('reminders.editor.exactAlarmBlockedOpenSettings'),
          onPress: () => {
            setExactAlarmWarningOpen(false);
            openCapabilitySettings.mutate('exact_alarm');
          },
        }}
      />
    </Screen>
  );
}

interface FormProblemInput {
  readonly label: string;
  readonly hasMedia: boolean;
  readonly repeatType: RepeatType;
  readonly weekdayCount: number;
  readonly actionInvalid: boolean;
  readonly hasProfile: boolean;
}

/** The first thing stopping a save, in the order the form reads; `null` when it can save. */
const firstProblem = (input: FormProblemInput): TranslationKey | null => {
  if (input.label.trim().length === 0) {
    return 'reminders.editor.validationLabelRequired';
  }
  if (!input.hasMedia) {
    return 'reminders.editor.validationMediaRequired';
  }
  if (input.repeatType === 'weekdays' && input.weekdayCount === 0) {
    return 'reminders.editor.validationWeekdaysRequired';
  }
  if (input.actionInvalid) {
    return 'reminders.action.invalid';
  }
  if (!input.hasProfile) {
    return 'reminders.editor.validationProfileRequired';
  }
  return null;
};
