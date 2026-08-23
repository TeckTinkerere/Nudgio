/**
 * Upcoming screen tests: heading copy and first-run empty CTA.
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

  it('offers Create reminder as the empty-state primary action', async () => {
    withProviders(<UpcomingScreen />);

    await waitFor(() => expect(screen.getByText('Create reminder')).toBeTruthy());
    expect(screen.queryByText('No alarms scheduled')).toBeNull();
  });
});
