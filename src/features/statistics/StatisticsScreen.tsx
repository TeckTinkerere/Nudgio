/**
 * Statistics screen (MR-04 "Charts and history").
 *
 * "Local history uses simple counts and accessible summaries rather than
 * competitive streak visuals... A chart must have a textual equivalent."
 * There is no bar/line chart here at all — every number is a `StatTile` or a
 * plain accessible row, so the textual form isn't an alternative rendering
 * bolted onto a chart, it's the only rendering.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {StyleSheet, View} from 'react-native';

import type {RootStackParamList} from '../../app/navigation/types';
import {
  AppBar,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Stack,
  StatTile,
  Text,
  useFloatingAppBar,
  useTheme,
} from '../../design-system';
import {STATISTICS_RANGE_DAYS, usePreferences, useStatistics} from '../../hooks';
import {useTranslation} from '../../localization';
import type {DailyOutcomeCount} from '../../native-client/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Statistics'>;

/**
 * Proportional stacked bar, not a chart widget (MR-04 "Charts and history"
 * bans bar/line charts, not a decorative inline proportion strip) — three
 * flex segments sized by each count's share of the day's total. Colors are
 * neutral role tones, not `error`/`actionNeeded`: "missed" gets the same
 * even-handed treatment "Completed and dismissed are factual, not
 * celebratory or shaming" already requires of the numbers beside it.
 */
function DayProportionBar({day}: {readonly day: DailyOutcomeCount}) {
  const theme = useTheme();
  const total = day.completed + day.dismissed + day.missed;
  if (total === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    track: {
      flexDirection: 'row',
      height: 6,
      borderRadius: theme.radius.full,
      overflow: 'hidden',
      backgroundColor: theme.color.surfaceContainerHigh,
    },
    completed: {flex: day.completed, backgroundColor: theme.color.primary},
    dismissed: {flex: day.dismissed, backgroundColor: theme.color.secondary},
    missed: {flex: day.missed, backgroundColor: theme.color.outline},
  });

  return (
    <View style={styles.track}>
      <View style={styles.completed} />
      <View style={styles.dismissed} />
      <View style={styles.missed} />
    </View>
  );
}

/**
 * `yyyy-MM-dd` -> a short local weekday ("Mon"). The native side returns an
 * unambiguous ISO date rather than a pre-formatted label so the locale is
 * decided here, on the device, at render time. Parsed as local noon: parsing
 * a bare date string is UTC per spec, which shifts the weekday by a day for
 * anyone west of Greenwich.
 */
const weekdayLabel = (isoDate: string, languageTag: string | undefined): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  return new Intl.DateTimeFormat(languageTag, {weekday: 'short'}).format(
    new Date(year, month - 1, day, 12),
  );
};

export function StatisticsScreen({navigation}: Props) {
  const t = useTranslation();
  const appBar = useFloatingAppBar();
  const statistics = useStatistics();
  const stats = statistics.data;
  const preferences = usePreferences();
  const languageTag = preferences.data?.languageTag ?? undefined;

  return (
    <Screen
      hasAppBar
      scrollable
      onScroll={appBar.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{paddingTop: appBar.barHeight}}
      appBarSlot={
        <AppBar
          title={t('statistics.title')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
        />
      }>
      {statistics.isPending ? (
        <LoadingState label={t('loading.startingUp')} />
      ) : statistics.isError ? (
        <ErrorState
          title={t('error.unexpected.title')}
          effect={t('error.unexpected.effect')}
          recoveryAction={{label: t('action.retry'), onPress: () => statistics.refetch()}}
          diagnosticCode={statistics.error.correlationId}
        />
      ) : !stats || stats.totalOccurrences === 0 ? (
        <EmptyState
          icon="today"
          title={t('statistics.empty.title')}
          body={t('statistics.empty.body')}
        />
      ) : (
        <Stack gap="lg" paddingVertical="md">
          <Text variant="labelLarge" tone="variant">
            {t('statistics.rangeLabel', {days: STATISTICS_RANGE_DAYS})}
          </Text>

          <Stack direction="row" gap="xs" wrap>
            <StatTile
              value={stats.completed}
              label={t('statistics.completed')}
              tone="positive"
              icon="check"
            />
            <StatTile value={stats.dismissed} label={t('statistics.dismissed')} icon="close" />
            <StatTile value={stats.missed} label={t('statistics.missed')} icon="clock" />
            <StatTile value={stats.snoozed} label={t('statistics.snoozed')} icon="snooze" />
          </Stack>

          <Card>
            <Stack direction="row" justify="space-between" align="center">
              <Text variant="bodyLarge" tone="variant">
                {t('statistics.mostActive')}
              </Text>
              <Text variant="titleMedium">
                {stats.mostActiveReminderLabel ?? t('statistics.mostActive.none')}
              </Text>
            </Stack>
          </Card>

          <Stack gap="xs">
            <Text variant="titleLarge">{t('statistics.dailyBreakdown')}</Text>
            {stats.dailyBreakdown.map(day => (
              <Card
                key={day.date}
                accessibilityLabel={t('statistics.dayAccessible', {
                  date: day.date,
                  completed: day.completed,
                  dismissed: day.dismissed,
                  missed: day.missed,
                })}>
                <Stack gap="xs">
                  <Stack direction="row" align="center" justify="space-between">
                    <Text variant="titleMedium">{weekdayLabel(day.date, languageTag)}</Text>
                    <Stack direction="row" gap="sm">
                      <Text variant="bodyMedium" tone="variant" tabularNumbers>
                        {t('statistics.completed')}: {day.completed}
                      </Text>
                      <Text variant="bodyMedium" tone="variant" tabularNumbers>
                        {t('statistics.dismissed')}: {day.dismissed}
                      </Text>
                      <Text variant="bodyMedium" tone="variant" tabularNumbers>
                        {t('statistics.missed')}: {day.missed}
                      </Text>
                    </Stack>
                  </Stack>
                  <DayProportionBar day={day} />
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}
    </Screen>
  );
}
