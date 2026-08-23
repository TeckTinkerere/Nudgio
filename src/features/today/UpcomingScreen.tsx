/**
 * Upcoming screen (formerly "Today" — MR-03 "Today screen", extended into a
 * chronological 5-day view per direct product request). The internal route
 * key (`tabRoutes.today`) and every existing testID/localization *key* stay
 * exactly as they were; only the user-facing label changed ("Today" ->
 * "Upcoming" everywhere it is shown), so navigation state, deep links and
 * existing test selectors are unaffected.
 *
 * The 5-day list is a read-only display projection
 * (`projectUpcomingOccurrences`) built from each reminder's own recurrence
 * rule (`ReminderSummary.schedule`, newly exposed on the list endpoint for
 * exactly this) — see that module's doc comment for why this does not
 * conflict with MR-08's "UI never calculates authoritative next occurrence"
 * rule. Nothing here is written back into Room or fed into scheduling; the
 * real, single global alarm remains entirely native-owned.
 *
 * The timeline renders through `VirtualizedList` as a flat list of
 * discriminated `Row`s (header / occurrence / empty-day) rather than a
 * nested section list — with the tiny per-day item counts this app's real
 * data ever produces, that is simpler than adopting a second list primitive
 * and still satisfies "never eagerly map an array into JSX" (MR-09).
 *
 * "Preview sound" reuses the app's one existing shared preview surface,
 * `MediaPreviewPlayer` (also used by Library, the Reminders list and the
 * reminder-editor media picker) rather than a new inline per-row audio
 * player: one `previewItem` state on this screen is the "single shared
 * preview controller" the feature asked for — starting a new preview
 * replaces it (impossible to have two), and dismissing/unmounting always
 * stops playback (the modal's own lifecycle already guarantees this, see
 * that component's doc).
 */
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback, useMemo, useState} from 'react';
import {StyleSheet} from 'react-native';
import type {ListRenderItem} from 'react-native';

import {statusKindFor, statusLabelKeyFor} from './capabilityStatus';
import {
  localDateKey,
  projectUpcomingOccurrences,
  upcomingDayAnchors,
  type UpcomingOccurrence,
} from './projectUpcomingOccurrences';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
  Banner,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  Stack,
  StatusPill,
  Text,
  VirtualizedList,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {spacing} from '../../design-system/tokens';
import {
  usePreferences,
  useReminderList,
  useStartupSnapshot,
} from '../../hooks';
import {formatLocalTime, useTranslation} from '../../localization';
import type {MediaKind, ReminderSummary} from '../../native-client/types';
import {MediaPreviewPlayer} from '../library/MediaPreviewPlayer';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/** Today plus the following four calendar days, per the product request. */
const UPCOMING_DAYS = 5;

const MEDIA_ICON: Record<string, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
};

/** Only these two kinds have anything `MediaPreviewPlayer` can play — matches Library/Reminders' own gate. */
const isPlayableKind = (kind: MediaKind): kind is 'video' | 'audio' => kind === 'video' || kind === 'audio';

type Row =
  | {readonly type: 'header'; readonly key: string; readonly label: string}
  | {readonly type: 'rest'; readonly key: string}
  | {readonly type: 'occurrence'; readonly key: string; readonly entry: UpcomingOccurrence};

export function UpcomingScreen() {
  const t = useTranslation();
  const navigation = useNavigation<Navigation>();
  const startup = useStartupSnapshot();
  const reminders = useReminderList();
  const preferences = usePreferences();
  const [previewReminder, setPreviewReminder] = useState<ReminderSummary | null>(null);

  // Refreshed on focus (not a continuous timer — MR-13/the feature's own
  // "avoid unnecessary continuous timers" ask): re-entering this screen
  // after time has passed, including past midnight, recomputes the window
  // and re-excludes anything that has now passed today.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );

  const languageTag = preferences.data?.languageTag ?? undefined;
  const use24Hour = preferences.data?.use24HourTime ?? null;

  const dayAnchors = useMemo(() => upcomingDayAnchors(now, UPCOMING_DAYS), [now]);
  const occurrences = useMemo(
    () => projectUpcomingOccurrences(reminders.data?.items ?? [], UPCOMING_DAYS, now),
    [reminders.data, now],
  );

  const headingFor = useCallback(
    (day: Date, offset: number): string => {
      if (offset === 0) {
        return t('today.section.today');
      }
      if (offset === 1) {
        const dayMonth = new Intl.DateTimeFormat(languageTag, {day: 'numeric', month: 'long'}).format(day);
        return t('today.section.tomorrow', {date: dayMonth});
      }
      return new Intl.DateTimeFormat(languageTag, {weekday: 'long', day: 'numeric', month: 'long'}).format(day);
    },
    [languageTag, t],
  );

  const rows = useMemo<readonly Row[]>(() => {
    const byDate = new Map<string, UpcomingOccurrence[]>();
    for (const entry of occurrences) {
      const bucket = byDate.get(entry.localDate);
      if (bucket) {
        bucket.push(entry);
      } else {
        byDate.set(entry.localDate, [entry]);
      }
    }

    const built: Row[] = [];
    let skippedEmpty = false;
    for (const [offset, day] of dayAnchors.entries()) {
      const dateKey = localDateKey(day);
      const dayEntries = byDate.get(dateKey) ?? [];
      if (dayEntries.length === 0) {
        skippedEmpty = true;
        continue;
      }
      built.push({type: 'header', key: `header-${dateKey}`, label: headingFor(day, offset)});
      for (const entry of dayEntries) {
        built.push({type: 'occurrence', key: entry.id, entry});
      }
    }
    if (skippedEmpty && built.length > 0) {
      built.push({type: 'rest', key: 'rest-empty'});
    }
    return built;
  }, [dayAnchors, occurrences, headingFor]);

  const renderRow: ListRenderItem<Row> = useCallback(
    ({item}) => {
      if (item.type === 'header') {
        return (
          <Text variant="labelLarge" tone="variant" style={styles.sectionHeading}>
            {item.label.toUpperCase()}
          </Text>
        );
      }
      if (item.type === 'rest') {
        return (
          <Text variant="bodyMedium" tone="variant" style={styles.emptyDayRow}>
            {t('today.restOfWeekEmpty')}
          </Text>
        );
      }

      const {entry} = item;
      const {reminder} = entry;
      const time = formatLocalTime(entry.dateTime, use24Hour);
      const canPlay = isPlayableKind(reminder.mediaKind) && Boolean(reminder.sourceToken);

      return (
        <Card
          style={styles.occurrenceCard}
          onPress={() => navigation.navigate(rootRoutes.reminderDetail, {reminderId: reminder.id})}
          accessibilityLabel={`${time}. ${reminder.label}`}>
          <Stack direction="row" align="center" gap="sm">
            <Text variant="titleMedium" tabularNumbers>
              {time}
            </Text>
            <Icon name={MEDIA_ICON[reminder.mediaKind] ?? 'reminders'} size="sm" />
            <Stack style={styles.flexFill} gap={2}>
              <Text variant="bodyLarge">{reminder.label}</Text>
            </Stack>
            {canPlay ? (
              <IconButton
                name="play"
                label={t('today.previewSoundFor', {label: reminder.label, time})}
                onPress={() => setPreviewReminder(reminder)}
              />
            ) : null}
          </Stack>
        </Card>
      );
    },
    [navigation, t, use24Hour],
  );

  // `isPending`, not `isLoading`: v5's `isLoading` is a derived convenience
  // flag (`isPending && isFetching`) that is not part of the discriminated
  // `status` union, so checking it does not narrow `startup.data` below. The
  // UI meaning is the same either way — "no data yet".
  if (startup.isPending) {
    return <LoadingState label={t('loading.startingUp')} />;
  }

  if (startup.isError) {
    return (
      <ErrorState
        title={t('error.unexpected.title')}
        effect={t('error.unexpected.effect')}
        recoveryAction={{label: t('action.retry'), onPress: () => startup.refetch()}}
        diagnosticCode={startup.error.correlationId}
      />
    );
  }

  const snapshot = startup.data;
  const hasReminders = snapshot.activeReminderCount > 0;
  const overallStatus = snapshot.capability.overall;
  const hasOccurrences = occurrences.length > 0;

  const header = (
    <Stack gap="lg" paddingVertical="md">
      <ScreenHeader
        title={t('today.title')}
        trailing={
          <StatusPill
            kind={statusKindFor(overallStatus)}
            label={t(statusLabelKeyFor(overallStatus))}
          />
        }
      />

      {overallStatus === 'needs_action' && hasReminders ? (
        <Banner
          testID={testIds.today.capabilityBanner}
          kind="actionNeeded"
          title={t('today.capability.exactTimingOff.title')}
          effect={t('today.capability.exactTimingOff.effect')}
          action={{
            label: t('today.capability.openHealth'),
            onPress: () => navigation.navigate(rootRoutes.health),
          }}
        />
      ) : null}

      {hasOccurrences ? null : (
        <EmptyState
          testID={testIds.today.emptyState}
          icon="today"
          title={t('today.empty.title')}
          body={t('today.empty.body')}
          action={{
            label: t('today.empty.createReminder'),
            onPress: () =>
              navigation.navigate(rootRoutes.reminderEditor, {reminderId: undefined}),
          }}
        />
      )}
    </Stack>
  );

  return (
    <Screen edgeToEdge testID={testIds.today.screen}>
      <VirtualizedList
        data={hasOccurrences ? rows : []}
        keyExtractor={row => row.key}
        renderItem={renderRow}
        showSeparators={false}
        clearsFab
        ListHeaderComponent={header}
      />
      {previewReminder && isPlayableKind(previewReminder.mediaKind) && previewReminder.sourceToken ? (
        <MediaPreviewPlayer
          visible
          onDismiss={() => setPreviewReminder(null)}
          title={previewReminder.label}
          sourceToken={previewReminder.sourceToken}
          kind={previewReminder.mediaKind}
          closeLabel={t('library.player.close')}
          loadErrorLabel={t('library.player.loadError')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
  occurrenceCard: {marginBottom: spacing.xxs},
  sectionHeading: {paddingTop: spacing.sm, paddingBottom: spacing.xxs},
  emptyDayRow: {paddingBottom: spacing.xs},
});
