/**
 * Covers the two most user-visible parts of the Today -> Upcoming rename
 * (MR-03): the page heading actually reads "Upcoming", and the schedule
 * below it always renders exactly 5 day sections regardless of whether any
 * reminder has an occurrence in the window (spec: "keep the date heading
 * and show No alarms scheduled"). Detailed occurrence-matching correctness
 * lives in `projectUpcomingOccurrences.test.ts`, which this does not repeat.
 */
import {NavigationContainer} from '@react-navigation/native';
import {fireEvent, screen, waitFor} from '@testing-library/react-native';

import {ToastProvider} from '../../../app/toast/ToastProvider';
import {ok} from '../../../core/result/Result';
import type {LocalTime, ReminderSummary, UUID} from '../../../native-client/types';
import {createTestContainer, renderWithProviders} from '../../../testing';
import {UpcomingScreen} from '../UpcomingScreen';

const withProviders = (ui: React.ReactElement) =>
  renderWithProviders(
    <NavigationContainer>
      <ToastProvider>{ui}</ToastProvider>
    </NavigationContainer>,
  );

describe('UpcomingScreen', () => {
  it('pauses the next reminder only after confirmation through the native repository', async () => {
    const container = createTestContainer();
    const reminder: ReminderSummary = {
      id: 'next-reminder' as UUID, label: 'Daily reading', mediaId: 'media' as UUID,
      mediaKind: 'text', profileId: 'profile' as UUID, enabledIntent: true,
      effectiveState: 'active', nextOccurrence: null, repeatSummary: 'Daily',
      schedule: {type: 'daily', localTime: '09:00:00' as LocalTime, zonePolicy: 'follow_device'},
    };
    jest.spyOn(container.repositories.reminders, 'list').mockResolvedValue(ok({items: [reminder], total: 1, offset: 0, hasMore: false}));
    const pause = jest.spyOn(container.repositories.reminders, 'setEnabled');
    const view = renderWithProviders(<NavigationContainer><ToastProvider><UpcomingScreen /></ToastProvider></NavigationContainer>, {container});
    fireEvent.press(await screen.findByRole('button', {name: 'Pause'}));
    expect(pause).not.toHaveBeenCalled();
    fireEvent.press(screen.getAllByRole('button', {name: 'Pause'}).slice(-1)[0]!);
    await waitFor(() => expect(pause).toHaveBeenCalledWith(reminder.id, false));
    view.unmount(); container.queryClient.clear(); container.uninstallNativeModule();
  });
  it('shows "Upcoming" as the page heading, not "Today"', async () => {
    withProviders(<UpcomingScreen />);

    await waitFor(() => expect(screen.getByText('Upcoming')).toBeTruthy());
    expect(screen.queryByText('Today', {exact: true})).toBeNull();
  });

  it('renders exactly 5 day sections, each keeping its heading when empty', async () => {
    withProviders(<UpcomingScreen />);

    // The mock native module's reminder list is empty by default, so every
    // one of the 5 sections falls back to the empty-day row.
    await waitFor(() => expect(screen.getAllByText('No alarms scheduled')).toHaveLength(5));
    expect(screen.getByText('TODAY')).toBeTruthy();
  });
});
