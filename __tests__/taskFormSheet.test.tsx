import { fireEvent, screen } from '@testing-library/react-native';

import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { expectTransientToast } from './helpers/goalScreenHarness';
import { renderTasksApp } from './helpers/taskScreenHarness';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

async function openCreateSheet() {
  fireEvent.press(await screen.findByLabelText('New task'));
  await screen.findByText('Priority is optional — leave it blank when this Task has no explicit ordering.');
}

function fillRequiredFields() {
  fireEvent.changeText(screen.getByLabelText('Task title'), 'Draft the launch checklist');
  fireEvent.changeText(screen.getByLabelText('Task target description'), 'A reviewed launch checklist');
}

describe('TaskFormSheet — create', () => {
  it('creates a Task with every field, including description and exit criteria', async () => {
    renderTasksApp(harness.services);
    await openCreateSheet();

    fillRequiredFields();
    fireEvent.changeText(screen.getByLabelText('Task description'), 'Start from last quarter\'s list.');
    fireEvent.changeText(screen.getByLabelText('Task exit criteria'), 'Two reviewers signed off');
    fireEvent.changeText(screen.getByLabelText('Task priority'), '2');
    fireEvent.press(screen.getByLabelText('Save new task'));

    await expectTransientToast('Task created');
    expect(await screen.findByText('Draft the launch checklist')).toBeTruthy();

    const tasks = await harness.services.tasks.listActive();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: 'Draft the launch checklist',
      targetDescription: 'A reviewed launch checklist',
      description: 'Start from last quarter\'s list.',
      exitCriteria: 'Two reviewers signed off',
      priority: 2,
      archivedAt: null,
    });
  });

  it.each([[''], ['1'], ['5']])(
    'accepts priority %p per the Task application contract',
    async (priority) => {
      renderTasksApp(harness.services);
      await openCreateSheet();
      fillRequiredFields();
      if (priority !== '') {
        fireEvent.changeText(screen.getByLabelText('Task priority'), priority);
      }
      fireEvent.press(screen.getByLabelText('Save new task'));

      await expectTransientToast('Task created');
      const tasks = await harness.services.tasks.listActive();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe(priority === '' ? null : Number(priority));
    },
  );

  it.each([['2.5'], ['abc'], ['0'], ['6']])(
    'rejects priority %p inline without discarding the draft',
    async (priority) => {
      renderTasksApp(harness.services);
      await openCreateSheet();
      fillRequiredFields();
      fireEvent.changeText(screen.getByLabelText('Task priority'), priority);
      fireEvent.press(screen.getByLabelText('Save new task'));

      expect(
        await screen.findByText(
          'Priority must be a whole number from 1 (highest) to 5 (lowest), or blank.',
        ),
      ).toBeTruthy();
      expect(await harness.services.tasks.listHistory()).toHaveLength(0);

      // The draft is preserved for correction, and the corrected save commits.
      expect(screen.getByLabelText('Task title').props.value).toBe('Draft the launch checklist');
      fireEvent.changeText(screen.getByLabelText('Task priority'), '3');
      fireEvent.press(screen.getByLabelText('Save new task'));
      await expectTransientToast('Task created');
      const tasks = await harness.services.tasks.listActive();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe(3);
    },
  );

  it('shows inline feedback for blank required fields and persists nothing', async () => {
    renderTasksApp(harness.services);
    await openCreateSheet();

    fireEvent.changeText(screen.getByLabelText('Task description'), 'Keep me.');
    fireEvent.press(screen.getByLabelText('Save new task'));

    // The domain validates title first, so its feedback appears first.
    expect(await screen.findByText('Enter a title for this Task.')).toBeTruthy();
    expect(await harness.services.tasks.listHistory()).toHaveLength(0);

    // Once the title is valid, the remaining missing field is flagged instead.
    expect(screen.getByLabelText('Task description').props.value).toBe('Keep me.');
    fireEvent.changeText(screen.getByLabelText('Task title'), 'Draft the launch checklist');
    fireEvent.press(screen.getByLabelText('Save new task'));
    expect(await screen.findByText('Describe the outcome this work aims for.')).toBeTruthy();
    expect(screen.queryByText('Enter a title for this Task.')).toBeNull();
    expect(await harness.services.tasks.listHistory()).toHaveLength(0);
  });

  it('cancellation discards nothing persisted and closes the sheet', async () => {
    renderTasksApp(harness.services);
    await openCreateSheet();
    fillRequiredFields();
    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(await screen.findByText('No tasks yet')).toBeTruthy();
    expect(await harness.services.tasks.listHistory()).toHaveLength(0);
  });
});

describe('TaskFormSheet — edit', () => {
  it('prefills, round-trips every field, and clears optional fields', async () => {
    const created = await harness.services.tasks.createTask({
      actor: 'test',
      title: 'Draft the launch checklist',
      targetDescription: 'A reviewed launch checklist',
      description: 'Start from last quarter\'s list.',
      exitCriteria: 'Two reviewers signed off',
      priority: 4,
    });

    renderTasksApp(harness.services);
    fireEvent.press(await screen.findByLabelText('Open task Draft the launch checklist'));
    fireEvent.press(await screen.findByLabelText('Edit task'));

    expect(screen.getByLabelText('Task title').props.value).toBe('Draft the launch checklist');
    expect(screen.getByLabelText('Task description').props.value).toBe('Start from last quarter\'s list.');
    expect(screen.getByLabelText('Task exit criteria').props.value).toBe('Two reviewers signed off');
    expect(screen.getByLabelText('Task priority').props.value).toBe('4');

    fireEvent.changeText(screen.getByLabelText('Task title'), 'Draft the launch checklist v2');
    fireEvent.changeText(screen.getByLabelText('Task description'), '');
    fireEvent.changeText(screen.getByLabelText('Task exit criteria'), '');
    fireEvent.changeText(screen.getByLabelText('Task priority'), '');
    fireEvent.press(screen.getByLabelText('Save task changes'));

    await expectTransientToast('Task updated');
    const stored = await harness.services.tasks.getTask(created.id);
    expect(stored).toMatchObject({
      title: 'Draft the launch checklist v2',
      targetDescription: 'A reviewed launch checklist',
      description: null,
      exitCriteria: null,
      priority: null,
    });
  });

  it('rejects an invalid priority edit inline and keeps the entered values', async () => {
    const created = await harness.services.tasks.createTask({
      actor: 'test',
      title: 'Draft the launch checklist',
      targetDescription: 'A reviewed launch checklist',
      priority: 2,
    });

    renderTasksApp(harness.services);
    fireEvent.press(await screen.findByLabelText('Open task Draft the launch checklist'));
    fireEvent.press(await screen.findByLabelText('Edit task'));

    fireEvent.changeText(screen.getByLabelText('Task priority'), '7');
    fireEvent.press(screen.getByLabelText('Save task changes'));

    expect(
      await screen.findByText(
        'Priority must be a whole number from 1 (highest) to 5 (lowest), or blank.',
      ),
    ).toBeTruthy();
    const stored = await harness.services.tasks.getTask(created.id);
    expect(stored?.priority).toBe(2);
  });
});
