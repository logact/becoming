import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Goal } from '../src/domain/goal';
import type { AppServices } from '../src/ui/composition/appServices';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { overrideServiceMethod, renderGoalsApp } from './helpers/goalScreenHarness';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

function seedGoal(overrides: Partial<{ title: string; targetState: string }> = {}): Promise<Goal> {
  return harness.services.goals.createGoal({
    actor: 'test',
    title: overrides.title ?? 'Run a marathon',
    targetState: overrides.targetState ?? 'Finish 42 km',
  });
}

async function seedPursuit(goalId: string): Promise<void> {
  const project = await harness.services.projects.createProject({
    actor: 'test',
    title: 'Becoming for iOS',
  });
  await harness.services.goalPursuit.startPursuit({
    projectId: project.id,
    goalId,
    actor: 'test',
  });
}

describe('GoalListScreen', () => {
  it('shows the loading state while the query runs', () => {
    const services: AppServices = {
      ...harness.services,
      goals: overrideServiceMethod(
        harness.services.goals,
        'listActiveGoals',
        () => new Promise<Goal[]>(() => undefined),
      ),
    };
    renderGoalsApp(services);
    expect(screen.getByLabelText('Loading goals')).toBeTruthy();
    expect(screen.queryByLabelText('New goal')).toBeNull();
  });

  it('shows a recoverable error state and retries successfully', async () => {
    let calls = 0;
    const services: AppServices = {
      ...harness.services,
      goals: overrideServiceMethod(harness.services.goals, 'listActiveGoals', async () => {
        calls += 1;
        if (calls === 1) throw new Error('The query failed.');
        return harness.services.goals.listActiveGoals();
      }),
    };
    renderGoalsApp(services);

    expect(await screen.findByText('Goals unavailable')).toBeTruthy();
    expect(screen.getByText('The query failed.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading goals'));
    expect(await screen.findByText('No goals yet')).toBeTruthy();
  });

  it('renders the explicit empty state with an active-only create action', async () => {
    renderGoalsApp(harness.services);
    expect(await screen.findByText('No goals yet')).toBeTruthy();
    expect(screen.getByText('Define an outcome to shape this plan.')).toBeTruthy();
    expect(screen.getByLabelText('New goal')).toBeTruthy();
  });

  it('renders populated rows with target state and unpursued context', async () => {
    await seedGoal({ title: 'Run a marathon', targetState: 'Finish 42 km' });
    await seedGoal({ title: 'Learn Spanish', targetState: 'Hold a conversation' });
    renderGoalsApp(harness.services);

    expect(await screen.findByText('Run a marathon')).toBeTruthy();
    expect(screen.getByText('Finish 42 km')).toBeTruthy();
    expect(screen.getByText('Learn Spanish')).toBeTruthy();
    expect(screen.getAllByLabelText('Unpursued')).toHaveLength(2);
  });

  it('shows the pursued context from the pursuit query on active rows', async () => {
    const goal = await seedGoal();
    await seedPursuit(goal.id);
    renderGoalsApp(harness.services);

    expect(await screen.findByLabelText('1 project')).toBeTruthy();
    expect(screen.queryByLabelText('Unpursued')).toBeNull();
  });

  it('filters rows by title search without changing persisted data', async () => {
    await seedGoal({ title: 'Run a marathon' });
    await seedGoal({ title: 'Learn Spanish' });
    const before = await harness.services.goals.listGoalHistory();

    renderGoalsApp(harness.services);
    expect(await screen.findByText('Run a marathon')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Search goals'), 'marathon');
    await waitFor(() => {
      expect(screen.queryByText('Learn Spanish')).toBeNull();
    });
    expect(screen.getByText('Run a marathon')).toBeTruthy();

    const after = await harness.services.goals.listGoalHistory();
    expect(after).toEqual(before);
  });

  it('shows an explicit no-match state for searches with no results', async () => {
    await seedGoal();
    renderGoalsApp(harness.services);
    expect(await screen.findByText('Run a marathon')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Search goals'), 'triathlon');
    expect(await screen.findByText('No matching goals')).toBeTruthy();
    expect(screen.getByText('Try a different search.')).toBeTruthy();
  });

  it('separates Active and Archived goals and hides create on Archived', async () => {
    const active = await seedGoal({ title: 'Stay active' });
    const archived = await seedGoal({ title: 'Old ambition' });
    await harness.services.goals.archiveGoal(archived.id, 'test');

    renderGoalsApp(harness.services);
    expect(await screen.findByText('Stay active')).toBeTruthy();
    expect(screen.queryByText('Old ambition')).toBeNull();

    fireEvent.press(screen.getByLabelText('Show archived goals'));
    expect(await screen.findByText('Old ambition')).toBeTruthy();
    expect(screen.getByLabelText('Archived')).toBeTruthy();
    expect(screen.queryByText('Stay active')).toBeNull();
    expect(screen.queryByLabelText('New goal')).toBeNull();

    // The archived Goal itself remains active.
    expect((await harness.services.goals.getGoal(active.id))?.archivedAt).toBeNull();
  });

  it('shows an explicit empty state on the Archived filter', async () => {
    renderGoalsApp(harness.services);
    fireEvent.press(screen.getByLabelText('Show archived goals'));
    expect(await screen.findByText('No archived goals')).toBeTruthy();
    expect(screen.getByText('Archived Goals remain inspectable here.')).toBeTruthy();
  });
});
