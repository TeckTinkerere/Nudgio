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

import type {RootStackParamList} from '../../app/navigation/types';
import {AppBar, Card, EmptyState, Screen, Stack, StatTile, Text} from '../../design-system';
import {useTranslation} from '../../localization';
import {mockStatistics} from '../../mocks/fixtures';

type Props = NativeStackScreenProps<RootStackParamList, 'Statistics'>;

export function StatisticsScreen({navigation}: Props) {
  const t = useTranslation();
  const stats = mockStatistics;

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={t('statistics.title')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      {stats.totalOccurrences === 0 ? (
        <EmptyState
          icon="today"
          title={t('statistics.empty.title')}
          body={t('statistics.empty.body')}
        />
      ) : (
        <Stack gap="lg" paddingVertical="md">
          <Text variant="labelLarge" tone="variant">
            {stats.rangeLabel}
          </Text>

          <Stack direction="row" gap="xs" wrap>
            <StatTile value={stats.completed} label={t('statistics.completed')} tone="positive" />
            <StatTile value={stats.dismissed} label={t('statistics.dismissed')} />
            <StatTile value={stats.missed} label={t('statistics.missed')} />
            <StatTile value={stats.snoozed} label={t('statistics.snoozed')} />
          </Stack>

          <Card>
            <Stack direction="row" justify="space-between" align="center">
              <Text variant="bodyLarge" tone="variant">
                {t('statistics.mostActive')}
              </Text>
              <Text variant="titleMedium">{stats.mostActiveReminderLabel}</Text>
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
                <Stack direction="row" align="center" justify="space-between">
                  <Text variant="titleMedium">{day.date}</Text>
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
              </Card>
            ))}
          </Stack>
        </Stack>
      )}
    </Screen>
  );
}
