/**
 * MR-18 requires "component semantics" evidence with every UI change. This
 * pins the three states MR-04 makes binding for `Button`: the label survives
 * `disabled`, loading preserves the accessible label, and the press handler
 * fires exactly on tap.
 */
import {fireEvent, screen} from '@testing-library/react-native';

import {renderWithProviders} from '../../../testing';
import {Button} from '../Button';

describe('Button', () => {
  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<Button label="Save reminder" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', {name: 'Save reminder'}));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a readable label when disabled and exposes the disabled state', () => {
    renderWithProviders(
      <Button label="Save reminder" onPress={jest.fn()} disabled disabledReason="Fix the errors above" />,
    );

    const button = screen.getByRole('button', {name: 'Save reminder'});
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Save reminder')).toBeTruthy();
  });

  it('does not fire onPress while loading', () => {
    const onPress = jest.fn();
    renderWithProviders(<Button label="Save reminder" onPress={onPress} loading />);

    const button = screen.getByRole('button', {name: 'Save reminder'});
    expect(button.props.accessibilityState.busy).toBe(true);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
