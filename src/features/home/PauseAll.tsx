/**
 * "Pause all" (DL-110): silence every reminder for a while — a holiday, a
 * sick day — without switching each one off and having to remember which.
 *
 * Native owns the effect: `setPausedUntil` stores the end and reschedules
 * every reminder from it, so the first alarm after the pause is already
 * registered and nothing has to "wake up" to resume. This file is the three
 * pieces of UI around it: the hook, the duration sheet, and the Home banner.
 *
 * The pause is read from preferences, which are cached indefinitely; an
 * expired pause can still be in that cache, so every reader compares it with
 * now through `activePauseEnd`.
 */
import {useAppContainer} from '../../app/di';
import {useToast} from '../../app/toast/ToastProvider';
import {queryKeys, unwrapResult} from '../../core/state';
import {Banner, ListRow, Sheet, Stack, Text} from '../../design-system';
import {useAppMutation, useAppQueryClient, usePreferences} from '../../hooks';
import {useTranslation} from '../../localization';
import type {Instant, PreferencesSnapshot} from '../../native-client/types';

/** Mirrors native `PreferencesRepository.INDEFINITE_PAUSE`: "until I resume". */
export const INDEFINITE_PAUSE_ISO = '9999-12-31T23:59:59Z';

export type PauseChoice = 'tomorrowMorning' | 'threeDays' | 'week' | 'indefinite';

const CHOICES: readonly PauseChoice[] = ['tomorrowMorning', 'threeDays', 'week', 'indefinite'];

/** When a choice ends, from `now`. Pure, for tests. */
export const pauseEndFor = (choice: PauseChoice, now: Date): Date => {
  const end = new Date(now);
  switch (choice) {
    case 'tomorrowMorning':
      end.setDate(end.getDate() + 1);
      end.setHours(6, 0, 0, 0);
      return end;
    case 'threeDays':
      end.setDate(end.getDate() + 3);
      return end;
    case 'week':
      end.setDate(end.getDate() + 7);
      return end;
    case 'indefinite':
      return new Date(INDEFINITE_PAUSE_ISO);
  }
};

/** The pause's end if it is still ahead of `now`, else null. */
export const activePauseEnd = (pausedUntil: string | null | undefined, now: Date): Date | null => {
  if (!pausedUntil) {
    return null;
  }
  const end = new Date(pausedUntil);
  return end.getTime() > now.getTime() ? end : null;
};

export const isIndefinite = (end: Date): boolean => end.getUTCFullYear() >= 9999;

export const usePauseAll = () => {
  const {repositories} = useAppContainer();
  const queryClient = useAppQueryClient();
  const preferences = usePreferences();
  const {showToast} = useToast();
  const t = useTranslation();

  const mutation = useAppMutation<PreferencesSnapshot, Date | null>({
    mutationFn: until =>
      unwrapResult(() => repositories.reminders.setPausedUntil(until ? (until.toISOString() as Instant) : null)),
    onSuccess: (snapshot, until) => {
      queryClient.setQueryData(queryKeys.preferences(), snapshot);
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.reminders.all()});
      // eslint-disable-next-line no-void
      void queryClient.invalidateQueries({queryKey: queryKeys.startup()});
      showToast({message: t(until ? 'pause.started' : 'pause.ended'), tone: 'success'});
    },
    onError: () => showToast({message: t('pause.error'), tone: 'error'}),
  });

  return {
    end: activePauseEnd(preferences.data?.pausedUntil, new Date()),
    pause: (choice: PauseChoice) => mutation.mutate(pauseEndFor(choice, new Date())),
    resume: () => mutation.mutate(null),
    isPending: mutation.isPending,
  };
};

/** "Paused until Mon 6:00 AM" / "Paused until you turn reminders back on". */
export const describePauseEnd = (end: Date, t: ReturnType<typeof useTranslation>, use24Hour: boolean | null): string => {
  if (isIndefinite(end)) {
    return t('pause.untilResumed');
  }
  const when = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    ...(use24Hour === null ? {} : {hour12: !use24Hour}),
  }).format(end);
  return t('pause.until', {when});
};

export interface PauseAllSheetProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly onChoose: (choice: PauseChoice) => void;
}

const CHOICE_LABEL = {
  tomorrowMorning: 'pause.choice.tomorrowMorning',
  threeDays: 'pause.choice.threeDays',
  week: 'pause.choice.week',
  indefinite: 'pause.choice.indefinite',
} as const;

export function PauseAllSheet({visible, onDismiss, onChoose}: PauseAllSheetProps) {
  const t = useTranslation();
  return (
    <Sheet visible={visible} onDismiss={onDismiss} title={t('pause.title')} closeLabel={t('action.close')} testID="pause-all-sheet">
      <Stack gap="xs">
        <Text variant="bodyMedium" tone="variant">{t('pause.explainer')}</Text>
        {CHOICES.map(choice => (
          <ListRow
            key={choice}
            title={t(CHOICE_LABEL[choice])}
            onPress={() => {
              onDismiss();
              onChoose(choice);
            }}
            testID={`pause-choice-${choice}`}
          />
        ))}
      </Stack>
    </Sheet>
  );
}

/** Home's notice while paused. Renders nothing otherwise. */
export function PausedBanner() {
  const t = useTranslation();
  const preferences = usePreferences();
  const pauseAll = usePauseAll();
  if (!pauseAll.end) {
    return null;
  }
  return (
    <Banner
      kind="neutral"
      title={t('pause.bannerTitle')}
      effect={describePauseEnd(pauseAll.end, t, preferences.data?.use24HourTime ?? null)}
      action={{label: t('pause.resume'), onPress: pauseAll.resume}}
      testID="paused-banner"
    />
  );
}
