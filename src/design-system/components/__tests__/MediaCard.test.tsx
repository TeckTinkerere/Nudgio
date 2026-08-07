import {fireEvent, screen} from '@testing-library/react-native';

import {renderWithProviders} from '../../../testing';
import {MediaCard} from '../MediaCard';

describe('MediaCard', () => {
  it('composes the MR-13 TalkBack pattern from caller-supplied localized parts', () => {
    renderWithProviders(
      <MediaCard
        title="Morning remembrance"
        kind="video"
        kindLabel="Video"
        durationAccessibleLabel="1 minute 33 seconds"
        activeReminderCount={2}
        activeReminderCountLabel="2 active reminders"
        onPress={jest.fn()}
      />,
    );

    expect(
      screen.getByLabelText(
        'Video. Morning remembrance. 1 minute 33 seconds. 2 active reminders',
      ),
    ).toBeTruthy();
  });

  it('shows the missing-media fallback instead of a blank tile', () => {
    renderWithProviders(
      <MediaCard
        title="Water bottle reminder card"
        kind="image"
        kindLabel="Image"
        isMissing
        missingLabel="Missing"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0);
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(
      <MediaCard title="Stretch break checklist" kind="text" kindLabel="Text" onPress={onPress} />,
    );

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
