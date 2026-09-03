import {fireEvent, screen} from '@testing-library/react-native';

import {renderWithProviders} from '../../../testing';
import {TimePicker, type TimeOfDayValue} from '../TimePicker';

const renderPicker = (
  value: TimeOfDayValue,
  onChange: jest.Mock,
  use24Hour = false,
) =>
  renderWithProviders(
    <TimePicker
      value={value}
      onChange={onChange}
      hourLabel="Hour"
      minuteLabel="Minute"
      amPmLabel="AM or PM"
      use24Hour={use24Hour}
    />,
  );

const increment = (label: string) => {
  fireEvent(screen.getByLabelText(label), 'accessibilityAction', {
    nativeEvent: {actionName: 'increment'},
  });
};

describe('TimePicker', () => {
  it('offers hour, minute and AM/PM columns in 12-hour mode', () => {
    const onChange = jest.fn();
    renderPicker({hour: 5, minute: 18, period: 'PM'}, onChange);

    expect(screen.getByLabelText('Hour').props.accessibilityValue).toEqual({text: '05'});
    expect(screen.getByLabelText('Minute').props.accessibilityValue).toEqual({text: '18'});
    expect(screen.getByLabelText('AM or PM').props.accessibilityValue).toEqual({text: 'PM'});
  });

  it('changes only the field that was adjusted', () => {
    const onChange = jest.fn();
    renderPicker({hour: 5, minute: 18, period: 'PM'}, onChange);

    increment('Minute');
    expect(onChange).toHaveBeenLastCalledWith({hour: 5, minute: 19, period: 'PM'});
  });

  it('drops the AM/PM column and counts hours 00-23 when 24-hour time is on', () => {
    const onChange = jest.fn();
    renderPicker({hour: 1, minute: 30, period: 'PM'}, onChange, true);

    expect(screen.queryByLabelText('AM or PM')).toBeNull();
    expect(screen.getByLabelText('Hour').props.accessibilityValue).toEqual({text: '13'});

    // 13:30 -> 14:30, still stored as the 12-hour pair the editor saves from.
    increment('Hour');
    expect(onChange).toHaveBeenLastCalledWith({hour: 2, minute: 30, period: 'PM'});
  });

  it('crosses midday correctly in 24-hour mode', () => {
    const onChange = jest.fn();
    renderPicker({hour: 11, minute: 0, period: 'AM'}, onChange, true);

    increment('Hour');
    expect(onChange).toHaveBeenLastCalledWith({hour: 12, minute: 0, period: 'PM'});
  });
});
