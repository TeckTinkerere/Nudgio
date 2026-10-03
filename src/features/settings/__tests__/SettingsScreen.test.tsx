import {NavigationContainer} from '@react-navigation/native';
import {fireEvent, screen, waitFor} from '@testing-library/react-native';

import {ToastProvider} from '../../../app/toast/ToastProvider';
import {ok} from '../../../core/result/Result';
import {createTestContainer, renderWithProviders} from '../../../testing';
import {SettingsScreen} from '../SettingsScreen';

describe('alarm settings', () => {
  it('lets a user return to the device time format after choosing 24-hour time', async () => {
    const container = createTestContainer({preferences: {use24HourTime: true}});
    const update = jest.spyOn(container.repositories.settings, 'update');
    const view = renderWithProviders(
      <NavigationContainer><ToastProvider><SettingsScreen /></ToastProvider></NavigationContainer>,
      {container},
    );
    fireEvent.press(await screen.findByText('Device'));
    await waitFor(() => expect(update).toHaveBeenCalledWith({use24HourTime: null}));
    view.unmount();
    container.queryClient.clear();
    container.uninstallNativeModule();
  });

  it('does not announce or preview a ringtone when saving it fails', async () => {
    const container = createTestContainer();
    jest.spyOn(container.client, 'pickAlarmRingtone').mockResolvedValue(ok({uri: 'content://tone/1', title: 'Tone'}));
    jest.spyOn(container.repositories.settings, 'update').mockRejectedValue(new Error('storage unavailable'));
    const preview = jest.spyOn(container.client, 'previewAlarmRingtone');
    const view = renderWithProviders(
      <NavigationContainer><ToastProvider><SettingsScreen /></ToastProvider></NavigationContainer>,
      {container},
    );
    const row = await screen.findByRole('button', {name: /Alarm ringtone/});
    fireEvent.press(row);
    await waitFor(() => expect(screen.getByText('Could not save ringtone. Try again.')).toBeTruthy());
    expect(screen.queryByText('Ringtone updated.')).toBeNull();
    expect(preview).not.toHaveBeenCalled();
    view.unmount();
    container.queryClient.clear();
    container.uninstallNativeModule();
  });

  it('does not show a playing state when native preview needs action', async () => {
    const container = createTestContainer();
    jest.spyOn(container.client, 'previewAlarmRingtone').mockResolvedValue(ok({status: 'needs_action', affectedCount: 0}));
    const view = renderWithProviders(
      <NavigationContainer><ToastProvider><SettingsScreen /></ToastProvider></NavigationContainer>,
      {container},
    );
    fireEvent.press(await screen.findByLabelText('Play ringtone preview'));
    await waitFor(() => expect(screen.getByText('Could not play this tone. Choose another ringtone.')).toBeTruthy());
    expect(screen.queryByLabelText('Stop ringtone preview')).toBeNull();
    view.unmount();
    container.queryClient.clear();
    container.uninstallNativeModule();
  });
});
