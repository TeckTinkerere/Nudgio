/**
 * Home — the one place reminders live.
 *
 * This replaces the separate "Upcoming" and "Reminders" tabs. Walking the
 * built app made the overlap impossible to defend: Upcoming was a 5-day
 * calendar projection that rendered "Nothing in the next few days" plus five
 * "No alarms scheduled" filler rows — six ways of saying nothing on the
 * landing screen — while the two reminders that actually existed sat one tab
 * away under Reminders. Two destinations, the same objects, and the one the
 * app opened on was the emptier of them.
 *
 * So the screen is a single answer to "what is coming back to me next?",
 * then "what else do I have?":
 *
 *   NEXT   the soonest reminder as media, large (`NextMomentCard`)
 *   ALL    every other reminder, soonest first, then unscheduled, paused and
 *          finished (`sortByStatus`)
 *
 * One row per *reminder*, never per occurrence. The first version of this
 * screen kept the old day-grouped occurrence projection under a "Later"
 * heading, and a single daily reminder promptly filled it with four identical
 * rows — "Tomorrow 6:15 Morning Motivation", "Sunday 6:15 Morning
 * Motivation", and so on. That is repetition, not information: "every day at
 * 6:15" is one fact, and each row already says when it next fires. So the
 * client-side recurrence projection is gone entirely, and every time shown
 * here now comes from the native scheduler's own `nextOccurrence` — the
 * authoritative value (MR-08) rather than a second, approximate copy of the
 * recurrence rules living in the UI.
 *
 * Still a flat `VirtualizedList` of discriminated `Row`s rather than mapped
 * JSX (MR-09: up to 10,000 reminders).
 */
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {ListRenderItem} from 'react-native';

import {statusKindFor, statusLabelKeyFor} from './capabilityStatus';
import {NextMomentCard} from './NextMomentCard';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {useSessionStore} from '../../core/state/sessionStore';
import {
  AppBar,
  Banner,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Stack,
  StatusPill,
  SwipeableRow,
  Text,
  useFloatingAppBar,
  VirtualizedList,
} from '../../design-system';
import {spacing} from '../../design-system/tokens';
import {useHaptics, usePreferences, useReminderList, useStartupSnapshot} from '../../hooks';
import {formatLocalTime, useTranslation} from '../../localization';
import type {ReminderSummary} from '../../native-client/types';
import {ReminderRow} from '../reminders/ReminderRow';
import {reminderStatus, relativeDayOf, sortByStatus} from '../reminders/reminderStatus';
import {useDeleteReminder} from '../reminders/useDeleteReminder';
import {useSetReminderEnabled} from '../reminders/useSetReminderEnabled';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Row =
  | {readonly type: 'heading'; readonly key: string; readonly label: string}
  | {readonly type: 'reminder'; readonly key: string; readonly reminder: ReminderSummary};

export function HomeScreen() {
  const t = useTranslation();
  const navigation = useNavigation<Navigation>();
  const startup = useStartupSnapshot();
  const reminders = useReminderList();
  const preferences = usePreferences();
  const setEnabled = useSetReminderEnabled();
  const deleteReminder = useDeleteReminder();
  const haptics = useHaptics();
  const [pendingDelete, setPendingDelete] = useState<ReminderSummary | null>(null);
  const appBar = useFloatingAppBar();
  const openMoment = useSessionStore(state => state.openMoment);

  // "Preview" shows exactly what will appear when this reminder fires — the
  // same moment screen Play opens (DL-080), not a bare media player.
  const previewMoment = useCallback(
    (reminder: ReminderSummary) => openMoment({reminderId: reminder.id, mediaId: reminder.mediaId}),
    [openMoment],
  );

  // Refreshed on focus, not on a timer (MR-13 "avoid unnecessary continuous
  // timers"): re-entering the screen after time has passed, including past
  // midnight, re-sorts and re-words every relative time.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );

  const languageTag = preferences.data?.languageTag ?? undefined;
  const use24Hour = preferences.data?.use24HourTime ?? null;
  const items = reminders.data?.items;

  const ordered = useMemo(() => (items ? sortByStatus(items, now) : []), [items, now]);

  // `sortByStatus` puts scheduled reminders first, soonest first, so the head
  // of the list is the next moment — but only when it is actually scheduled.
  const next = useMemo(() => {
    const head = ordered[0];
    if (!head) {
      return undefined;
    }
    const status = reminderStatus(head, now);
    return status.kind === 'next' ? {reminder: head, at: status.at} : undefined;
  }, [ordered, now]);

  const whenLabelFor = useCallback(
    (at: Date): string => {
      const time = formatLocalTime(at, use24Hour);
      switch (relativeDayOf(at, now)) {
        case 'today':
          return t('today.nextReminder.todayAt', {time});
        case 'tomorrow':
          return t('today.nextReminder.tomorrowAt', {time});
        case 'thisWeek':
          return t('today.nextReminder.weekdayAt', {
            weekday: new Intl.DateTimeFormat(languageTag, {weekday: 'long'}).format(at),
            time,
          });
        case 'later':
          return t('reminders.status.dateAt', {
            date: new Intl.DateTimeFormat(languageTag, {day: 'numeric', month: 'short'}).format(at),
            time,
          });
      }
    },
    [languageTag, now, t, use24Hour],
  );

  const rows = useMemo<readonly Row[]>(() => {
    const rest = ordered.filter(reminder => reminder.id !== next?.reminder.id);
    if (rest.length === 0) {
      return [];
    }
    return [
      {type: 'heading', key: 'h-all', label: t('home.section.all')},
      ...rest.map(reminder => ({type: 'reminder' as const, key: reminder.id, reminder})),
    ];
  }, [ordered, next, t]);

  const renderRow: ListRenderItem<Row> = useCallback(
    ({item}) => {
      if (item.type === 'heading') {
        return (
          <Text variant="labelLarge" tone="variant" style={styles.heading} isHeading>
            {item.label.toUpperCase()}
          </Text>
        );
      }
      return (
        <SwipeableRow
          actionLabel={t('reminders.list.deleteAction', {label: item.reminder.label})}
          actionIcon="delete"
          onAction={() => setPendingDelete(item.reminder)}>
          <View style={styles.reminderRow}>
            <ReminderRow
              reminder={item.reminder}
              now={now}
              use24Hour={use24Hour}
              onOpen={() => navigation.navigate(rootRoutes.reminderDetail, {reminderId: item.reminder.id})}
              onToggle={enabled => setEnabled.mutate({id: item.reminder.id, enabled})}
            />
          </View>
        </SwipeableRow>
      );
    },
    [navigation, now, setEnabled, t, use24Hour],
  );

  if (startup.isPending || reminders.isPending) {
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

  if (reminders.isError) {
    return (
      <ErrorState
        title={t('error.unexpected.title')}
        effect={t('error.unexpected.effect')}
        recoveryAction={{label: t('action.retry'), onPress: () => reminders.refetch()}}
        diagnosticCode={reminders.error.correlationId}
      />
    );
  }

  const overallStatus = startup.data.capability.overall;
  const hasAnyReminder = ordered.length > 0;
  const missingMediaCount = ordered.filter(item => item.mediaMissing).length;

  const header = (
    <Stack gap="md" paddingVertical="sm">
      {/* The floating `AppBar` sits outside the scroll region; this reserves its height. */}
      <View style={{height: appBar.barHeight}} />

      {/* MR-03: one high-salience card, only for a condition that affects
          active reminders, and it never blocks browsing. */}
      {overallStatus === 'needs_action' && hasAnyReminder ? (
        <Banner
          testID={testIds.today.capabilityBanner}
          kind="actionNeeded"
          title={t('today.capability.exactTimingOff.title')}
          effect={t('today.capability.exactTimingOff.effect')}
          action={{label: t('today.capability.openHealth'), onPress: () => navigation.navigate(rootRoutes.health)}}
        />
      ) : null}

      {next ? (
        <Stack gap="xs">
          <Text variant="labelLarge" tone="variant" isHeading>
            {t('home.section.next').toUpperCase()}
          </Text>
          <NextMomentCard
            testID={testIds.today.nextReminderCard}
            reminder={next.reminder}
            whenLabel={whenLabelFor(next.at)}
            onOpen={() => navigation.navigate(rootRoutes.reminderDetail, {reminderId: next.reminder.id})}
            onPreview={() => previewMoment(next.reminder)}
          />
        </Stack>
      ) : hasAnyReminder ? (
        // Reminders exist but none of them is scheduled — say so once,
        // quietly, and let the list below carry the screen. The old screen
        // said it six times and offered a second Create button that merely
        // duplicated the FAB.
        // "Turn one back on" is the wrong advice when the reason nothing is
        // scheduled is that the media is gone — re-enabling cannot work, and
        // the next integrity sweep would disable it again. Name the real
        // cause and point at the fix instead.
        <Card padding="md">
          <Stack gap="xxs">
            <Text variant="titleMedium">
              {t(missingMediaCount > 0 ? 'home.empty.mediaMissingTitle' : 'home.empty.noneScheduledTitle')}
            </Text>
            <Text variant="bodyMedium" tone="variant">
              {missingMediaCount > 0
                ? t('home.empty.mediaMissingBody', {count: missingMediaCount})
                : t('home.empty.noneScheduledBody')}
            </Text>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );

  return (
    <Screen
      edgeToEdge
      hasAppBar
      testID={testIds.today.screen}
      appBarSlot={
        <AppBar
          title={t('home.title')}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
          trailing={
            overallStatus === 'ok' ? undefined : (
              <StatusPill kind={statusKindFor(overallStatus)} label={t(statusLabelKeyFor(overallStatus))} />
            )
          }
        />
      }>
      {hasAnyReminder ? (
        <VirtualizedList
          testID={testIds.reminders.list}
          data={rows}
          keyExtractor={row => row.key}
          renderItem={renderRow}
          showSeparators={false}
          ListHeaderComponent={header}
          // The extended FAB floats over this list; without the reserve it
          // sits on top of the last row's title.
          ListFooterComponent={<View style={styles.fabReserve} />}
          onScroll={appBar.onScroll}
          scrollEventThrottle={16}
        />
      ) : (
        <View style={[styles.flexFill, {paddingTop: appBar.barHeight}]}>
          <EmptyState
            testID={testIds.today.emptyState}
            icon="today"
            title={t('today.empty.title')}
            body={t('today.empty.body')}
            action={{
              label: t('today.empty.createReminder'),
              onPress: () => navigation.navigate(rootRoutes.reminderEditor, {reminderId: undefined}),
            }}
          />
        </View>
      )}

      <Dialog
        visible={pendingDelete !== null}
        title={t('reminders.detail.deleteConfirmTitle')}
        body={t('reminders.detail.deleteConfirmBody')}
        destructive
        cancel={{label: t('action.cancel'), onPress: () => setPendingDelete(null)}}
        confirm={{
          label: t('action.delete'),
          onPress: () => {
            if (!pendingDelete) {
              return;
            }
            haptics.trigger('warning');
            const id = pendingDelete.id;
            setPendingDelete(null);
            deleteReminder.mutate(id);
          },
        }}
      />
    </Screen>
  );
}

/** Clears the extended FAB (56 dp) plus its offset above the tab bar. */
const FAB_RESERVE = 96;

const styles = StyleSheet.create({
  flexFill: {flex: 1},
  reminderRow: {marginBottom: spacing.xs},
  heading: {paddingTop: spacing.md, paddingBottom: spacing.xs},
  fabReserve: {height: FAB_RESERVE},
});
