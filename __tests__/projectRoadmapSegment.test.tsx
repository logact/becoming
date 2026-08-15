import { act, fireEvent, screen } from '@testing-library/react-native';

import type { Goal } from '../src/domain/goal';
import type { Project } from '../src/domain/project';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import { createEntityLabelAssignment } from '../src/domain/entityLabel';
import { createLabel } from '../src/domain/label';
import { createProjectEntityState } from '../src/domain/projectEntityState';
import { createProjectState } from '../src/domain/projectState';
import type {
  ProjectRoadmap,
  ProjectRoadmapReadOptions,
} from '../src/application/projectRoadmapQueryService';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteProjectEntityStateRepository } from '../src/persistence/projectEntityStateRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import type { AppServices } from '../src/ui/composition/appServices';
import { expectTransientToast, overrideServiceMethod } from './helpers/goalScreenHarness';
import { renderPlanningApp } from './helpers/projectScreenHarness';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';

const NOW = '2026-08-14T00:00:00.000Z';
const LABEL_ID = 'flow';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

function seedProject(title: string): Promise<Project> {
  return harness.services.projects.createProject({ actor: 'test', title });
}

function seedGoal(title: string): Promise<Goal> {
  return harness.services.goals.createGoal({ actor: 'test', title, targetState: `Done: ${title}` });
}

function pursue(projectId: string, goalId: string) {
  return harness.services.goalPursuit.startPursuit({ projectId, goalId, actor: 'test' });
}

/** A stored decomposition edge, inserted directly like the application tests do. */
function seedEdge(projectId: string, parent: Goal, child: Goal, id: string) {
  return new SqliteRelationRepository(harness.db).add({
    id,
    sourceType: 'goal',
    sourceId: parent.id,
    relationType: 'decomposes',
    targetType: 'goal',
    targetId: child.id,
    metadata: decompositionMetadata(projectId),
    createdAt: NOW,
    endedAt: null,
  });
}

function seedMilestone(
  projectId: string,
  title: string,
  goalIds: readonly string[],
  extra: { description?: string; targetAt?: string } = {},
) {
  return harness.services.milestones.createMilestone({
    projectId,
    title,
    goalIds,
    actor: 'test',
    ...extra,
  });
}

/** Lifecycle seeding: one 'flow' label, Goal machine states, and current periods. */
async function seedFlowLabel() {
  await new SqliteLabelRepository(harness.db).add({
    ...createLabel({ name: 'Flow' }),
    id: LABEL_ID,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function assignFlow(goalId: string) {
  return new SqliteEntityLabelRepository(harness.db).add(
    createEntityLabelAssignment(
      { entityType: 'goal', entityId: goalId, labelId: LABEL_ID },
      { id: `assign-goal-${goalId}`, now: NOW },
    ),
  );
}

function defineGoalStates(projectId: string) {
  const states = new SqliteProjectStateRepository(harness.db);
  return Promise.all([
    states.add(
      createProjectState(
        { projectId, entityType: 'goal', labelId: LABEL_ID, title: 'Doing', isInitial: true },
        { id: 'state-goal-doing', now: NOW },
      ),
    ),
    states.add(
      createProjectState(
        { projectId, entityType: 'goal', labelId: LABEL_ID, title: 'Done', isTerminal: true },
        { id: 'state-goal-done', now: NOW },
      ),
    ),
  ]);
}

function setCurrent(projectId: string, goalId: string, stateTitle: 'doing' | 'done') {
  return new SqliteProjectEntityStateRepository(harness.db).add(
    createProjectEntityState(
      {
        projectId,
        entityType: 'goal',
        entityId: goalId,
        labelId: LABEL_ID,
        projectStateId: `state-goal-${stateTitle}`,
        enteredAt: NOW,
      },
      { id: `period-goal-${goalId}`, now: NOW },
    ),
  );
}

function overrideRoadmaps(
  implementation: (projectId: string, options?: ProjectRoadmapReadOptions) => Promise<ProjectRoadmap>,
): AppServices {
  return {
    ...harness.services,
    roadmaps: overrideServiceMethod(harness.services.roadmaps, 'getProjectRoadmap', implementation),
  };
}

/** Render the full app (the production wiring) and open the Project's Roadmap segment. */
async function openRoadmap(projectTitle: string, services: AppServices = harness.services) {
  renderPlanningApp(services);
  fireEvent.press(screen.getByLabelText('Projects tab'));
  fireEvent.press(await screen.findByLabelText(`Open project ${projectTitle}`));
  await screen.findByText('Execution context');
  fireEvent.press(screen.getByLabelText('Show roadmap'));
  // Let immediately resolved/rejected query promises commit inside `act`.
  // Longer-running loads remain pending and are awaited by each test's query.
  await act(async () => {
    await Promise.resolve();
  });
}

/** A Project pursuing a root Goal with three sub-goals: b, c, d. */
async function seedPursuitWithSubGoals() {
  const project = await seedProject('Becoming for iOS');
  const root = await seedGoal('Root goal');
  const b = await seedGoal('Sub-goal B');
  const c = await seedGoal('Sub-goal C');
  const d = await seedGoal('Sub-goal D');
  await pursue(project.id, root.id);
  await seedEdge(project.id, root, b, 'edge-root-b');
  await seedEdge(project.id, root, c, 'edge-root-c');
  await seedEdge(project.id, root, d, 'edge-root-d');
  return { project, root, b, c, d };
}

describe('Project Roadmap segment — placement', () => {
  it('replaces the Progress tab on the Project detail screen', async () => {
    await seedProject('Becoming for iOS');
    renderPlanningApp(harness.services);
    fireEvent.press(screen.getByLabelText('Projects tab'));
    fireEvent.press(await screen.findByLabelText('Open project Becoming for iOS'));
    await screen.findByText('Execution context');

    expect(screen.getByLabelText('Show roadmap')).toBeTruthy();
    expect(screen.queryByLabelText('Show progress')).toBeNull();

    fireEvent.press(screen.getByLabelText('Show roadmap'));
    expect(await screen.findByText('No roadmap yet')).toBeTruthy();
  });
});

describe('Project Roadmap segment — states', () => {
  it('renders the no-pursued-Goal state', async () => {
    await seedProject('Becoming for iOS');
    await openRoadmap('Becoming for iOS');

    expect(await screen.findByText('No roadmap yet')).toBeTruthy();
    expect(
      screen.getByText('Connect a Goal first, then split its target state into required sub-goals.'),
    ).toBeTruthy();
  });

  it('renders the pursued-Goal-without-sub-goals state', async () => {
    const project = await seedProject('Becoming for iOS');
    const root = await seedGoal('Root goal');
    await pursue(project.id, root.id);
    await openRoadmap('Becoming for iOS');

    expect(await screen.findByText('No sub-goals to schedule')).toBeTruthy();
    expect(
      screen.getByText(
        'Decompose the pursued Goal in Structure before grouping its Goals into milestones.',
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Add milestone')).toBeNull();
  });

  it('renders the sub-goals-without-milestones state with the unscheduled warning', async () => {
    await seedPursuitWithSubGoals();
    await openRoadmap('Becoming for iOS');

    expect(await screen.findByText('No milestones yet')).toBeTruthy();
    expect(
      screen.getByText(
        'Group one or more sub-goals into a checkpoint on the road to the pursued Goal.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Add milestone')).toBeTruthy();
    expect(screen.getByLabelText('Unscheduled sub-goals warning')).toBeTruthy();
    expect(screen.getByText('3 sub-goals not scheduled')).toBeTruthy();
    expect(screen.getByText(/Sub-goal B/)).toBeTruthy();
  });

  it('shows a loading state until the Roadmap resolves', async () => {
    const project = await seedProject('Becoming for iOS');
    const real = harness.services.roadmaps.getProjectRoadmap.bind(harness.services.roadmaps);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const services = overrideRoadmaps(async (projectId, options) => {
      const roadmap = await real(projectId, options);
      await gate;
      return roadmap;
    });
    await openRoadmap(project.title, services);

    expect(await screen.findByLabelText('Loading roadmap')).toBeTruthy();
    expect(screen.queryByText('No roadmap yet')).toBeNull();

    await act(async () => {
      release();
    });
    expect(await screen.findByText('No roadmap yet')).toBeTruthy();
  });

  it('shows a recoverable error state and retries the query only', async () => {
    const project = await seedProject('Becoming for iOS');
    const real = harness.services.roadmaps.getProjectRoadmap.bind(harness.services.roadmaps);
    let calls = 0;
    const services = overrideRoadmaps(async (projectId, options) => {
      calls += 1;
      if (calls === 1) throw new Error('database unavailable');
      return real(projectId, options);
    });
    await openRoadmap(project.title, services);

    expect(await screen.findByText('Roadmap unavailable')).toBeTruthy();
    expect(screen.getByText('database unavailable')).toBeTruthy();
    expect(
      screen.getByText('The Roadmap is a read model — no mutation was attempted.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading roadmap'));
    expect(await screen.findByText('No roadmap yet')).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('keeps the error state when the retry fails again', async () => {
    const project = await seedProject('Becoming for iOS');
    let calls = 0;
    const services = overrideRoadmaps(async () => {
      calls += 1;
      throw new Error(calls === 1 ? 'initially unavailable' : 'still unavailable');
    });
    await openRoadmap(project.title, services);

    expect(await screen.findByText('Roadmap unavailable')).toBeTruthy();
    expect(screen.getByText('initially unavailable')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Retry loading roadmap'));
      await Promise.resolve();
    });
    expect(await screen.findByText('still unavailable')).toBeTruthy();
    expect(screen.getByText('Roadmap unavailable')).toBeTruthy();
    expect(calls).toBe(2);
  });
});

describe('Project Roadmap segment — populated Roadmap', () => {
  it('renders ordered Milestones with nested Goal rows, counts, and emphasis', async () => {
    const { project, b, c } = await seedPursuitWithSubGoals();
    await seedFlowLabel();
    await defineGoalStates(project.id);
    await assignFlow(b.id);
    await setCurrent(project.id, b.id, 'done');
    await seedMilestone(project.id, 'Foundation', [b.id, c.id], {
      description: 'The base is in place',
      targetAt: '2026-09-30T00:00:00.000Z',
    });
    const { d } = { d: (await harness.services.goals.listGoalHistory()).find((g) => g.title === 'Sub-goal D')! };
    await seedMilestone(project.id, 'Launch', [d.id]);
    await openRoadmap('Becoming for iOS');

    // Summary comes straight from the query result's summary counts.
    expect(
      await screen.findByLabelText(
        'Roadmap summary: 0 of 2 milestones reached · 1 of 3 assigned Goals achieved',
      ),
    ).toBeTruthy();
    // Milestone cards expose position, derived completion, and next emphasis.
    expect(
      screen.getByLabelText('Milestone 1 of 2, "Foundation", 1 of 2 assigned Goals achieved, next milestone'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Milestone 2 of 2, "Launch", 0 of 1 assigned Goals achieved'),
    ).toBeTruthy();
    // Date formatting is presentation-only.
    expect(screen.getByText('Sep 30, 2026', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('No target date', { includeHiddenElements: true })).toBeTruthy();
    // Goal rows expose the snapshot-supplied status badge per Goal.
    expect(screen.getByLabelText('Sub-goal B: Complete')).toBeTruthy();
    expect(screen.getByLabelText('Sub-goal C: Unmanaged')).toBeTruthy();
    expect(screen.getByLabelText('Sub-goal D: Unmanaged')).toBeTruthy();
    // Incomplete Goals produce goal_lifecycle_unsatisfied findings, which the
    // per-Goal badges already explain — the findings card stays hidden.
    expect(screen.queryByText(/^Roadmap findings/)).toBeNull();
    // Every descendant is assigned, so no unscheduled warning appears.
    expect(screen.queryByLabelText('Unscheduled sub-goals warning')).toBeNull();
  });

  it('renders a reached Milestone and the complete-Roadmap state', async () => {
    const { project, b } = await seedPursuitWithSubGoals();
    await seedFlowLabel();
    await defineGoalStates(project.id);
    await assignFlow(b.id);
    await setCurrent(project.id, b.id, 'done');
    await seedMilestone(project.id, 'Foundation', [b.id]);
    await openRoadmap('Becoming for iOS');

    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 1 of 1 assigned Goals achieved, reached'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Roadmap complete')).toBeTruthy();
    expect(screen.getByText('Roadmap complete')).toBeTruthy();
    expect(
      screen.getByLabelText('Roadmap summary: 1 of 1 milestone reached · 1 of 1 assigned Goal achieved'),
    ).toBeTruthy();
    // The other two descendants remain unscheduled.
    expect(screen.getByText('2 sub-goals not scheduled')).toBeTruthy();
  });

  it('surfaces integrity findings supplied by the query result', async () => {
    const { project, b } = await seedPursuitWithSubGoals();
    await seedMilestone(project.id, 'Foundation', [b.id]);
    const real = harness.services.roadmaps.getProjectRoadmap.bind(harness.services.roadmaps);
    const services = overrideRoadmaps(async (projectId, options) => {
      const roadmap = await real(projectId, options);
      return {
        ...roadmap,
        findings: [...roadmap.findings, { kind: 'empty_milestone' as const, milestoneId: 'ghost' }],
      };
    });
    await openRoadmap(project.title, services);

    expect(await screen.findByText('Roadmap findings · 1')).toBeTruthy();
    expect(
      screen.getByText('A Milestone has no assigned Goals; it can never be reached.'),
    ).toBeTruthy();
  });

  it('renders only the completion the query result supplies, never a recalculated one', async () => {
    const { project, b } = await seedPursuitWithSubGoals();
    // b is unmanaged: the real Roadmap would report reached=false.
    await seedMilestone(project.id, 'Foundation', [b.id]);
    const real = harness.services.roadmaps.getProjectRoadmap.bind(harness.services.roadmaps);
    const services = overrideRoadmaps(async (projectId, options) => {
      const roadmap = await real(projectId, options);
      return {
        ...roadmap,
        milestones: roadmap.milestones.map((item) => ({ ...item, reached: true })),
        summary: { ...roadmap.summary, reachedMilestones: 1 },
      };
    });
    await openRoadmap(project.title, services);

    // Any self-derived completion would contradict the stub and fail here.
    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, reached'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Sub-goal B: Unmanaged')).toBeTruthy();
    expect(screen.getByLabelText('Roadmap complete')).toBeTruthy();
  });
});

describe('Project Roadmap segment — add flow', () => {
  it('validates the form inline and creates a Milestone on commit', async () => {
    const { b } = await seedPursuitWithSubGoals();
    await openRoadmap('Becoming for iOS');
    expect(await screen.findByText('No milestones yet')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Add milestone'));
    expect(await screen.findByText('New milestone')).toBeTruthy();

    // No Goals selected: the service's empty-list rejection becomes inline feedback.
    fireEvent.press(screen.getByLabelText('Save new milestone'));
    expect(await screen.findByText('Select at least one Goal.')).toBeTruthy();

    // A blank title is rejected even with a valid selection.
    fireEvent.press(screen.getByLabelText('Select goal Sub-goal B'));
    fireEvent.press(screen.getByLabelText('Save new milestone'));
    expect(await screen.findByText('Enter a title for this Milestone.')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Milestone title'), 'Foundation');
    fireEvent.changeText(screen.getByLabelText('Milestone target date'), '2026-09-30');
    fireEvent.press(screen.getByLabelText('Save new milestone'));

    await expectTransientToast('Milestone created');
    expect(
      await screen.findByLabelText(
        'Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Sub-goal B: Unmanaged')).toBeTruthy();
    expect(b.id).toBeTruthy();
  });

  it('rejects a malformed target date before calling the service', async () => {
    await seedPursuitWithSubGoals();
    await openRoadmap('Becoming for iOS');

    fireEvent.press(await screen.findByLabelText('Add milestone'));
    fireEvent.changeText(screen.getByLabelText('Milestone title'), 'Foundation');
    fireEvent.changeText(screen.getByLabelText('Milestone target date'), 'tomorrow');
    fireEvent.press(screen.getByLabelText('Select goal Sub-goal B'));
    fireEvent.press(screen.getByLabelText('Save new milestone'));

    expect(
      await screen.findByText('Use a date like 2026-09-30, or leave the field empty.'),
    ).toBeTruthy();
    // The sheet and draft stay exactly as they were.
    expect(screen.getByText('New milestone')).toBeTruthy();
    expect(screen.getByDisplayValue('Foundation')).toBeTruthy();
  });

  it('keeps conflicting Goals visible but disabled with an explanation', async () => {
    const { project, b } = await seedPursuitWithSubGoals();
    await seedMilestone(project.id, 'Foundation', [b.id]);
    await openRoadmap('Becoming for iOS');
    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Add milestone'));
    expect(await screen.findByText('New milestone')).toBeTruthy();

    const conflicted = screen.getByLabelText(
      'Sub-goal B, unavailable: Already assigned to "Foundation"',
    );
    expect(conflicted.props.accessibilityState).toMatchObject({ disabled: true });
    // Pressing a disabled candidate never selects it.
    fireEvent.press(conflicted);
    expect(
      screen.queryByLabelText('Deselect goal Sub-goal B'),
    ).toBeNull();
    // Unassigned descendants stay selectable.
    expect(screen.getByLabelText('Select goal Sub-goal C')).toBeTruthy();
    expect(project.id).toBeTruthy();
  });

  it('preserves the screen and draft when the mutation fails', async () => {
    await seedPursuitWithSubGoals();
    let calls = 0;
    const real = harness.services.milestones.createMilestone.bind(harness.services.milestones);
    const services: AppServices = {
      ...harness.services,
      milestones: overrideServiceMethod(
        harness.services.milestones,
        'createMilestone',
        async (command) => {
          calls += 1;
          if (calls === 1) throw new Error('database locked');
          return real(command);
        },
      ),
    };
    await openRoadmap('Becoming for iOS', services);

    fireEvent.press(await screen.findByLabelText('Add milestone'));
    fireEvent.changeText(screen.getByLabelText('Milestone title'), 'Foundation');
    fireEvent.press(screen.getByLabelText('Select goal Sub-goal B'));
    fireEvent.press(screen.getByLabelText('Save new milestone'));

    // The failure surfaces inline; the sheet, draft, and selection remain.
    expect(await screen.findByText('database locked')).toBeTruthy();
    expect(screen.getByText('New milestone')).toBeTruthy();
    expect(screen.getByDisplayValue('Foundation')).toBeTruthy();
    expect(screen.getByLabelText('Deselect goal Sub-goal B')).toBeTruthy();
    expect(screen.queryByText('✓ Milestone created')).toBeNull();

    // The same draft commits once the underlying problem is gone.
    fireEvent.press(screen.getByLabelText('Save new milestone'));
    await expectTransientToast('Milestone created');
    expect(
      await screen.findByLabelText(
        'Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone',
      ),
    ).toBeTruthy();
  });
});

describe('Project Roadmap segment — edit, remove, reorder flows', () => {
  it('edits Milestone details and membership', async () => {
    const { project, b, c } = await seedPursuitWithSubGoals();
    await seedMilestone(project.id, 'Foundation', [b.id]);
    await openRoadmap('Becoming for iOS');
    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Edit milestone Foundation'));
    expect(await screen.findByText('Edit milestone')).toBeTruthy();
    // The current membership is preselected.
    expect(screen.getByLabelText('Deselect goal Sub-goal B')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Milestone title'), 'Foundation v2');
    // Swap membership from B to C.
    fireEvent.press(screen.getByLabelText('Deselect goal Sub-goal B'));
    fireEvent.press(screen.getByLabelText('Select goal Sub-goal C'));
    fireEvent.press(screen.getByLabelText('Save milestone changes'));

    await expectTransientToast('Milestone updated');
    expect(
      await screen.findByLabelText(
        'Milestone 1 of 1, "Foundation v2", 0 of 1 assigned Goals achieved, next milestone',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Sub-goal C: Unmanaged')).toBeTruthy();
    // B left the Milestone and is now reported as unscheduled.
    expect(screen.getByText(/Sub-goal B/)).toBeTruthy();
    expect(screen.getByText('2 sub-goals not scheduled')).toBeTruthy();
    expect(c.id).toBeTruthy();
  });

  it('removes a Milestone after confirmation; its Goals stay scheduled nowhere', async () => {
    const { project, b } = await seedPursuitWithSubGoals();
    await seedMilestone(project.id, 'Foundation', [b.id]);
    await openRoadmap('Becoming for iOS');
    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove milestone Foundation'));
    expect(await screen.findByText('Remove this milestone?')).toBeTruthy();
    expect(
      screen.getByText(
        /Only the Roadmap checkpoint "Foundation" will be removed/,
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove milestone'));
    await expectTransientToast('Milestone removed');
    // The Roadmap returns to the no-milestones state; the Goal is unscheduled,
    // not deleted.
    expect(await screen.findByText('No milestones yet')).toBeTruthy();
    expect(screen.getByText('3 sub-goals not scheduled')).toBeTruthy();
    expect(screen.queryByText(/^Roadmap findings/)).toBeNull();
  });

  it('keeps the Milestone when removal is cancelled', async () => {
    const { project, b } = await seedPursuitWithSubGoals();
    await seedMilestone(project.id, 'Foundation', [b.id]);
    await openRoadmap('Becoming for iOS');
    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove milestone Foundation'));
    fireEvent.press(await screen.findByLabelText('Cancel'));

    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();
    expect(screen.queryByText('✓ Milestone removed')).toBeNull();
  });

  it('shows the rejection sheet and preserves the Roadmap when removal fails', async () => {
    const { project, b } = await seedPursuitWithSubGoals();
    await seedMilestone(project.id, 'Foundation', [b.id]);
    const services: AppServices = {
      ...harness.services,
      milestones: overrideServiceMethod(
        harness.services.milestones,
        'archiveMilestone',
        async () => {
          throw new Error('storage full');
        },
      ),
    };
    await openRoadmap('Becoming for iOS', services);
    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove milestone Foundation'));
    fireEvent.press(await screen.findByLabelText('Remove milestone'));

    expect((await screen.findAllByText('Change not allowed')).length).toBeGreaterThan(0);
    expect(screen.queryByText('✓ Milestone removed')).toBeNull();
    fireEvent.press(screen.getByLabelText('Close Change not allowed'));
    // The Roadmap is unchanged.
    expect(
      await screen.findByLabelText('Milestone 1 of 1, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();
  });

  it('reorders Milestones with the move actions', async () => {
    const { project, b, c } = await seedPursuitWithSubGoals();
    await seedMilestone(project.id, 'Foundation', [b.id]);
    await seedMilestone(project.id, 'Launch', [c.id]);
    await openRoadmap('Becoming for iOS');
    expect(
      await screen.findByLabelText('Milestone 1 of 2, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Milestone 2 of 2, "Launch", 0 of 1 assigned Goals achieved'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Move milestone Launch up'));
    await expectTransientToast('Milestones reordered');

    expect(
      await screen.findByLabelText('Milestone 1 of 2, "Launch", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Milestone 2 of 2, "Foundation", 0 of 1 assigned Goals achieved'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Move milestone Launch down'));
    await expectTransientToast('Milestones reordered');
    expect(
      await screen.findByLabelText('Milestone 1 of 2, "Foundation", 0 of 1 assigned Goals achieved, next milestone'),
    ).toBeTruthy();
  }, 15000);
});
