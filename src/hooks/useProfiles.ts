import {useAppQuery, type AppQueryResult} from './useAppQuery';
import {useAppContainer} from '../app/di';
import {queryKeys, unwrapResult} from '../core/state';
import type {ReminderProfile} from '../native-client/types';

/**
 * Real, Room-seeded alert profiles (MR-08 `listProfiles`) — Settings, the
 * reminder editor's "Alert style" section and Reminder Detail all read the
 * hardcoded `mockProfiles` fixture directly instead, which happens to work
 * today only because its ids were copied from the native seed by hand.
 * `profileId` carries a real FK to `reminder_profiles` (`ReminderEntity`'s
 * doc) — a future native-side profile change (MR-03 "user-defined reminder
 * profiles") would silently desync the fixture from what Room actually has.
 */
export const useProfiles = (): AppQueryResult<readonly ReminderProfile[]> => {
  const {repositories} = useAppContainer();

  return useAppQuery({
    queryKey: queryKeys.profiles.all(),
    queryFn: () => unwrapResult(() => repositories.profiles.list()),
  });
};
