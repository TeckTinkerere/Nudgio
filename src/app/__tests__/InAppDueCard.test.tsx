import {act, screen} from '@testing-library/react-native';

import {InAppDueCard} from '../InAppDueCard';
import {useSessionStore, type InAppDueBanner} from '../../core/state/sessionStore';
import {renderWithProviders} from '../../testing';
import type {Instant, UUID} from '../../native-client/types';

const dueAt = new Date();
dueAt.setHours(17, 18, 0, 0);

const banner: InAppDueBanner = {
  sessionId: 'session-1' as UUID,
  nonce: 'nonce-1',
  occurrence: {
    id: 'occurrence-1' as UUID,
    reminderId: 'reminder-1' as UUID,
    kind: 'base',
    scheduledAt: dueAt.toISOString() as Instant,
    state: 'claimed',
  },
  reminderLabel: 'Take evening medication',
  mediaTitle: 'Dosage reminder video',
  defaultSnoozeMinutes: 10,
};

describe('InAppDueCard', () => {
  afterEach(() => {
    act(() => useSessionStore.getState().dismissDueBanner());
  });

  it('renders nothing until a reminder is due', () => {
    renderWithProviders(<InAppDueCard />);
    expect(screen.queryByTestId('in-app-due-card')).toBeNull();
  });

  it('shows the due status, the occurrence time and all three actions', () => {
    renderWithProviders(<InAppDueCard />);
    act(() => useSessionStore.getState().showDueBanner(banner));

    expect(screen.getByTestId('in-app-due-card')).toBeTruthy();
    expect(screen.getByText('Reminder due')).toBeTruthy();
    expect(screen.getByText('Take evening medication')).toBeTruthy();
    // Formatted through `formatLocalTime`, so it follows the 24-hour
    // preference rather than being hardcoded 12-hour here.
    expect(screen.getByText(/5:18|17:18/)).toBeTruthy();

    for (const action of ['Dismiss', 'Snooze', 'Accept']) {
      expect(screen.getByRole('button', {name: action})).toBeTruthy();
    }
  });

  it('collapses to a chip that still names the reminder and its time', () => {
    renderWithProviders(<InAppDueCard />);
    act(() => useSessionStore.getState().showDueBanner(banner));
    act(() => useSessionStore.getState().collapseDueBanner());

    expect(screen.queryByTestId('in-app-due-card')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Take evening medication, reminder due. Double tap to expand.',
      }),
    ).toBeTruthy();
    expect(screen.getByText(/5:18|17:18/)).toBeTruthy();
  });
});
