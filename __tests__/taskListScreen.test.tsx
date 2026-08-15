import { fireEvent, screen } from '@testing-library/react-native';

import type { Task } from '../src/domain/task';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { overrideServiceMethod } from './helpers/goalScreenHarness';
import { renderTasksApp } from './helpers/taskScreenHarness';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

function seedTask(title: string, priority?: number): Promise<Task> {
  return harness.services.tasks.createTask({
    actor: 'test',
    title,
    targetDescription: `Target for ${title}`,
    priority,
  });
}

describe('TaskListScreen', () => {
  it('renders the planning hero and the explicit empty state', async () => {
    renderTasksApp(harness.services);

    expect(await screen.findByText('The work in front of you')).toBeTruthy();
    expect(screen.getByText('Tasks can stand alone or belong to a Project.')).toBeTruthy();
    expect(screen.getByText('No tasks yet')).toBeTruthy();
    expect(screen.getByText('Define the work that moves a Goal forward.')).toBeTruthy();
    // The create action is available on the Active filter.
    expect(screen.getByLabelText('New task')).toBeTruthy();
  });

  it('lists tasks with target/priority context and lifecycle badges', async () => {
    await seedTask('Draft the launch checklist', 3);
    const member = await seedTask('Ship the beta');
    const project = await harness.services.projects.createProject({
      actor: 'test',
      title: 'Beta rollout',
    });
    await harness.services.taskMembership.startMembership({
      taskId: member.id,
      projectId: project.id,
      actor: 'test',
    });

    renderTasksApp(harness.services);

    expect(await screen.findByText('Draft the launch checklist')).toBeTruthy();
    expect(screen.getByText('Target for Draft the launch checklist · P3')).toBeTruthy();
    // A standalone Task has no lifecycle context; a member Task's badge comes
    // from the Project execution snapshot (unmanaged until a machine exists).
    expect(screen.getByLabelText('Standalone')).toBeTruthy();
    expect(screen.getByLabelText('Unmanaged')).toBeTruthy();
  });

  it('filters by title search without changing persisted data', async () => {
    await seedTask('Draft the launch checklist');
    await seedTask('Ship the beta');

    renderTasksApp(harness.services);
    await screen.findByText('Draft the launch checklist');

    fireEvent.changeText(screen.getByLabelText('Search tasks'), 'ship');
    expect(screen.queryByText('Draft the launch checklist')).toBeNull();
    expect(screen.getByText('Ship the beta')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Search tasks'), 'zzz');
    expect(await screen.findByText('No matching tasks')).toBeTruthy();
    expect(await harness.services.tasks.listActive()).toHaveLength(2);
  });

  it('moves archived tasks to the Archived filter and hides the create action there', async () => {
    const task = await seedTask('Draft the launch checklist');
    await seedTask('Ship the beta');
    await harness.services.tasks.archiveTask(task.id, 'test');

    renderTasksApp(harness.services);
    await screen.findByText('Ship the beta');
    expect(screen.queryByText('Draft the launch checklist')).toBeNull();

    fireEvent.press(screen.getByLabelText('Show archived tasks'));
    expect(await screen.findByText('Draft the launch checklist')).toBeTruthy();
    expect(screen.getByLabelText('Archived')).toBeTruthy();
    expect(screen.queryByText('Ship the beta')).toBeNull();
    expect(screen.queryByLabelText('New task')).toBeNull();
  });

  it('offers a recoverable error state with retry', async () => {
    let attempts = 0;
    const services = {
      ...harness.services,
      tasks: overrideServiceMethod(harness.services.tasks, 'listActive', async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('read failed');
        return harness.services.tasks.listActive();
      }),
    };
    await seedTask('Draft the launch checklist');

    renderTasksApp(services);
    expect(await screen.findByText('Tasks unavailable')).toBeTruthy();
    expect(screen.getByText('read failed')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading tasks'));
    expect(await screen.findByText('Draft the launch checklist')).toBeTruthy();
  });
});
