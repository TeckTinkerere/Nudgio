/**
 * Reminders screen (MR-03 "Reminders" destination).
 *
 * Lists reminders with enable state and next occurrence. `ListRow` already
 * implements the MR-13 "switch never nested in a clickable row" pattern this
 * screen needs; wiring the enable toggle to a mutation is deferred with
 * reminder logic. The list itself is virtualized (`VirtualizedList`) rather
 * than mapped, since MR-09 anticipates up to 10,000 reminders.
 */
import {useCallback} from 'react';

import {testIds} from '../../constants';
import {AppBar, EmptyState, ErrorState, ListRow, LoadingState, Screen, Toggle, VirtualizedList} from '../../design-system';
import {useReminderList} from '../../hooks';
import {useTranslation} from '../../localization';
import type {ReminderSummary} from '../../native-client/types';

export function RemindersScreen() {
  const t = useTranslation();
  const reminders = useReminderList();

  const renderReminder = useCallback(
    ({item}: {item: ReminderSummary}) => (
      <ListRow
        title={item.label}
        subtitle={item.repeatSummary}
        onPress={() => undefined}
        trailing={
          <Toggle value={item.enabledIntent} onValueChange={() => undefined} label={item.label} />
        }
      />
    ),
    [],
  );

  return (
    <Screen
      hasAppBar
      edgeToEdge={reminders.isSuccess && reminders.data.items.length > 0}
      testID={testIds.reminders.screen}>
      <AppBar title={t('reminders.title')} />

      {/* `isPending`, not `isLoading` — see TodayScreen for why. */}
      {reminders.isPending ? (
        <LoadingState label={t('loading.startingUp')} />
      ) : reminders.isError ? (
        <ErrorState
          title={t('error.unexpected.title')}
          effect={t('error.unexpected.effect')}
          recoveryAction={{label: t('action.retry'), onPress: () => reminders.refetch()}}
          diagnosticCode={reminders.error.correlationId}
        />
      ) : reminders.data.items.length === 0 ? (
        <EmptyState
          icon="reminders"
          title={t('today.empty.title')}
          body={t('today.empty.body')}
        />
      ) : (
        <VirtualizedList
          testID={testIds.reminders.list}
          data={reminders.data.items}
          keyExtractor={item => item.id}
          renderItem={renderReminder}
        />
      )}
    </Screen>
  );
}
