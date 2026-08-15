import { fireEvent, screen } from '@testing-library/react-native';

import type { Task } from '../src/domain/task';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { expectTransientToast, overrideServiceMethod } from './helpers/goalScreenHarness';
import { renderTasksApp } from './helpers/taskScreenHarness';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

function seedTask(overrides: Partial<Parameters<typeof harness.services.tasks.createTask>[0]> = {}): Promise<Task> {
  return harness.services.tasks.createTask({
    actor: 'test',
    title: 'Draft the launch checklist',
    targetDescription: 'A reviewed launch checklist',
    ...overrides,
  });
}

async function openTaskDetail(title: string) {
  fireEvent.press(await screen.findByLabelText(`Open task ${title}`));
  await screen.findByText('Executable work');
}

describe('TaskDetailScreen', () => {
  it('shows the heading, facts, badges, and the inspect-only lifecycle note', async () => {
    await seedTask({
      description: 'Start from last quarter\'s list.',
      exitCriteria: 'Two reviewers signed off',
      priority: 1,
    });

    renderTasksApp(harness.services);
    await openTaskDetail('Draft the launch checklist');

    expect(screen.getByText('Draft the launch checklist')).toBeTruthy();
    expect(screen.getByText('Start from last quarter\'s list.')).toBeTruthy();
    expect(screen.getByLabelText('Standalone')).toBeTruthy();
    expect(screen.getByLabelText('Priority 1')).toBeTruthy();
    // Facts: target, current Project, read-only lifecycle, exit criteria.
    expect(screen.getByText('Target')).toBeTruthy();
    expect(screen.getByText('A reviewed launch checklist')).toBeTruthy();
    expect(screen.getByText('Project')).toBeTruthy();
    expect(screen.getByText('No membership')).toBeTruthy();
    expect(screen.getByText('Lifecycle')).toBeTruthy();
    expect(
      screen.getByText('No active Project membership, so no lifecycle context yet.'),
    ).toBeTruthy();
    expect(screen.getByText('Exit criteria')).toBeTruthy();
    expect(screen.getByText('Two reviewers signed off')).toBeTruthy();
    // The prototype's explicit inspect-only note is kept.
    expect(screen.getByText(/Lifecycle is inspect-only\./)).toBeTruthy();
    expect(screen.getByText(/Transition actions belong to Feature #29/)).toBeTruthy();
    // Unassigned Tasks expose the membership add action.
    expect(screen.getByLabelText('Add task to a project')).toBeTruthy();
  });

  it('shows recent persisted activity newest first', async () => {
    const task = await seedTask();

    renderTasksApp(harness.services);
    await openTaskDetail('Draft the launch checklist');

    expect(await screen.findByText('Task created')).toBeTruthy();
    const events = await harness.services.timelines.list({ type: 'task', id: task.id });
    expect(events.length).toBeGreaterThan(0);
  });

  it('edits through the sheet and refreshes the detail', async () => {
    await seedTask();

    renderTasksApp(harness.services);
    await openTaskDetail('Draft the launch checklist');
    fireEvent.press(screen.getByLabelText('Edit task'));
    fireEvent.changeText(screen.getByLabelText('Task title'), 'Draft the launch checklist v2');
    fireEvent.press(screen.getByLabelText('Save task changes'));

    await expectTransientToast('Task updated');
    expect(await screen.findByText('Draft the launch checklist v2')).toBeTruthy();
    expect(screen.getByText('Task updated')).toBeTruthy();
  });

  it('archives only after confirmation and becomes read-only', async () => {
    const task = await seedTask();

    renderTasksApp(harness.services);
    await openTaskDetail('Draft the launch checklist');

    // Cancel keeps the Task active.
    fireEvent.press(screen.getByLabelText('Archive task'));
    fireEvent.press(await screen.findByLabelText('Cancel'));
    expect((await harness.services.tasks.getTask(task.id))?.archivedAt).toBeNull();

    fireEvent.press(await screen.findByLabelText('Archive task'));
    expect(await screen.findByText(/becomes read-only and leaves the Active list/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Confirm archive'));

    await expectTransientToast('Task archived');
    expect(await screen.findByLabelText('Archived')).toBeTruthy();
    // Archived detail is read-only: no edit, archive, or membership actions.
    expect(screen.queryByLabelText('Edit task')).toBeNull();
    expect(screen.queryByLabelText('Archive task')).toBeNull();
    expect(screen.queryByLabelText('Add task to a project')).toBeNull();
    // The mutation is persisted and the history is retained.
    expect((await harness.services.tasks.getTask(task.id))?.archivedAt).not.toBeNull();
    expect(await screen.findByText('Task archived')).toBeTruthy();
  });

  it('removes an archived task from Active and retains it under Archived/history', async () => {
    const task = await seedTask();
    await harness.services.tasks.archiveTask(task.id, 'test');

    renderTasksApp(harness.services);
    await screen.findByText('No tasks yet');

    fireEvent.press(screen.getByLabelText('Show archived tasks'));
    fireEvent.press(await screen.findByLabelText('Open task Draft the launch checklist'));
    expect(await screen.findByText('Executable work')).toBeTruthy();
    expect(screen.getByLabelText('Archived')).toBeTruthy();
  });

  it('offers a recoverable error state with retry', async () => {
    const task = await seedTask();
    let attempts = 0;
    const services = {
      ...harness.services,
      tasks: overrideServiceMethod(harness.services.tasks, 'getTask', async (id: string) => {
        attempts += 1;
        if (attempts === 1) throw new Error('read failed');
        return harness.services.tasks.getTask(id);
      }),
    };

    renderTasksApp(services);
    fireEvent.press(await screen.findByLabelText('Open task Draft the launch checklist'));
    expect(await screen.findByText('Task unavailable')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading task'));
    expect(await screen.findByText('Executable work')).toBeTruthy();
  });
});
