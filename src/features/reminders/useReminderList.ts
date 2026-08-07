import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppQuery, type AppQueryResult} from '../../hooks/useAppQuery';
import type {Page, ReminderSummary} from '../../native-client/types';

export const useReminderList = (): AppQueryResult<Page<ReminderSummary>> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.reminders.list(),
    queryFn: () => unwrapResult(() => repositories.reminders.list()),
  });
};
