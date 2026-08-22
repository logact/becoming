import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ScheduleEditor } from '../ScheduleEditor';

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactForMock = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactForMock.createElement('NativeDateTimePicker', props),
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

function dateEvent() {
  return { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } };
}

describe('ScheduleEditor', () => {
  it('shows initial values, replaces both dates, and applies reciprocal same-day bounds', async () => {
    const onSave = jest.fn(async () => undefined);
    const initialStart = new Date(2026, 7, 20);
    const initialDue = new Date(2026, 7, 22);
    render(
      <ScheduleEditor
        entityLabel="Goal"
        initialStartAt={initialStart}
        initialDue={initialDue}
        onCancel={jest.fn()}
        onSave={onSave}
        testID="schedule"
      />,
    );

    expect(screen.getByTestId('schedule-start-value').props.children).not.toBe('Select date');
    expect(screen.getByTestId('schedule-due-value').props.children).not.toBe('Select date');
    fireEvent.press(screen.getByTestId('schedule-start-open'));
    expect(screen.getByTestId('schedule-start-native').props.maximumDate).toEqual(initialDue);
    fireEvent(screen.getByTestId('schedule-start-native'), 'change', dateEvent(), new Date(2026, 7, 21, 18));
    fireEvent.press(screen.getByTestId('schedule-start-done'));

    fireEvent.press(screen.getByTestId('schedule-due-open'));
    expect(screen.getByTestId('schedule-due-native').props.minimumDate).toEqual(new Date(2026, 7, 21));
    fireEvent(screen.getByTestId('schedule-due-native'), 'change', dateEvent(), new Date(2026, 7, 21, 7));
    fireEvent.press(screen.getByTestId('schedule-due-done'));
    fireEvent.press(screen.getByTestId('schedule-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      new Date(2026, 7, 21),
      new Date(2026, 7, 21),
    ));
  });

  it.each([
    ['Start', 'schedule-start-clear', undefined, new Date(2026, 7, 22)],
    ['Due', 'schedule-due-clear', new Date(2026, 7, 20), undefined],
  ] as const)('clears %s while preserving the other valid date', async (_label, clearId, expectedStart, expectedDue) => {
    const onSave = jest.fn(async () => undefined);
    render(
      <ScheduleEditor
        entityLabel="Task"
        initialStartAt={new Date(2026, 7, 20)}
        initialDue={new Date(2026, 7, 22)}
        onCancel={jest.fn()}
        onSave={onSave}
        testID="schedule"
      />,
    );
    fireEvent.press(screen.getByTestId(clearId));
    fireEvent.press(screen.getByTestId('schedule-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expectedStart, expectedDue));
  });

  it('cancels without saving', () => {
    const onCancel = jest.fn();
    const onSave = jest.fn();
    render(
      <ScheduleEditor entityLabel="Goal" onCancel={onCancel} onSave={onSave} testID="schedule" />,
    );
    fireEvent.press(screen.getByTestId('schedule-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('guards an invalid local-calendar range before calling the domain service', () => {
    const onSave = jest.fn();
    render(
      <ScheduleEditor
        entityLabel="Goal"
        initialStartAt={new Date(2026, 7, 23, 1)}
        initialDue={new Date(2026, 7, 22, 23)}
        onCancel={jest.fn()}
        onSave={onSave}
        testID="schedule"
      />,
    );
    fireEvent.press(screen.getByTestId('schedule-save'));
    expect(screen.getByText('Start date must be on or before the due date.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('preserves selected values on a domain/service error and blocks duplicate writes', async () => {
    let rejectWrite!: (cause: Error) => void;
    const pending = new Promise<void>((_resolve, reject) => { rejectWrite = reject; });
    const onSave = jest.fn(() => pending);
    render(
      <ScheduleEditor
        entityLabel="Task"
        initialStartAt={new Date(2026, 7, 20)}
        initialDue={new Date(2026, 7, 22)}
        onCancel={jest.fn()}
        onSave={onSave}
        testID="schedule"
      />,
    );
    fireEvent.press(screen.getByTestId('schedule-save'));
    fireEvent.press(screen.getByTestId('schedule-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    rejectWrite(new Error('Start date must be on or before the due date.'));

    expect(await screen.findByText('Start date must be on or before the due date.')).toBeTruthy();
    expect(screen.getByTestId('schedule-start-value').props.children).not.toBe('Select date');
    expect(screen.getByTestId('schedule-due-value').props.children).not.toBe('Select date');
  });
});
