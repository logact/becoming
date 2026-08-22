import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import type { TaskDetailView } from '../../../../application/task/TaskDetailService';
import type { ScheduleTaskCommand } from '../../../../application/task/ScheduleTaskService';
import type { TaskStatus } from '../../../../domain/task/Task';
import { Task } from '../../../../domain/task/Task';
import { NavigationShell, type ShellDestination } from '../../../navigation/NavigationShell';
import { TaskDetailPage } from '../TaskDetailPage';

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactForMock = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactForMock.createElement('NativeDateTimePicker', props),
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

const now = new Date('2026-08-21T12:00:00Z');

function dateEvent() {
  return { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } };
}

function taskAt(status: TaskStatus): Task {
  const task = Task.create({
    id: 't1', title: 'Ship feature', description: 'Finish the workflow.',
    projectId: 'p1', goalId: 'g1', due: new Date('2026-08-25T00:00:00Z'), now,
  });
  if (status === 'doing') task.start(now);
  if (status === 'paused') { task.start(now); task.pause(now); }
  if (status === 'done') { task.start(now); task.complete(now); }
  if (status === 'failed') { task.start(now); task.fail(now); }
  return task;
}

function renderDetail(status: TaskStatus, overrides: Partial<TaskDetailView> = {}) {
  const view: TaskDetailView = {
    task: taskAt(status), projectName: 'Project', goalTitle: 'Goal', goalParentTitle: 'Parent',
    records: [{ id: 'r1', kind: 'taskStarted', detail: 'Started task', occurredAt: now }],
    ...overrides,
  };
  const detail = { getDetail: jest.fn(async () => view) };
  const lifecycle = {
    start: jest.fn(async () => undefined), pause: jest.fn(async () => undefined),
    resume: jest.fn(async () => undefined), complete: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined), reopen: jest.fn(async () => undefined),
  };
  const schedule = { schedule: jest.fn(async (_command: ScheduleTaskCommand) => undefined) };
  const destinations: ShellDestination[] = [{
    id: 'library', title: 'Library', icon: 'folder',
    renderList: () => <TaskDetailPage taskId="t1" detail={detail} lifecycle={lifecycle} schedule={schedule} />,
  }];
  render(<NavigationShell destinations={destinations} />);
  return { detail, lifecycle, schedule, view };
}

describe('TaskDetailPage', () => {
  it.each([
    ['todo', ['Start']],
    ['doing', ['Complete', 'Pause', 'Fail']],
    ['paused', ['Resume', 'Fail']],
    ['done', ['Reopen']],
    ['failed', ['Reopen']],
  ] as const)('renders valid %s actions', async (status, labels) => {
    renderDetail(status);
    const actions = within(await screen.findByTestId('task-actions-section'));
    for (const label of labels) expect(actions.getByText(label)).toBeTruthy();
  });

  it('runs a lifecycle command, refreshes, and renders task context and records', async () => {
    const { detail, lifecycle } = renderDetail('doing');
    expect(within(await screen.findByTestId('task-detail-header')).getByText('Ship feature')).toBeTruthy();
    expect(within(screen.getByTestId('task-project-row')).getAllByText('Project')).toHaveLength(2);
    expect(within(screen.getByTestId('task-goal-row')).getByText('Goal')).toBeTruthy();
    expect(screen.getByText('Finish the workflow.')).toBeTruthy();
    expect(screen.getByText('Started task')).toBeTruthy();

    fireEvent.press(screen.getByTestId('task-action-complete'));
    await waitFor(() => expect(lifecycle.complete).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 't1', recordId: expect.any(String), relationId: expect.any(String), now: expect.any(Date),
    })));
    await waitFor(() => expect(detail.getDetail).toHaveBeenCalledTimes(2));
  });

  it('schedules without changing lifecycle, refreshes the header and execution activity, and can clear Due', async () => {
    const { detail, lifecycle, schedule, view } = renderDetail('todo');
    schedule.schedule.mockImplementation(async (command) => {
      view.task!.setSchedule(command.startAt, command.due, command.now);
      view.records.unshift({
        id: command.recordId,
        kind: 'taskScheduleChanged',
        detail: 'Changed schedule for “Ship feature”',
        occurredAt: command.now,
      });
    });

    expect(within(await screen.findByTestId('task-actions-section')).getByText('Start')).toBeTruthy();
    fireEvent.press(screen.getByTestId('task-schedule-action'));
    fireEvent.press(screen.getByTestId('task-schedule-editor-start-open'));
    fireEvent(screen.getByTestId('task-schedule-editor-start-native'), 'change', dateEvent(), new Date(2026, 7, 23, 18));
    fireEvent.press(screen.getByTestId('task-schedule-editor-start-done'));
    fireEvent.press(screen.getByTestId('task-schedule-editor-due-clear'));
    fireEvent.press(screen.getByTestId('task-schedule-editor-save'));

    await waitFor(() => expect(schedule.schedule).toHaveBeenCalledTimes(1));
    expect(schedule.schedule).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 't1', startAt: new Date(2026, 7, 23),
      recordId: expect.any(String), relationId: expect.any(String), now: expect.any(Date),
    }));
    expect(schedule.schedule.mock.calls[0]![0].due).toBeUndefined();
    expect(lifecycle.start).not.toHaveBeenCalled();
    expect(await screen.findByText(/Start .* · Due not set/)).toBeTruthy();
    expect(screen.getByText('Changed schedule for “Ship feature”')).toBeTruthy();
    expect(within(screen.getByTestId('task-actions-section')).getByText('Start')).toBeTruthy();
    expect(detail.getDetail).toHaveBeenCalledTimes(2);
  });

  it('shows a clear No schedule header state', async () => {
    const task = Task.create({ id: 't1', title: 'Ship feature', projectId: 'p1', now });
    renderDetail('todo', { task });
    expect(within(await screen.findByTestId('task-detail-header')).getByText('No schedule')).toBeTruthy();
  });

  it('renders an unknown task state', async () => {
    renderDetail('todo', { task: null, records: [] });
    expect(await screen.findByText('Unknown task.')).toBeTruthy();
    expect(screen.queryByTestId('task-detail-header')).toBeNull();
  });
});
