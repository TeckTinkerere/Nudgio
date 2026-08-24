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
import {Image, StyleSheet, View} from 'react-native';
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
  AppBar,
  Banner,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  ProgressBar,
  Screen,
  Stack,
  StatusPill,
  Text,
  useFloatingAppBar,
  VirtualizedList,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {useTheme} from '../../design-system/theme/useTheme';
import {spacing} from '../../design-system/tokens';
import {
  importErrorCopy,
  importPhaseLabelKey,
  importProgressFraction,
  STORAGE_INSUFFICIENT_MIN_MB,
  useImportMedia,
  usePreferences,
  useReminderList,
  useStartupSnapshot,
} from '../../hooks';
import {formatLocalTime, useTranslation} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
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
  | {readonly type: 'empty'; readonly key: string}
  | {readonly type: 'occurrence'; readonly key: string; readonly entry: UpcomingOccurrence};

export function UpcomingScreen() {
  const t = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const startup = useStartupSnapshot();
  const importMedia = useImportMedia();
  const reminders = useReminderList();
  const preferences = usePreferences();
  const [previewReminder, setPreviewReminder] = useState<ReminderSummary | null>(null);
  const appBar = useFloatingAppBar();

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

    return dayAnchors.flatMap((day, offset): Row[] => {
      const dateKey = localDateKey(day);
      const dayEntries = byDate.get(dateKey) ?? [];
      const header: Row = {type: 'header', key: `header-${dateKey}`, label: headingFor(day, offset)};
      if (dayEntries.length === 0) {
        return [header, {type: 'empty', key: `empty-${dateKey}`}];
      }
      return [header, ...dayEntries.map(entry => ({type: 'occurrence' as const, key: entry.id, entry}))];
    });
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
      if (item.type === 'empty') {
        return (
          <Text variant="bodyMedium" tone="variant" style={styles.emptyDayRow}>
            {t('today.section.empty')}
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

  const nextEntry = occurrences[0];
  const nextThumbnail = nextEntry ? thumbnailImageSource(nextEntry.reminder.thumbnailToken) : undefined;
  const tomorrowAnchor = dayAnchors[1] ?? now;
  const nextContextLabel = nextEntry
    ? (() => {
        const time = formatLocalTime(nextEntry.dateTime, use24Hour);
        if (nextEntry.localDate === localDateKey(now)) {
          return t('today.nextReminder.todayAt', {time});
        }
        if (nextEntry.localDate === localDateKey(tomorrowAnchor)) {
          return t('today.nextReminder.tomorrowAt', {time});
        }
        return t('today.nextReminder.weekdayAt', {
          weekday: new Intl.DateTimeFormat(languageTag, {weekday: 'long'}).format(nextEntry.dateTime),
          time,
        });
      })()
    : undefined;
  const nextCanPlay =
    nextEntry !== undefined &&
    isPlayableKind(nextEntry.reminder.mediaKind) &&
    Boolean(nextEntry.reminder.sourceToken);

  // A themed avatar container for the hero's media icon — dynamic (reads
  // `theme.color`), so it is wrapped in `StyleSheet.create` per-render rather
  // than a raw inline object (see `MediaPreviewPlayer`'s doc comment for why
  // this is the pattern here instead of a static module-level style).
  const heroStyles = StyleSheet.create({
    avatar: {
      width: theme.layout.reminderThumbnailSize,
      height: theme.layout.reminderThumbnailSize,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });

  const header = (
    <Stack gap="lg" paddingVertical="md">
      {/* Title and status pill live in the floating `AppBar` below, not here —
          all four tab roots share the same compact bar so chrome does not
          drift between destinations. This spacer reserves its height. */}
      <View style={{height: appBar.barHeight}} />

      {/*
        MR-03: "A single high-salience card appears only for a condition
        that affects active reminders... It never blocks browsing."
      */}
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

      {nextEntry ? (
        <Stack gap="xs">
          <Text variant="labelLarge" tone="variant">
            {t('today.nextReminder')}
          </Text>
          <Card testID={testIds.today.nextReminderCard}>
            <Stack direction="row" gap="sm" align="center">
              <Stack style={heroStyles.avatar} align="center" justify="center">
                {nextThumbnail ? (
                  <Image
                    source={nextThumbnail}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                ) : (
                  <Icon
                    name={MEDIA_ICON[nextEntry.reminder.mediaKind] ?? 'reminders'}
                    size="lg"
                    color={theme.color.onPrimaryContainer}
                  />
                )}
              </Stack>
              <Stack style={styles.flexFill} gap={2}>
                <Text variant="titleLarge">{nextEntry.reminder.label}</Text>
                <Text variant="bodyMedium" tone="variant">
                  {nextContextLabel}
                </Text>
              </Stack>
            </Stack>
            <Stack direction="row" gap="xs" justify="flex-end" paddingVertical="xs">
              <IconButton
                name="play"
                label={t('today.playPreview')}
                disabled={!nextCanPlay}
                onPress={() => setPreviewReminder(nextEntry.reminder)}
              />
              <IconButton
                name="edit"
                label={t('today.edit')}
                onPress={() =>
                  navigation.navigate(rootRoutes.reminderEditor, {
                    reminderId: nextEntry.reminder.id,
                  })
                }
              />
              <IconButton
                name="more"
                label={t('today.more')}
                onPress={() =>
                  navigation.navigate(rootRoutes.reminderDetail, {
                    reminderId: nextEntry.reminder.id,
                  })
                }
              />
            </Stack>
          </Card>
        </Stack>
      ) : importMedia.isImporting ? (
        <ProgressBar
          testID={testIds.today.emptyState}
          progress={importProgressFraction(importMedia.progress)}
          label={t(importPhaseLabelKey(importMedia.progress?.phase) ?? 'library.import.copying')}
        />
      ) : (
        <EmptyState
          testID={testIds.today.emptyState}
          icon="today"
          title={t('today.empty.title')}
          body={t('today.empty.body')}
          action={{label: t('today.empty.importMedia'), onPress: () => importMedia.importMedia()}}
        />
      )}
    </Stack>
  );

  return (
    <Screen
      edgeToEdge
      hasAppBar
      testID={testIds.today.screen}
      appBarSlot={
        <AppBar
          title={t('today.title')}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
          trailing={
            <StatusPill
              kind={statusKindFor(overallStatus)}
              label={t(statusLabelKeyFor(overallStatus))}
            />
          }
        />
      }>
      <VirtualizedList
        data={rows}
        keyExtractor={row => row.key}
        renderItem={renderRow}
        showSeparators={false}
        ListHeaderComponent={header}
        onScroll={appBar.onScroll}
        scrollEventThrottle={16}
      />
      {importMedia.error ? (
        <Dialog
          visible
          title={t(importErrorCopy(importMedia.error).titleKey)}
          body={t(
            importErrorCopy(importMedia.error).bodyKey,
            importErrorCopy(importMedia.error).bodyKey === 'library.import.errorInsufficientSpace'
              ? {megabytes: STORAGE_INSUFFICIENT_MIN_MB}
              : undefined,
          )}
          cancel={{label: t('action.close'), onPress: () => importMedia.reset()}}
        />
      ) : null}
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
