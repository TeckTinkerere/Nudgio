/**
 * The moment (DL-080): Play must land on the reminder's own words and its
 * follow-up action, not a bare media viewer — and a reminder whose media is
 * gone must still show both.
 */
import {act, fireEvent, screen, waitFor} from '@testing-library/react-native';
import {Linking} from 'react-native';

import {ToastProvider} from '../../../app/toast/ToastProvider';
import {createAppError} from '../../../core/errors';
import {err, ok} from '../../../core/result/Result';
import {useSessionStore} from '../../../core/state/sessionStore';
import type {
  ByteCount,
  Instant,
  LocalTime,
  MediaDetail,
  MediaSourceToken,
  ReminderDetail,
  UUID,
} from '../../../native-client/types';
import {createTestContainer, renderWithProviders} from '../../../testing';
import {ReminderMoment} from '../ReminderMoment';

const reminder: ReminderDetail = {
  id: 'reminder-1' as UUID,
  label: 'Learn Japanese',
  mediaId: 'media-1' as UUID,
  mediaKind: 'image',
  profileId: 'profile' as UUID,
  enabledIntent: true,
  effectiveState: 'active',
  nextOccurrence: null,
  repeatSummary: 'Every day at 8:00 PM',
  schedule: {type: 'daily', localTime: '20:00:00' as LocalTime, zonePolicy: 'follow_device'},
  action: {type: 'open_link', uri: 'https://www.youtube.com/watch?v=abc', label: 'Start lesson'},
  notes: "Start tonight's lesson.",
  snooze: {defaultMinutes: 10, allowCustom: true, minimumMinutes: 1, maximumMinutes: 60},
  historyEnabled: true,
  createdAt: '2026-10-01T00:00:00Z' as Instant,
  updatedAt: '2026-10-01T00:00:00Z' as Instant,
  entityVersion: 1,
};

const media: MediaDetail = {
  id: 'media-1' as UUID,
  kind: 'image',
  title: 'IMG_2041',
  sizeBytes: '1000' as ByteCount,
  sourceToken: 'nudgio-media://source/media-1' as MediaSourceToken,
  tags: [],
  activeReminderCount: 1,
  integrity: 'healthy',
  createdAt: '2026-10-01T00:00:00Z' as Instant,
  mimeType: 'image/jpeg',
  updatedAt: '2026-10-01T00:00:00Z' as Instant,
  entityVersion: 1,
};

const renderMoment = (container = createTestContainer()) => {
  const view = renderWithProviders(
    <ToastProvider>
      <ReminderMoment />
    </ToastProvider>,
    {container},
  );
  return {container, view};
};

afterEach(() => {
  act(() => useSessionStore.getState().closeMoment());
  jest.restoreAllMocks();
});

describe('ReminderMoment', () => {
  it('renders nothing until a reminder is opened', () => {
    const {container, view} = renderMoment();
    expect(screen.queryByTestId('reminder-moment')).toBeNull();
    view.unmount();
    container.uninstallNativeModule();
  });

  it('shows the title, message and action, and the action opens the link and closes', async () => {
    const container = createTestContainer();
    jest.spyOn(container.repositories.reminders, 'get').mockResolvedValue(ok(reminder));
    jest.spyOn(container.repositories.media, 'get').mockResolvedValue(ok(media));
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const {view} = renderMoment(container);

    act(() => useSessionStore.getState().openMoment({reminderId: reminder.id, mediaId: null}));

    expect(await screen.findByText('Learn Japanese')).toBeTruthy();
    expect(screen.getByText("Start tonight's lesson.")).toBeTruthy();
    expect(screen.getByText('Every day at 8:00 PM')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', {name: 'Start lesson'}));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc'));
    await waitFor(() => expect(useSessionStore.getState().moment).toBeNull());

    view.unmount();
    container.queryClient.clear();
    container.uninstallNativeModule();
  });

  it('still shows the words and Done when the media is gone', async () => {
    const container = createTestContainer();
    jest.spyOn(container.repositories.reminders, 'get').mockResolvedValue(ok({...reminder, action: null}));
    jest.spyOn(container.repositories.media, 'get').mockResolvedValue(
      err(createAppError({code: 'MR_NOT_FOUND', messageKey: 'error.unexpected', category: 'validation', correlationId: 'c' as never, retryable: false})),
    );
    const {view} = renderMoment(container);

    act(() => useSessionStore.getState().openMoment({reminderId: reminder.id, mediaId: null}));

    expect(await screen.findByText("This media isn't available anymore")).toBeTruthy();
    expect(screen.getByText('Learn Japanese')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name: 'Done'}));
    expect(useSessionStore.getState().moment).toBeNull();

    view.unmount();
    container.queryClient.clear();
    container.uninstallNativeModule();
  });
});
