import {fireEvent, screen} from '@testing-library/react-native';

import {renderWithProviders} from '../../../testing';
import {SegmentedControl} from '../SegmentedControl';

describe('SegmentedControl', () => {
  it('reports the selected option and calls onChange with the new value', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SegmentedControl
        accessibilityLabel="Repeat"
        options={[
          {value: 'once', label: 'Once'},
          {value: 'daily', label: 'Every day'},
        ]}
        value="once"
        onChange={onChange}
      />,
    );

    const onceOption = screen.getByRole('radio', {name: 'Once'});
    expect(onceOption.props.accessibilityState.selected).toBe(true);

    fireEvent.press(screen.getByRole('radio', {name: 'Every day'}));
    expect(onChange).toHaveBeenCalledWith('daily');
  });
});
