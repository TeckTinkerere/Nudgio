import {fireEvent, screen} from '@testing-library/react-native';

import {renderWithProviders} from '../../../testing';
import {WeekdaySelector} from '../WeekdaySelector';

const options = [
  {isoWeekday: 1, label: 'Mon', accessibleLabel: 'Monday'},
  {isoWeekday: 2, label: 'Tue', accessibleLabel: 'Tuesday'},
];

describe('WeekdaySelector', () => {
  it('adds a day when toggled on and keeps the list sorted', () => {
    const onChange = jest.fn();
    renderWithProviders(<WeekdaySelector options={options} selected={[2]} onChange={onChange} />);

    fireEvent.press(screen.getByRole('checkbox', {name: 'Monday'}));
    expect(onChange).toHaveBeenCalledWith([1, 2]);
  });

  it('removes a day when toggled off', () => {
    const onChange = jest.fn();
    renderWithProviders(
      <WeekdaySelector options={options} selected={[1, 2]} onChange={onChange} />,
    );

    fireEvent.press(screen.getByRole('checkbox', {name: 'Tuesday'}));
    expect(onChange).toHaveBeenCalledWith([1]);
  });
});
