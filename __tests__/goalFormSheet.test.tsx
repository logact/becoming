import { fireEvent, screen } from '@testing-library/react-native';

import type { AppServices } from '../src/ui/composition/appServices';
import type { CreateGoalCommand } from '../src/application/goalService';
import type { Goal } from '../src/domain/goal';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { expectTransientToast, overrideServiceMethod, renderGoalsApp } from './helpers/goalScreenHarness';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

async function openCreateSheet() {
  fireEvent.press(await screen.findByLabelText('New goal'));
  await screen.findByText('Success criteria are plain text — numbers are optional, never required.');
}

describe('GoalFormSheet — create', () => {
  it('creates a Goal with all fields, including non-numeric success criteria', async () => {
    renderGoalsApp(harness.services);
    await openCreateSheet();

    fireEvent.changeText(screen.getByLabelText('Goal title'), 'Learn Spanish');
    fireEvent.changeText(screen.getByLabelText('Goal target state'), 'Hold a 15-minute conversation');
    fireEvent.changeText(screen.getByLabelText('Goal description'), 'For travelling.');
    fireEvent.changeText(
      screen.getByLabelText('Goal success criteria'),
      'Chat with a neighbour without switching to English',
    );
    fireEvent.press(screen.getByLabelText('Save new goal'));

    await expectTransientToast('Goal created');
    expect(await screen.findByText('Learn Spanish')).toBeTruthy();

    const goals = await harness.services.goals.listActiveGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      title: 'Learn Spanish',
      targetState: 'Hold a 15-minute conversation',
      description: 'For travelling.',
      successCriteria: 'Chat with a neighbour without switching to English',
      archivedAt: null,
    });
  });

  it('normalizes blank optional fields to null per the Goal application contract', async () => {
    renderGoalsApp(harness.services);
    await openCreateSheet();

    fireEvent.changeText(screen.getByLabelText('Goal title'), 'Run a marathon');
    fireEvent.changeText(screen.getByLabelText('Goal target state'), 'Finish 42 km');
    fireEvent.press(screen.getByLabelText('Save new goal'));

    await expectTransientToast('Goal created');
    const goals = await harness.services.goals.listActiveGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0].description).toBeNull();
    expect(goals[0].successCriteria).toBeNull();
  });

  it('shows inline feedback for blank required fields and persists nothing', async () => {
    renderGoalsApp(harness.services);
    await openCreateSheet();

    fireEvent.changeText(screen.getByLabelText('Goal description'), 'Keep me.');
    fireEvent.press(screen.getByLabelText('Save new goal'));

    // The domain validates title first, so its feedback appears first.
    expect(await screen.findByText('Enter a title for this Goal.')).toBeTruthy();
    expect(await harness.services.goals.listGoalHistory()).toHaveLength(0);

    // The draft is preserved for correction; once the title is valid, the
    // remaining missing field is flagged instead.
    expect(screen.getByLabelText('Goal description').props.value).toBe('Keep me.');
    fireEvent.changeText(screen.getByLabelText('Goal title'), 'Run a marathon');
    fireEvent.press(screen.getByLabelText('Save new goal'));
    expect(await screen.findByText('Describe the state you want to reach.')).toBeTruthy();
    expect(screen.queryByText('Enter a title for this Goal.')).toBeNull();
    expect(screen.getByLabelText('Goal title').props.value).toBe('Run a marathon');
    expect(await harness.services.goals.listGoalHistory()).toHaveLength(0);
  });

  it('preserves the draft on mutation failure and succeeds on retry', async () => {
    let calls = 0;
    const services: AppServices = {
      ...harness.services,
      goals: overrideServiceMethod(
        harness.services.goals,
        'createGoal',
        async (command: CreateGoalCommand) => {
          calls += 1;
          if (calls === 1) throw new Error('Storage is full.');
          return harness.services.goals.createGoal(command);
        },
      ),
    };
    renderGoalsApp(services);
    await openCreateSheet();

    fireEvent.changeText(screen.getByLabelText('Goal title'), 'Run a marathon');
    fireEvent.changeText(screen.getByLabelText('Goal target state'), 'Finish 42 km');
    fireEvent.press(screen.getByLabelText('Save new goal'));

    expect(await screen.findByText('Storage is full.')).toBeTruthy();
    expect(screen.getByLabelText('Goal title').props.value).toBe('Run a marathon');
    expect(await harness.services.goals.listGoalHistory()).toHaveLength(0);

    fireEvent.press(screen.getByLabelText('Save new goal'));
    await expectTransientToast('Goal created');
    expect(await harness.services.goals.listActiveGoals()).toHaveLength(1);
  });

  it('cancel leaves no persisted change and keeps the list unchanged', async () => {
    renderGoalsApp(harness.services);
    await openCreateSheet();

    fireEvent.changeText(screen.getByLabelText('Goal title'), 'Discarded draft');
    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(screen.queryByLabelText('Goal title')).toBeNull();
    expect(await screen.findByText('No goals yet')).toBeTruthy();
    expect(await harness.services.goals.listGoalHistory()).toHaveLength(0);
  });
});

describe('GoalFormSheet — edit', () => {
  async function seedAndOpenEdit(): Promise<Goal> {
    const goal = await harness.services.goals.createGoal({
      actor: 'test',
      title: 'Run a marathon',
      targetState: 'Finish 42 km',
      description: 'A long-held ambition.',
      successCriteria: 'Cross the finish line',
    });
    renderGoalsApp(harness.services);
    fireEvent.press(await screen.findByLabelText('Open goal Run a marathon'));
    fireEvent.press(await screen.findByLabelText('Edit goal'));
    await screen.findByText('Success criteria are plain text — numbers are optional, never required.');
    return goal;
  }

  it('prefills the current values', async () => {
    await seedAndOpenEdit();
    expect(screen.getByLabelText('Goal title').props.value).toBe('Run a marathon');
    expect(screen.getByLabelText('Goal target state').props.value).toBe('Finish 42 km');
    expect(screen.getByLabelText('Goal description').props.value).toBe('A long-held ambition.');
    expect(screen.getByLabelText('Goal success criteria').props.value).toBe('Cross the finish line');
  });

  it('saves changes and refreshes the detail immediately', async () => {
    const goal = await seedAndOpenEdit();

    fireEvent.changeText(screen.getByLabelText('Goal title'), 'Run an ultramarathon');
    fireEvent.changeText(screen.getByLabelText('Goal description'), '');
    fireEvent.press(screen.getByLabelText('Save goal changes'));

    await expectTransientToast('Goal updated');
    expect(await screen.findByText('Run an ultramarathon')).toBeTruthy();

    const persisted = await harness.services.goals.getGoal(goal.id);
    expect(persisted?.title).toBe('Run an ultramarathon');
    expect(persisted?.targetState).toBe('Finish 42 km');
    expect(persisted?.description).toBeNull();
    expect(persisted?.successCriteria).toBe('Cross the finish line');
  });

  it('shows inline feedback on invalid edits and persists nothing', async () => {
    const goal = await seedAndOpenEdit();

    fireEvent.changeText(screen.getByLabelText('Goal title'), '   ');
    fireEvent.press(screen.getByLabelText('Save goal changes'));

    expect(await screen.findByText('Enter a title for this Goal.')).toBeTruthy();
    expect((await harness.services.goals.getGoal(goal.id))?.title).toBe('Run a marathon');
  });

  it('cancel leaves the Goal unchanged', async () => {
    const goal = await seedAndOpenEdit();

    fireEvent.changeText(screen.getByLabelText('Goal title'), 'Discarded edit');
    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(screen.queryByLabelText('Goal title')).toBeNull();
    expect((await harness.services.goals.getGoal(goal.id))?.title).toBe('Run a marathon');
    expect(await screen.findByText('Run a marathon')).toBeTruthy();
  });
});
