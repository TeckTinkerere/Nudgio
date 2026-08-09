import {useAppContainer} from '../../app/di';
import {queryKeys, unwrapResult} from '../../core/state';
import {useAppQuery, type AppQueryResult} from '../../hooks/useAppQuery';
import type {ReminderDetail, UUID} from '../../native-client/types';

/**
 * Real, Room-backed reminder detail (MR-08 `getReminder`). `ReminderEditorScreen`
 * previously read an existing reminder to edit via `findMockReminder`, which
 * only ever matched the fixture catalog's own ids — opening "Edit" on any
 * real, saved reminder silently found nothing and the form fell back to
 * blank/default values instead of the reminder's actual data
 * (docs/decision-log.md). `id` is optional because the same screen also
 * creates new reminders, where there is nothing to fetch yet.
 */
export const useReminderDetail = (id: UUID | undefined): AppQueryResult<ReminderDetail> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.reminders.detail(id ?? ('new' as UUID)),
    queryFn: () => unwrapResult(() => repositories.reminders.get(id as UUID)),
    enabled: id !== undefined,
  });
};
