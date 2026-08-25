import {useAppQuery, type AppQueryResult} from './useAppQuery';
import {useAppContainer} from '../app/di';
import {queryKeys, unwrapResult} from '../core/state';
import type {StatisticsSummary} from '../native-client/types';

/** Days covered by the Statistics screen. Kept here so the key and the query cannot disagree. */
export const STATISTICS_RANGE_DAYS = 7;

/**
 * Real occurrence history (MR-04 "Charts and history"). Not cached for long:
 * resolving an alarm changes these numbers, and the screen is usually opened
 * right after doing exactly that.
 */
export const useStatistics = (
  rangeDays: number = STATISTICS_RANGE_DAYS,
): AppQueryResult<StatisticsSummary> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.statistics(rangeDays),
    queryFn: () => unwrapResult(() => repositories.capability.getStatistics(rangeDays)),
    staleTime: 5_000,
  });
};
