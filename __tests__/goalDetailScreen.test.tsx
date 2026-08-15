import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import type { Goal } from '../src/domain/goal';
import type { AppServices } from '../src/ui/composition/appServices';
import type { CreateGoalCommand } from '../src/application/goalService';
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

function seedGoal(command: Partial<CreateGoalCommand> = {}): Promise<Goal> {
  return harness.services.goals.createGoal({
    actor: 'test',
    title: 'Run a marathon',
    targetState: 'Finish 42 km',
    ...command,
  });
}

async function openDetail(title: string) {
  fireEvent.press(await screen.findByLabelText(`Open goal ${title}`));
  await screen.findByText('Intended outcome');
}

describe('GoalDetailScreen', () => {
  it('renders heading, badges, facts, empty pursuit list, and persisted activity', async () => {
    await seedGoal({
      description: 'A long-held ambition.',
      successCriteria: 'Cross the finish line',
    });
    renderGoalsApp(harness.services);
    await openDetail('Run a marathon');

    expect(screen.getByText('Run a marathon')).toBeTruthy();
    expect(screen.getByText('A long-held ambition.')).toBeTruthy();
    expect(screen.getByLabelText('Not pursued')).toBeTruthy();
    expect(screen.getByText('Target state')).toBeTruthy();
    expect(screen.getByText('Finish 42 km')).toBeTruthy();
    expect(screen.getByText('Success criteria')).toBeTruthy();
    expect(screen.getByText('Cross the finish line')).toBeTruthy();
    expect(screen.getByText('Active projects')).toBeTruthy();
    expect(screen.getByText('No active Project is pursuing this Goal.')).toBeTruthy();
    expect(screen.getByText('Recent activity')).toBeTruthy();
    expect(screen.getByText('Goal created')).toBeTruthy();
    expect(screen.getByLabelText('Edit goal')).toBeTruthy();
    expect(screen.getByLabelText('Archive goal')).toBeTruthy();
  });

  it('falls back to the target state when no description exists', async () => {
    await seedGoal();
    renderGoalsApp(harness.services);
    await openDetail('Run a marathon');

    // Supporting copy plus the fact value both render the target state.
    expect(screen.getAllByText('Finish 42 km').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Not defined')).toBeTruthy();
  });

  it('lists pursuing Projects with active-pursuit badge and fact', async () => {
    const goal = await seedGoal();
    const project = await harness.services.projects.createProject({
      actor: 'test',
      title: 'Becoming for iOS',
      purpose: 'Deliver the M2 planning loop',
    });
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: goal.id,
      actor: 'test',
    });

    renderGoalsApp(harness.services);
    await openDetail('Run a marathon');

    expect(screen.getByLabelText('Actively pursued')).toBeTruthy();
    expect(screen.getByText('Becoming for iOS')).toBeTruthy();
    expect(screen.getByText('Deliver the M2 planning loop')).toBeTruthy();
    expect(screen.queryByText('No active Project is pursuing this Goal.')).toBeNull();
  });

  it('renders archived Goals read-only: no edit, archive, or pursuit slots', async () => {
    const goal = await seedGoal();
    await harness.services.goals.archiveGoal(goal.id, 'test');

    renderGoalsApp(harness.services, {
      renderPursuitActions: () => <Text>Pursuit actions slot</Text>,
    });
    fireEvent.press(await screen.findByLabelText('Show archived goals'));
    fireEvent.press(await screen.findByLabelText('Open goal Run a marathon'));
    await screen.findByText('Intended outcome');

    expect(screen.getByLabelText('Archived')).toBeTruthy();
    expect(screen.getByText('Goal archived')).toBeTruthy();
    expect(screen.queryByLabelText('Edit goal')).toBeNull();
    expect(screen.queryByLabelText('Archive goal')).toBeNull();
    expect(screen.queryByText('Pursuit actions slot')).toBeNull();
  });

  it('exposes the stable pursuit-actions slot for active Goals', async () => {
    await seedGoal();
    renderGoalsApp(harness.services, {
      renderPursuitActions: ({ goal }) => <Text>{`Pursuit actions for ${goal.title}`}</Text>,
    });
    await openDetail('Run a marathon');

    expect(screen.getByText('Pursuit actions for Run a marathon')).toBeTruthy();
  });

  it('shows a recoverable error state when the query fails', async () => {
    const goal = await seedGoal();
    let calls = 0;
    const services: AppServices = {
      ...harness.services,
      goals: overrideServiceMethod(harness.services.goals, 'getGoal', async (id) => {
        calls += 1;
        if (calls === 1) throw new Error('Read model unavailable.');
        return harness.services.goals.getGoal(id);
      }),
    };
    renderGoalsApp(services);
    fireEvent.press(await screen.findByLabelText('Open goal Run a marathon'));

    expect(await screen.findByText('Goal unavailable')).toBeTruthy();
    expect(screen.getByText('Read model unavailable.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading goal'));
    expect(await screen.findByText('Intended outcome')).toBeTruthy();
    expect((await harness.services.goals.getGoal(goal.id))?.title).toBe('Run a marathon');
  });

  it('archive requires confirmation and cancel leaves the Goal unchanged', async () => {
    const goal = await seedGoal();
    renderGoalsApp(harness.services);
    await openDetail('Run a marathon');

    fireEvent.press(screen.getByLabelText('Archive goal'));
    expect(await screen.findByText('Archive this Goal?')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(screen.queryByText('Archive this Goal?')).toBeNull();
    expect((await harness.services.goals.getGoal(goal.id))?.archivedAt).toBeNull();
  });

  it('confirmed archive makes the Goal read-only, refreshes, and announces after commit', async () => {
    const goal = await seedGoal();
    renderGoalsApp(harness.services);
    await openDetail('Run a marathon');

    fireEvent.press(screen.getByLabelText('Archive goal'));
    fireEvent.press(await screen.findByLabelText('Confirm archive'));

    await expectTransientToast('Goal archived');
    expect(await screen.findByLabelText('Archived')).toBeTruthy();
    expect(screen.queryByLabelText('Edit goal')).toBeNull();
    expect(screen.queryByLabelText('Archive goal')).toBeNull();
    expect(screen.getByText('Goal archived')).toBeTruthy();

    const persisted = await harness.services.goals.getGoal(goal.id);
    expect(persisted?.archivedAt).not.toBeNull();
    expect(await harness.services.goals.listActiveGoals()).toHaveLength(0);
    expect(await harness.services.goals.listArchivedGoals()).toHaveLength(1);
  });

  it('navigates back to the list, which reflects committed changes', async () => {
    const goal = await seedGoal();
    renderGoalsApp(harness.services);
    await openDetail('Run a marathon');

    fireEvent.press(screen.getByLabelText('Archive goal'));
    fireEvent.press(await screen.findByLabelText('Confirm archive'));
    await screen.findByLabelText('Archived');

    fireEvent.press(screen.getByLabelText('Back to goals'));
    expect(await screen.findByText('No goals yet')).toBeTruthy();
  });
});
