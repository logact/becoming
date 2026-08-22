import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { DatePickerRow } from '../DatePickerRow';

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactForMock = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactForMock.createElement('NativeDateTimePicker', props),
    DateTimePickerAndroid: {
      open: jest.fn(),
      dismiss: jest.fn(),
    },
  };
});

const nativeOpen = DateTimePickerAndroid.open as jest.Mock;

function event(type: 'set' | 'dismissed' | 'neutralButtonPressed' = 'set') {
  return { type, nativeEvent: { timestamp: 0, utcOffset: 0 } };
}

function setPlatform(os: 'ios' | 'android'): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

describe('DatePickerRow', () => {
  beforeEach(() => {
    setPlatform('ios');
    nativeOpen.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('displays a controlled value in the requested locale and exposes stable semantics', () => {
    render(
      <DatePickerRow
        testID="due"
        label="Due"
        value={new Date(2026, 7, 22)}
        locale="en-US"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('due-value').props.children).toBe('Aug 22, 2026');
    expect(screen.getByTestId('due-open').props.accessibilityLabel).toBe('Due, Aug 22, 2026');
    expect(screen.getByTestId('due-clear').props.accessibilityLabel).toBe('Clear Due');
  });

  it('opens an empty optional date at local today without committing', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 22, 15, 45));
    const onChange = jest.fn();
    render(<DatePickerRow testID="start" label="Start" onChange={onChange} />);

    expect(screen.getByTestId('start-value').props.children).toBe('Select date');
    expect(screen.queryByTestId('start-clear')).toBeNull();
    fireEvent.press(screen.getByTestId('start-open'));

    const picker = screen.getByTestId('start-native');
    expect(picker.props.mode).toBe('date');
    expect(picker.props.value).toEqual(new Date(2026, 7, 22));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('start-cancel'));
    expect(screen.queryByTestId('start-native')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps iOS edits as a draft, makes Cancel lossless, and commits local date on Done', () => {
    const original = new Date(2026, 7, 10);
    const selected = new Date(2026, 8, 6, 17, 40);
    const onChange = jest.fn();
    render(
      <DatePickerRow testID="due" label="Due" value={original} onChange={onChange} />,
    );

    fireEvent.press(screen.getByTestId('due-open'));
    fireEvent(screen.getByTestId('due-native'), 'change', event(), selected);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('due-cancel'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('due-open'));
    expect(screen.getByTestId('due-native').props.value).toEqual(original);
    fireEvent(screen.getByTestId('due-native'), 'change', event(), selected);
    fireEvent.press(screen.getByTestId('due-done'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(new Date(2026, 8, 6));
  });

  it('preserves local date, hour, and minute for an iOS datetime', () => {
    const onChange = jest.fn();
    render(
      <DatePickerRow
        testID="span-start"
        label="Starts"
        mode="datetime"
        value={new Date(2026, 7, 10, 8, 15)}
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByTestId('span-start-open'));
    expect(screen.getByTestId('span-start-native').props.mode).toBe('datetime');
    fireEvent(
      screen.getByTestId('span-start-native'),
      'change',
      event(),
      new Date(2026, 8, 6, 7, 30, 59, 999),
    );
    fireEvent.press(screen.getByTestId('span-start-done'));

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 8, 6, 7, 30));
  });

  it('forwards bounds to iOS and prevents Clear on required fields', () => {
    const minimumDate = new Date(2026, 7, 1);
    const maximumDate = new Date(2026, 7, 31);
    render(
      <DatePickerRow
        testID="milestone"
        label="Milestone date"
        value={new Date(2026, 7, 22)}
        required
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('milestone-clear')).toBeNull();
    expect(screen.getByText('Milestone date *')).toBeTruthy();
    fireEvent.press(screen.getByTestId('milestone-open'));
    const picker = screen.getByTestId('milestone-native');
    expect(picker.props.minimumDate).toBe(minimumDate);
    expect(picker.props.maximumDate).toBe(maximumDate);
  });

  it('clears an optional value only through the explicit action', () => {
    const onChange = jest.fn();
    render(
      <DatePickerRow
        testID="due"
        label="Due"
        value={new Date(2026, 7, 22)}
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByTestId('due-clear'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('uses one Android date dialog and commits a normalized local date only on set', () => {
    setPlatform('android');
    const minimumDate = new Date(2026, 7, 1);
    const maximumDate = new Date(2026, 7, 31);
    const onChange = jest.fn();
    render(
      <DatePickerRow
        testID="due"
        label="Due"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByTestId('due-open'));
    expect(nativeOpen).toHaveBeenCalledTimes(1);
    const options = nativeOpen.mock.calls[0][0];
    expect(options.mode).toBe('date');
    expect(options.testID).toBe('due-native-date');
    expect(options.minimumDate).toBe(minimumDate);
    expect(options.maximumDate).toBe(maximumDate);

    options.onChange(event('dismissed'), new Date(2026, 7, 14, 20));
    expect(onChange).not.toHaveBeenCalled();
    options.onChange(event(), new Date(2026, 7, 14, 20));
    expect(onChange).toHaveBeenCalledWith(new Date(2026, 7, 14));
  });

  it('keeps Android datetime selection atomic across date and time dialogs', () => {
    setPlatform('android');
    const onChange = jest.fn();
    render(
      <DatePickerRow
        testID="span-end"
        label="Ends"
        mode="datetime"
        value={new Date(2026, 7, 10, 8, 15)}
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByTestId('span-end-open'));
    const dateOptions = nativeOpen.mock.calls[0][0];
    dateOptions.onChange(event(), new Date(2026, 8, 6, 18, 50));

    expect(onChange).not.toHaveBeenCalled();
    expect(nativeOpen).toHaveBeenCalledTimes(2);
    const timeOptions = nativeOpen.mock.calls[1][0];
    expect(timeOptions.mode).toBe('time');
    expect(timeOptions.testID).toBe('span-end-native-time');
    expect(timeOptions.value).toEqual(new Date(2026, 8, 6, 8, 15));

    timeOptions.onChange(event('dismissed'), new Date(2026, 8, 6, 7, 30));
    expect(onChange).not.toHaveBeenCalled();
    timeOptions.onChange(event(), new Date(2026, 7, 10, 7, 30, 54));
    expect(onChange).toHaveBeenCalledWith(new Date(2026, 8, 6, 7, 30));
  });

  it('does not open a picker or clear when disabled', () => {
    setPlatform('android');
    const onChange = jest.fn();
    render(
      <DatePickerRow
        testID="due"
        label="Due"
        value={new Date(2026, 7, 22)}
        disabled
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByTestId('due-open'));
    fireEvent.press(screen.getByTestId('due-clear'));
    expect(nativeOpen).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

// Keep this import referenced so the mock boundary is typechecked as the
// component API consumed by DatePickerRow, rather than mocking wrapper logic.
void DateTimePicker;
