import {useAppContainer} from '../../app/di';
import {unwrapResult} from '../../core/state';
import {useAppMutation} from '../../hooks';
import type {TestReminderRequest, TestReminderResult} from '../../native-client/types';

/** Settings "Preview alarm styles" — schedules a short-delay real alarm styled like the tapped profile. */
export const useScheduleTestReminder = () => {
  const {repositories} = useAppContainer();

  return useAppMutation<TestReminderResult, TestReminderRequest>({
    mutationFn: request => unwrapResult(() => repositories.reminders.scheduleTest(request)),
  });
};
