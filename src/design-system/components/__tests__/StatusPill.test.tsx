/**
 * MR-13 ACC-004: "Color is never the sole indicator." This asserts the
 * structural guarantee — every rendered pill carries a text node with the
 * label, not merely a colored dot — for each status kind.
 */
import {screen} from '@testing-library/react-native';

import {renderWithProviders} from '../../../testing';
import {StatusPill} from '../StatusPill';

describe('StatusPill', () => {
  it.each(['ready', 'limited', 'actionNeeded', 'neutral'] as const)(
    'renders the label as visible text for kind=%s',
    kind => {
      renderWithProviders(<StatusPill kind={kind} label="Exact timing" />);
      expect(screen.getByText('Exact timing')).toBeTruthy();
    },
  );

  it('exposes the label to assistive technology as one node', () => {
    renderWithProviders(<StatusPill kind="actionNeeded" label="Action needed" />);
    expect(screen.getByLabelText('Action needed')).toBeTruthy();
  });
});
