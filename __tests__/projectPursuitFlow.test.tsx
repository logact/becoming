import { fireEvent, screen } from '@testing-library/react-native';

import type { Goal } from '../src/domain/goal';
import type { Project } from '../src/domain/project';
import type { AppServices } from '../src/ui/composition/appServices';
import { composeAppServices } from '../src/ui/composition/appServices';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { expectTransientToast, overrideServiceMethod } from './helpers/goalScreenHarness';
import { renderPlanningApp } from './helpers/projectScreenHarness';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

function seedGoal(title: string): Promise<Goal> {
  return harness.services.goals.createGoal({
    actor: 'test',
    title,
    targetState: `Reach ${title}`,
  });
}

function seedProject(title: string): Promise<Project> {
  return harness.services.projects.createProject({ actor: 'test', title });
}

async function openGoalDetail(title: string) {
  fireEvent.press(await screen.findByLabelText(`Open goal ${title}`));
  await screen.findByText('Intended outcome');
}

async function openProjectDetail(title: string) {
  fireEvent.press(await screen.findByLabelText('Projects tab'));
  fireEvent.press(await screen.findByLabelText(`Open project ${title}`));
  await screen.findByText('Execution context');
}

describe('Goal pursuit from Goal context', () => {
  it('connects an existing Project and refreshes the Goal detail', async () => {
    await seedGoal('Run a marathon');
    await seedProject('Marathon training');
    renderPlanningApp(harness.services);
    await openGoalDetail('Run a marathon');
    expect(screen.getByLabelText('Not pursued')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Connect goal to a project'));
    fireEvent.press(await screen.findByLabelText('Choose Marathon training'));
    await expectTransientToast('Pursuit started');

    expect(await screen.findByLabelText('Actively pursued')).toBeTruthy();
    expect(screen.getByText('Marathon training')).toBeTruthy();
    // The committed relation is persisted.
    const goal = (await harness.services.goals.listActiveGoals())[0];
    const pursuits = await harness.services.goalPursuitQueries.listProjectsPursuingGoal(goal.id);
    expect(pursuits).toHaveLength(1);
  });

  it('keeps duplicate and archived Projects visible with rejection reasons', async () => {
    const goal = await seedGoal('Run a marathon');
    const pursuing = await seedProject('Marathon training');
    const archived = await seedProject('Old effort');
    await harness.services.projects.archiveProject({ id: archived.id, actor: 'test' });
    await harness.services.goalPursuit.startPursuit({
      projectId: pursuing.id,
      goalId: goal.id,
      actor: 'test',
    });

    renderPlanningApp(harness.services);
    await openGoalDetail('Run a marathon');

    fireEvent.press(screen.getByLabelText('Connect goal to a project'));
    expect(
      await screen.findByLabelText('Marathon training, unavailable: Duplicate active relationship'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Old effort, unavailable: Archived endpoint'),
    ).toBeTruthy();
  });

  it('shows the rejection sheet on commit-time failure without committing a relation', async () => {
    await seedGoal('Run a marathon');
    await seedProject('Marathon training');
    const services: AppServices = {
      ...harness.services,
      goalPursuit: overrideServiceMethod(
        harness.services.goalPursuit,
        'startPursuit',
        async () => {
          throw Object.assign(new Error('already pursuing'), {
            name: 'DuplicateActiveGoalPursuitError',
          });
        },
      ),
    };
    renderPlanningApp(services);
    await openGoalDetail('Run a marathon');

    fireEvent.press(screen.getByLabelText('Connect goal to a project'));
    fireEvent.press(await screen.findByLabelText('Choose Marathon training'));

    expect(await screen.findByText('Change not allowed')).toBeTruthy();
    expect(screen.getByText('Already connected')).toBeTruthy();

    // Reviewing another choice returns to the picker; nothing was committed.
    fireEvent.press(screen.getByLabelText('Review another choice'));
    expect(await screen.findByLabelText('Choose Marathon training')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close Connect to a Project'));
    expect(await screen.findByLabelText('Not pursued')).toBeTruthy();
    const goal = (await harness.services.goals.listActiveGoals())[0];
    expect(
      await harness.services.goalPursuitQueries.listProjectsPursuingGoal(goal.id),
    ).toHaveLength(0);
  });

  it('creates a Project from Goal context and connects it', async () => {
    await seedGoal('Run a marathon');
    renderPlanningApp(harness.services);
    await openGoalDetail('Run a marathon');

    fireEvent.press(screen.getByLabelText('Create a project for this goal'));
    fireEvent.changeText(await screen.findByLabelText('Project title'), 'Marathon training');
    fireEvent.press(screen.getByLabelText('Save new project'));
    await expectTransientToast('Project created and pursuit started');

    expect(await screen.findByLabelText('Actively pursued')).toBeTruthy();
    expect(screen.getByText('Marathon training')).toBeTruthy();

    // The new Project is a real persisted Project, visible on the Projects tab.
    fireEvent.press(screen.getByLabelText('Projects tab'));
    expect(await screen.findByText('Marathon training')).toBeTruthy();
  });

  it('cancellation leaves the Goal unpursued', async () => {
    await seedGoal('Run a marathon');
    await seedProject('Marathon training');
    renderPlanningApp(harness.services);
    await openGoalDetail('Run a marathon');

    fireEvent.press(screen.getByLabelText('Connect goal to a project'));
    expect(await screen.findByLabelText('Choose Marathon training')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close Connect to a Project'));

    expect(await screen.findByLabelText('Not pursued')).toBeTruthy();
    expect(
      await harness.services.goalPursuitQueries.listGoalPursuitHistoryForGoal(
        (await harness.services.goals.listActiveGoals())[0].id,
      ),
    ).toHaveLength(0);
  });

  it('ends a pursuit after confirmation and preserves history', async () => {
    const goal = await seedGoal('Run a marathon');
    const project = await seedProject('Marathon training');
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: goal.id,
      actor: 'test',
    });
    renderPlanningApp(harness.services);
    await openGoalDetail('Run a marathon');

    // A single active pursuit needs no picker: the confirmation appears first.
    fireEvent.press(await screen.findByLabelText('Remove goal from a project'));
    expect(await screen.findByText('End this pursuit?')).toBeTruthy();
    expect(
      screen.getByText(/will no longer be actively pursued by "Marathon training"/),
    ).toBeTruthy();
    expect(screen.getByText(/the previous association stays visible in history/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('End pursuit'));
    await expectTransientToast('Pursuit ended');

    expect(await screen.findByLabelText('Not pursued')).toBeTruthy();
    expect(screen.queryByLabelText('Remove goal from a project')).toBeNull();
    // The ended relation and its audit event remain in history.
    const history = await harness.services.goalPursuitQueries.listGoalPursuitHistoryForGoal(goal.id);
    expect(history).toHaveLength(1);
    expect(history[0].endedAt).not.toBeNull();
    expect(
      screen.getAllByText('A relationship ended; the previous association remains in history')
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('Goal pursuit from Project context', () => {
  it('pursues multiple Goals with duplicate and archived rejections visible', async () => {
    const project = await seedProject('Marathon training');
    await seedGoal('Goal A');
    await seedGoal('Goal B');
    const pursued = await seedGoal('Goal C');
    const archived = await seedGoal('Goal D');
    await harness.services.goals.archiveGoal(archived.id, 'test');
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: pursued.id,
      actor: 'test',
    });

    renderPlanningApp(harness.services);
    await openProjectDetail('Marathon training');

    fireEvent.press(screen.getByLabelText('Add pursued goals'));
    expect(await screen.findByLabelText('Goal A')).toBeTruthy();
    expect(screen.getByLabelText('Goal B')).toBeTruthy();
    expect(
      screen.getByLabelText('Goal C, unavailable: Duplicate active relationship'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Goal D, unavailable: Archived endpoint')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Goal A'));
    fireEvent.press(screen.getByLabelText('Goal B'));
    fireEvent.press(screen.getByLabelText('Pursue selected goals'));
    await expectTransientToast('2 pursuits started');

    // Overview facts and rows refresh; the pre-existing pursuit remains.
    expect(await screen.findByLabelText('Open goal Goal A')).toBeTruthy();
    expect(screen.getByLabelText('Open goal Goal B')).toBeTruthy();
    expect(screen.getByLabelText('Open goal Goal C')).toBeTruthy();
    expect(screen.queryByText('No pursued Goals')).toBeNull();

    // The Goal list badges refresh too.
    fireEvent.press(screen.getByLabelText('Goals tab'));
    expect(await screen.findAllByLabelText('1 project')).toHaveLength(3);
    expect(screen.queryByLabelText('Unpursued')).toBeNull();
  }, 15000);

  it('keeps selections and shows the rejection sheet when the commit fails', async () => {
    await seedProject('Marathon training');
    await seedGoal('Goal A');
    const services: AppServices = {
      ...harness.services,
      goalPursuit: overrideServiceMethod(
        harness.services.goalPursuit,
        'startPursuit',
        async () => {
          throw Object.assign(new Error('already pursuing'), {
            name: 'DuplicateActiveGoalPursuitError',
          });
        },
      ),
    };
    renderPlanningApp(services);
    await openProjectDetail('Marathon training');

    fireEvent.press(screen.getByLabelText('Add pursued goals'));
    fireEvent.press(await screen.findByLabelText('Goal A'));
    fireEvent.press(screen.getByLabelText('Pursue selected goals'));

    expect(await screen.findByText('Change not allowed')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Review another choice'));
    // The selection is preserved after the rejection.
    const row = await screen.findByLabelText('Goal A');
    expect(row.props.accessibilityState.checked).toBe(true);
    expect(
      await harness.services.goalPursuitQueries.listGoalPursuitHistoryForProject(
        (await harness.services.projects.listActiveProjects())[0].id,
      ),
    ).toHaveLength(0);
  });

  it('ends a pursuit through the picker and preserves both entities and history', async () => {
    const project = await seedProject('Marathon training');
    const goalA = await seedGoal('Goal A');
    await seedGoal('Goal B');
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: goalA.id,
      actor: 'test',
    });
    const goalB = (await harness.services.goals.listActiveGoals()).find((g) => g.title === 'Goal B')!;
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: goalB.id,
      actor: 'test',
    });

    renderPlanningApp(harness.services);
    await openProjectDetail('Marathon training');

    // Two active pursuits: the explicit picker appears first.
    fireEvent.press(screen.getByLabelText('Remove a pursued goal'));
    expect(await screen.findByText('Remove a pursued Goal')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('End pursuit with Goal A'));

    expect(await screen.findByText('End this pursuit?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('End pursuit'));
    await expectTransientToast('Pursuit ended');

    expect(await screen.findByLabelText('Open goal Goal B')).toBeTruthy();
    expect(screen.queryByLabelText('Open goal Goal A')).toBeNull();

    // Both entities and the prior association remain in history.
    expect(await harness.services.goals.getGoal(goalA.id)).not.toBeNull();
    expect(await harness.services.projects.getProject(project.id)).not.toBeNull();
    const history = await harness.services.goalPursuitQueries.listGoalPursuitHistoryForProject(
      project.id,
    );
    expect(history).toHaveLength(2);
    expect(history.filter((view) => view.endedAt !== null)).toHaveLength(1);
    expect(
      screen.getAllByText('A relationship ended; the previous association remains in history')
        .length,
    ).toBeGreaterThan(0);

    // The Goal list badge for the ended pursuit returns to Unpursued.
    fireEvent.press(screen.getByLabelText('Goals tab'));
    expect(await screen.findByLabelText('Unpursued')).toBeTruthy();
    expect(screen.getByLabelText('1 project')).toBeTruthy();
  }, 15000);

  it('cancelling the end-pursuit confirmation leaves the pursuit active', async () => {
    const project = await seedProject('Marathon training');
    const goal = await seedGoal('Goal A');
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: goal.id,
      actor: 'test',
    });

    renderPlanningApp(harness.services);
    await openProjectDetail('Marathon training');

    // Single pursuit: straight to confirmation; cancel keeps it active.
    fireEvent.press(screen.getByLabelText('Remove a pursued goal'));
    expect(await screen.findByText('End this pursuit?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(await screen.findByLabelText('Open goal Goal A')).toBeTruthy();
    const active = await harness.services.goalPursuitQueries.listGoalsPursuedByProject(project.id);
    expect(active).toHaveLength(1);
  });
});

describe('Pursuit navigation and persistence', () => {
  it('navigates from a pursued Goal row to the Goal detail on the Goals tab', async () => {
    const project = await seedProject('Marathon training');
    const goal = await seedGoal('Run a marathon');
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: goal.id,
      actor: 'test',
    });

    renderPlanningApp(harness.services);
    await openProjectDetail('Marathon training');

    fireEvent.press(screen.getByLabelText('Open goal Run a marathon'));
    expect(await screen.findByText('Intended outcome')).toBeTruthy();
    expect(screen.getByText('Run a marathon')).toBeTruthy();
  });

  it('a fresh services instance reconstructs the pursuit from SQLite', async () => {
    const project = await seedProject('Marathon training');
    const goal = await seedGoal('Run a marathon');
    await harness.services.goalPursuit.startPursuit({
      projectId: project.id,
      goalId: goal.id,
      actor: 'test',
    });

    const reloadedServices = composeAppServices(harness.db);
    const pursuits = await reloadedServices.goalPursuitQueries.listGoalsPursuedByProject(project.id);
    expect(pursuits).toHaveLength(1);
    expect(pursuits[0].goal?.title).toBe('Run a marathon');

    const first = renderPlanningApp(reloadedServices);
    await openProjectDetail('Marathon training');
    expect(await screen.findByLabelText('Open goal Run a marathon')).toBeTruthy();
    first.unmount();
  });
});
