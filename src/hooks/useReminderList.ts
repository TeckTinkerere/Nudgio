import {useAppQuery, type AppQueryResult} from './useAppQuery';
import {useAppContainer} from '../app/di';
import {queryKeys, unwrapResult} from '../core/state';
import type {Page, ReminderSummary} from '../native-client/types';

/** Shared, not `features/reminders/`-local: `MediaDetailScreen`'s "attached reminders" also needs the full list, filtered client-side by `mediaId`. */
export const useReminderList = (): AppQueryResult<Page<ReminderSummary>> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.reminders.list(),
    queryFn: () => unwrapResult(() => repositories.reminders.list()),
  });
};
