/**
 * Statistics screen (MR-04 "Charts and history").
 *
 * History aggregation is not wired to Room yet. This surface stays empty
 * rather than rendering `mockStatistics` as if it were the user's activity.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import type {RootStackParamList} from '../../app/navigation/types';
import {AppBar, EmptyState, Screen} from '../../design-system';
import {useTranslation} from '../../localization';

type Props = NativeStackScreenProps<RootStackParamList, 'Statistics'>;

export function StatisticsScreen({navigation}: Props) {
  const t = useTranslation();

  return (
    <Screen hasAppBar>
      <AppBar
        title={t('statistics.title')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />
      <EmptyState
        icon="today"
        title={t('statistics.empty.title')}
        body={t('statistics.empty.body')}
      />
    </Screen>
  );
}
