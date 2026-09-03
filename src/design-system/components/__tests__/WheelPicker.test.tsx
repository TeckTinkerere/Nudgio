import {fireEvent, screen} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {fireGestureHandler, getByGestureTestId} from 'react-native-gesture-handler/jest-utils';
import type {PanGesture} from 'react-native-gesture-handler';

import {renderWithProviders} from '../../../testing';
import {WheelPicker} from '../WheelPicker';

const hours = Array.from({length: 12}, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
}));

const renderWheel = (onChange: jest.Mock, extra: Record<string, unknown> = {}) =>
  renderWithProviders(
    <WheelPicker
      testID="hourWheel"
      options={hours}
      value={3}
      onChange={onChange}
      accessibilityLabel="Hour"
      {...extra}
    />,
  );

describe('WheelPicker', () => {
  it('is one adjustable control reporting the centred value', () => {
    renderWheel(jest.fn());

    const wheel = screen.getByLabelText('Hour');
    expect(wheel.props.accessibilityValue).toEqual({text: '3'});
    expect(wheel.props.accessibilityRole).toBe('adjustable');
  });

  it('selects the next and previous option from assistive-tech actions', () => {
    const onChange = jest.fn();
    renderWheel(onChange);
    const wheel = screen.getByLabelText('Hour');

    fireEvent(wheel, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}});
    expect(onChange).toHaveBeenLastCalledWith(4);

    fireEvent(wheel, 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}});
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('selects an off-centre item when it is tapped', () => {
    const onChange = jest.fn();
    renderWheel(onChange);

    // Items are hidden from assistive tech on purpose — the column as a
    // whole is the accessible control — so the text query has to opt in.
    fireEvent.press(screen.getByText('7', {includeHiddenElements: true}));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  // The regression this control exists for: the wheel it replaced was a
  // nested ScrollView whose vertical drag the parent scroll view always won,
  // so it could only ever be tapped.
  it('changes value by dragging, and yields the parent scroll view while it does', () => {
    const onChange = jest.fn();
    const onInteractionChange = jest.fn();
    renderWheel(onChange, {onInteractionChange});

    // Two rows' worth of upward drag moves two options later. Row height is
    // derived from the rendered column rather than hardcoded, because it
    // scales with the OS font scale (which the RN test environment reports
    // as 2, not 1).
    const style = StyleSheet.flatten(screen.getByLabelText('Hour').props.style) as {
      height: number;
    };
    const rowHeight = style.height / 5;

    fireGestureHandler<PanGesture>(getByGestureTestId('hourWheel.pan'), [
      {state: 2, translationY: 0, velocityY: 0},
      {state: 4, translationY: -rowHeight, velocityY: 0},
      {state: 4, translationY: -rowHeight * 2, velocityY: 0},
      {state: 5, translationY: -rowHeight * 2, velocityY: 0},
    ]);

    expect(onChange).toHaveBeenCalledWith(5);
    expect(onInteractionChange).toHaveBeenNthCalledWith(1, true);
    expect(onInteractionChange).toHaveBeenLastCalledWith(false);
  });
});
