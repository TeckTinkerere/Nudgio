/**
 * Today screen (MR-03 "Today screen").
 *
 * Normal-state layout matches the spec's structure: a status chip beside the
 * title, a single high-salience capability banner when it matters, the next
 * reminder as a full card with Play/Edit/More, then a chronological list of
 * today's occurrences with time/label/media icon/profile icon/state.
 *
 * The occurrence timeline has no MR-08 bridge query of its own (only
 * `nextOccurrence` comes through `StartupSnapshot`), so it renders from mock
 * fixtures — everything else on this screen is wired to the real query.
 *
 * The timeline renders through `VirtualizedList`, with everything above it
 * (title, capability banner, next-reminder card/empty-state) passed as
 * `ListHeaderComponent` — the same "never eagerly map an array into JSX"
 * rule `VirtualizedList`'s own doc comment states (MR-09 anticipates up to
 * 50,000 retained occurrences); a plain `.map()` inside a `ScrollView`,
 * which is what this screen did before, both defeats view recycling and
 * cannot be nested inside a real `FlatList` later without becoming exactly
 * this restructuring anyway (docs/decision-log.md).
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback} from 'react';
import {StyleSheet} from 'react-native';
import type {ListRenderItem} from 'react-native';

import {statusKindFor, statusLabelKeyFor} from './capabilityStatus';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
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
  VirtualizedList,
} from '../../design-system';
import type {IconName, StatusKind} from '../../design-system';
import {spacing} from '../../design-system/tokens';
import {
  importErrorCopy,
  importPhaseLabelKey,
  importProgressFraction,
  STORAGE_INSUFFICIENT_MIN_MB,
  useImportMedia,
  useStartupSnapshot,
} from '../../hooks';
import {useTranslation, type TranslationKey} from '../../localization';
import {findMockMedia, mockTodayOccurrences, type TodayEntry} from '../../mocks/fixtures';
import type {OccurrenceState, ReminderDetail} from '../../native-client/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const MEDIA_ICON: Record<string, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
};

interface RowState {
  readonly kind: StatusKind;
  readonly labelKey: TranslationKey;
}

const rowStateFor = (
  reminder: ReminderDetail,
  occurrenceState: OccurrenceState,
): RowState => {
  if (reminder.effectiveState === 'disabled') {
    return {kind: 'neutral', labelKey: 'today.occurrence.disabled'};
  }
  if (reminder.effectiveState === 'needs_setup') {
    return {kind: 'actionNeeded', labelKey: 'today.occurrence.needsSetup'};
  }
  switch (occurrenceState) {
    case 'pending':
    case 'claimed':
      return {kind: 'neutral', labelKey: 'today.occurrence.upcoming'};
    case 'accepted':
      return {kind: 'ready', labelKey: 'today.occurrence.completed'};
    case 'snoozed':
      return {kind: 'limited', labelKey: 'today.occurrence.snoozed'};
    case 'dismissed':
      return {kind: 'neutral', labelKey: 'today.occurrence.dismissed'};
    case 'missed':
    case 'timed_out':
    case 'failed_safe':
      return {kind: 'actionNeeded', labelKey: 'today.occurrence.missed'};
  }
};

export function TodayScreen() {
  const t = useTranslation();
  const navigation = useNavigation<Navigation>();
  const startup = useStartupSnapshot();
  const importMedia = useImportMedia();

  // Declared before any early return (Rules of Hooks): this callback does
  // not depend on `startup.data`, so it can be computed unconditionally
  // regardless of which branch below actually renders.
  const renderOccurrence: ListRenderItem<TodayEntry> = useCallback(
    ({item: entry}) => {
      const media = findMockMedia(entry.reminder.mediaId);
      const state = rowStateFor(entry.reminder, entry.occurrence.state);
      const time = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(entry.occurrence.scheduledAt));

      return (
        <Card
          style={styles.occurrenceCard}
          onPress={() =>
            navigation.navigate(rootRoutes.reminderDetail, {
              reminderId: entry.reminder.id,
            })
          }
          accessibilityLabel={`${time}. ${entry.reminder.label}. ${t(state.labelKey)}`}>
          <Stack direction="row" align="center" gap="sm">
            <Text variant="titleMedium" tabularNumbers>
              {time}
            </Text>
            <Icon name={media ? MEDIA_ICON[media.kind] ?? 'reminders' : 'reminders'} size="sm" />
            <Stack style={styles.flexFill} gap={2}>
              <Text variant="bodyLarge">{entry.reminder.label}</Text>
            </Stack>
            <StatusPill kind={state.kind} label={t(state.labelKey)} emphasis="low" />
          </Stack>
        </Card>
      );
    },
    [navigation, t],
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

  const nextEntry = mockTodayOccurrences.find(entry => entry.occurrence.state === 'pending');
  const nextMedia = nextEntry ? findMockMedia(nextEntry.reminder.mediaId) : undefined;

  const header = (
    <Stack gap="lg" paddingVertical="md">
      <Stack direction="row" align="center" justify="space-between">
        <Text variant="headlineMedium" isHeading>
          {t('today.title')}
        </Text>
        <StatusPill
          kind={statusKindFor(overallStatus)}
          label={t(statusLabelKeyFor(overallStatus))}
        />
      </Stack>

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

      {hasReminders && nextEntry ? (
        <Stack gap="xs">
          <Text variant="labelLarge" tone="variant">
            {t('today.nextReminder')}
          </Text>
          <Card testID={testIds.today.nextReminderCard}>
            <Stack direction="row" gap="sm" align="center">
              <Icon
                name={nextMedia ? MEDIA_ICON[nextMedia.kind] ?? 'reminders' : 'reminders'}
                size="lg"
              />
              <Stack style={styles.flexFill} gap={2}>
                <Text variant="titleLarge">{nextEntry.reminder.label}</Text>
                <Text variant="bodyMedium" tone="variant">
                  {nextEntry.reminder.repeatSummary}
                </Text>
              </Stack>
            </Stack>
            <Stack direction="row" gap="xs" justify="flex-end" paddingVertical="xs">
              <IconButton name="play" label={t('today.playPreview')} onPress={() => undefined} />
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
    <Screen edgeToEdge testID={testIds.today.screen}>
      <VirtualizedList
        data={hasReminders ? mockTodayOccurrences : []}
        keyExtractor={entry => entry.occurrence.id}
        renderItem={renderOccurrence}
        showSeparators={false}
        ListHeaderComponent={header}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
  occurrenceCard: {marginBottom: spacing.xxs},
});
