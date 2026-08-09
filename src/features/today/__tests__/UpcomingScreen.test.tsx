/**
 * Covers the two most user-visible parts of the Today -> Upcoming rename
 * (MR-03): the page heading actually reads "Upcoming", and the schedule
 * below it always renders exactly 5 day sections regardless of whether any
 * reminder has an occurrence in the window (spec: "keep the date heading
 * and show No alarms scheduled"). Detailed occurrence-matching correctness
 * lives in `projectUpcomingOccurrences.test.ts`, which this does not repeat.
 */
import {NavigationContainer} from '@react-navigation/native';
import {screen, waitFor} from '@testing-library/react-native';

import {ToastProvider} from '../../../app/toast/ToastProvider';
import {renderWithProviders} from '../../../testing';
import {UpcomingScreen} from '../UpcomingScreen';

const withProviders = (ui: React.ReactElement) =>
  renderWithProviders(
    <NavigationContainer>
      <ToastProvider>{ui}</ToastProvider>
    </NavigationContainer>,
  );

describe('UpcomingScreen', () => {
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
