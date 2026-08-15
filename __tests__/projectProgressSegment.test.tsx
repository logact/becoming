import { act, fireEvent, screen } from '@testing-library/react-native';

import type { Goal } from '../src/domain/goal';
import type { Project } from '../src/domain/project';
import type { Task } from '../src/domain/task';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import { createEntityLabelAssignment } from '../src/domain/entityLabel';
import { createLabel } from '../src/domain/label';
import { createProjectEntityState } from '../src/domain/projectEntityState';
import { createProjectState } from '../src/domain/projectState';
import type { ProjectExecutionSnapshotOptions } from '../src/application/projectExecutionSnapshotService';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteProjectEntityStateRepository } from '../src/persistence/projectEntityStateRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import type { AppServices } from '../src/ui/composition/appServices';
import { overrideServiceMethod } from './helpers/goalScreenHarness';
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

function seedTask(title: string): Promise<Task> {
  return harness.services.tasks.createTask({
    actor: 'test',
    title,
    targetDescription: `Target for ${title}`,
  });
}

function pursue(projectId: string, goalId: string) {
  return harness.services.goalPursuit.startPursuit({ projectId, goalId, actor: 'test' });
}

function join(projectId: string, taskId: string) {
  return harness.services.taskMembership.startMembership({ projectId, taskId, actor: 'test' });
}

/** Lifecycle seeding: one 'flow' label, Project machine states, and current periods. */
async function seedFlowLabel() {
  await new SqliteLabelRepository(harness.db).add({
    ...createLabel({ name: 'Flow' }),
    id: LABEL_ID,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function assignFlow(entityType: 'goal' | 'task', entityId: string) {
  return new SqliteEntityLabelRepository(harness.db).add(
    createEntityLabelAssignment(
      { entityType, entityId, labelId: LABEL_ID },
      { id: `assign-${entityType}-${entityId}`, now: NOW },
    ),
  );
}

function defineState(
  projectId: string,
  entityType: 'goal' | 'task',
  title: string,
  settings: { isInitial?: boolean; isTerminal?: boolean; category?: string } = {},
) {
  return new SqliteProjectStateRepository(harness.db).add(
    createProjectState(
      { projectId, entityType, labelId: LABEL_ID, title, ...settings },
      { id: `state-${entityType}-${title.toLowerCase()}`, now: NOW },
    ),
  );
}

function setCurrent(
  projectId: string,
  entityType: 'goal' | 'task',
  entityId: string,
  stateTitle: string,
) {
  return new SqliteProjectEntityStateRepository(harness.db).add(
    createProjectEntityState(
      {
        projectId,
        entityType,
        entityId,
        labelId: LABEL_ID,
        projectStateId: `state-${entityType}-${stateTitle.toLowerCase()}`,
        enteredAt: NOW,
      },
      { id: `period-${entityType}-${entityId}`, now: NOW },
    ),
  );
}

/** A stored decomposition edge, inserted directly like the application tests do. */
function seedEdge(
  projectId: string,
  parent: { type: 'goal' | 'task'; id: string },
  child: { type: 'goal' | 'task'; id: string },
  id: string,
  createdAt: string = NOW,
) {
  return new SqliteRelationRepository(harness.db).add({
    id,
    sourceType: parent.type,
    sourceId: parent.id,
    relationType: 'decomposes',
    targetType: child.type,
    targetId: child.id,
    metadata: decompositionMetadata(projectId),
    createdAt,
    endedAt: null,
  });
}

/** Render the full app (the production wiring) and open the Project's Progress segment. */
async function openProgress(projectTitle: string, services: AppServices = harness.services) {
  renderPlanningApp(services);
  fireEvent.press(screen.getByLabelText('Projects tab'));
  fireEvent.press(await screen.findByLabelText(`Open project ${projectTitle}`));
  await screen.findByText('Execution context');
  fireEvent.press(screen.getByLabelText('Show progress'));
}

describe('Project Progress segment — snapshot fixtures', () => {
  it('renders an empty Project as an explicit zero denominator, never 0%', async () => {
    await seedProject('Beta rollout');
    await openProgress('Beta rollout');

    expect(
      await screen.findByLabelText('Derived progress: not measurable yet, 0 complete of 0 measurable'),
    ).toBeTruthy();
    expect(screen.getByText('Not measurable yet', { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getByText('0 complete of 0 measurable', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByText(/No percentage is shown for a zero denominator\./, {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    // No percentage anywhere — the zero denominator is never a failure.
    expect(screen.queryByText(/%/, { includeHiddenElements: true })).toBeNull();
    // All six required categories (plus the no-machine row) read zero.
    for (const label of ['Complete', 'Incomplete', 'Blocked', 'Unmanaged', 'Uninitialized', 'Invalid']) {
      expect(screen.getByLabelText(`${label}: 0`)).toBeTruthy();
    }
    expect(screen.getByLabelText('No machine: 0')).toBeTruthy();
    expect(screen.queryByText(/^Work findings/)).toBeNull();
    expect(screen.queryByText(/^Integrity findings/)).toBeNull();
  });

  it('keeps unmanaged work outside the denominator of a zero-denominator Project', async () => {
    const project = await seedProject('Beta rollout');
    const task = await seedTask('Solo task');
    await join(project.id, task.id);
    await openProgress(project.title);

    expect(
      await screen.findByLabelText('Derived progress: not measurable yet, 0 complete of 0 measurable'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Unmanaged: 1')).toBeTruthy();
    expect(screen.queryByText(/%/, { includeHiddenElements: true })).toBeNull();
    // The snapshot's disconnected-Task integrity finding is surfaced as supplied.
    expect(screen.getByText('Integrity findings · 1')).toBeTruthy();
    expect(
      screen.getByText(
        'A member Task is not connected to the decomposition structure; it still counts as Project work.',
      ),
    ).toBeTruthy();
  });

  it('renders a mixed Project: exact fraction, all six categories, deterministic findings', async () => {
    const project = await seedProject('Beta rollout');
    await seedFlowLabel();
    await defineState(project.id, 'goal', 'Doing', { isInitial: true });
    await defineState(project.id, 'goal', 'Done', { isTerminal: true });
    await defineState(project.id, 'task', 'Doing', { isInitial: true });
    await defineState(project.id, 'task', 'Done', { isTerminal: true });
    await defineState(project.id, 'task', 'Blocked', { category: 'blocked' });

    const complete = await seedGoal('Root goal');
    const waiting = await seedGoal('Goal waiting');
    const loopA = await seedGoal('Loop A');
    const loopB = await seedGoal('Loop B');
    const doing = await seedTask('Task doing');
    const blocked = await seedTask('Task blocked');
    const free = await seedTask('Task free');
    const taskWaiting = await seedTask('Task waiting');
    for (const goal of [complete, waiting, loopA, loopB]) await pursue(project.id, goal.id);
    for (const task of [doing, blocked, free, taskWaiting]) await join(project.id, task.id);
    for (const entity of [complete, waiting, loopA, loopB]) await assignFlow('goal', entity.id);
    for (const entity of [doing, blocked, taskWaiting]) await assignFlow('task', entity.id);
    await setCurrent(project.id, 'goal', complete.id, 'Done');
    await setCurrent(project.id, 'goal', loopA.id, 'Doing');
    await setCurrent(project.id, 'goal', loopB.id, 'Doing');
    await setCurrent(project.id, 'task', doing.id, 'Doing');
    await setCurrent(project.id, 'task', blocked.id, 'Blocked');
    // A stored cycle marks both loop Goals invalid via snapshot findings.
    await seedEdge(project.id, { type: 'goal', id: loopA.id }, { type: 'goal', id: loopB.id }, 'cycle-a');
    await seedEdge(
      project.id,
      { type: 'goal', id: loopB.id },
      { type: 'goal', id: loopA.id },
      'cycle-b',
      '2026-08-14T00:01:00.000Z',
    );
    await openProgress(project.title);

    // Numerator, denominator, and derived percentage straight from the snapshot.
    expect(
      await screen.findByLabelText('Derived progress: 33.3 percent, 1 complete of 3 measurable'),
    ).toBeTruthy();
    expect(screen.getByText('33.3%', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('1 complete of 3 measurable', { includeHiddenElements: true })).toBeTruthy();
    // All six required categories, split measurably inside vs outside the denominator.
    expect(screen.getByText('Measurable work')).toBeTruthy();
    expect(screen.getByText('Outside the measurable denominator')).toBeTruthy();
    expect(screen.getByLabelText('Complete: 1')).toBeTruthy();
    expect(screen.getByLabelText('Incomplete: 1')).toBeTruthy();
    expect(screen.getByLabelText('Blocked: 1')).toBeTruthy();
    expect(screen.getByLabelText('Unmanaged: 1')).toBeTruthy();
    expect(screen.getByLabelText('No machine: 0')).toBeTruthy();
    expect(screen.getByLabelText('Uninitialized: 2')).toBeTruthy();
    expect(screen.getByLabelText('Invalid: 2')).toBeTruthy();

    // Affected-work findings: the two invalid loop Goals and the two uninitialized nodes.
    expect(screen.getByText('Work findings · 4')).toBeTruthy();
    const expectedOrder = [
      { key: `goal:${loopA.id}`, label: `Open goal ${loopA.title}` },
      { key: `goal:${loopB.id}`, label: `Open goal ${loopB.title}` },
      { key: `goal:${waiting.id}`, label: `Open goal ${waiting.title}` },
      { key: `task:${taskWaiting.id}`, label: `Open task ${taskWaiting.title}` },
    ]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((entry) => entry.label);
    const actualOrder = screen
      .getAllByLabelText(/^Open (goal|task) /)
      .map((element) => element.props.accessibilityLabel as string);
    expect(actualOrder).toEqual(expectedOrder);
    // Concise reasons, and the lifecycle state badge when the snapshot supplies one.
    // (The loop Goals carry both the cycle and overlapping-root snapshot reasons.)
    expect(
      screen.getAllByText(/The decomposition structure contains a cycle/, {
        includeHiddenElements: true,
      }),
    ).toHaveLength(2);
    expect(
      screen.getAllByText('The machine has no current state for this work yet', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(2);
    expect(screen.getAllByLabelText('Doing', { includeHiddenElements: true })).toHaveLength(2);
    // Hierarchy findings supplied by the snapshot are surfaced too.
    expect(
      screen.getAllByText('A cycle was detected in the stored structure; the loop is not expanded.')
        .length,
    ).toBeGreaterThan(0);
  });

  it('renders a fully complete Project as 100% with no findings', async () => {
    const project = await seedProject('Beta rollout');
    await seedFlowLabel();
    await defineState(project.id, 'goal', 'Doing', { isInitial: true });
    await defineState(project.id, 'goal', 'Done', { isTerminal: true });
    await defineState(project.id, 'task', 'Doing', { isInitial: true });
    await defineState(project.id, 'task', 'Done', { isTerminal: true });
    const root = await seedGoal('Root goal');
    const task = await seedTask('Only task');
    await pursue(project.id, root.id);
    await join(project.id, task.id);
    await assignFlow('goal', root.id);
    await assignFlow('task', task.id);
    await setCurrent(project.id, 'goal', root.id, 'Done');
    await setCurrent(project.id, 'task', task.id, 'Done');
    await seedEdge(project.id, { type: 'goal', id: root.id }, { type: 'task', id: task.id }, 'edge-1');
    await openProgress(project.title);

    expect(
      await screen.findByLabelText('Derived progress: 100 percent, 2 complete of 2 measurable'),
    ).toBeTruthy();
    expect(screen.getByText('100%', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Complete: 2')).toBeTruthy();
    expect(screen.getByLabelText('Incomplete: 0')).toBeTruthy();
    expect(screen.getByLabelText('Blocked: 0')).toBeTruthy();
    expect(screen.getByLabelText('Unmanaged: 0')).toBeTruthy();
    expect(screen.getByLabelText('Uninitialized: 0')).toBeTruthy();
    expect(screen.getByLabelText('Invalid: 0')).toBeTruthy();
    expect(screen.queryByText(/^Work findings/)).toBeNull();
    expect(screen.queryByText(/^Integrity findings/)).toBeNull();
  });

  it('surfaces a traversal-truncation finding supplied by the snapshot', async () => {
    const project = await seedProject('Beta rollout');
    const root = await seedGoal('Root goal');
    await pursue(project.id, root.id);
    const real = harness.services.executionSnapshots.getSnapshot.bind(
      harness.services.executionSnapshots,
    );
    const services = {
      ...harness.services,
      executionSnapshots: overrideServiceMethod(
        harness.services.executionSnapshots,
        'getSnapshot',
        async (projectId: string, options?: ProjectExecutionSnapshotOptions) => {
          const snapshot = await real(projectId, options);
          return {
            ...snapshot,
            findings: [
              ...snapshot.findings,
              {
                kind: 'traversal_truncated' as const,
                projectId,
                root: { type: 'goal' as const, id: root.id },
                truncation: {
                  truncated: true,
                  depthLimitReached: false,
                  nodeLimitReached: true,
                  maxDepth: 50,
                  maxNodes: 1000,
                  visitedNodeCount: 1000,
                },
              },
            ],
          };
        },
      ),
    };
    await openProgress(project.title, services);

    expect(
      await screen.findByText(
        'Traversal reached the display limit (node limit 1000). Progress may reflect a partial structure.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/^Integrity findings ·/)).toBeTruthy();
  });
});

describe('Project Progress segment — drill-in', () => {
  it('opens the read-only Goal and Task details from affected-work rows', async () => {
    const project = await seedProject('Beta rollout');
    await seedFlowLabel();
    await defineState(project.id, 'goal', 'Doing', { isInitial: true });
    await defineState(project.id, 'task', 'Doing', { isInitial: true });
    const waiting = await seedGoal('Goal waiting');
    const taskWaiting = await seedTask('Task waiting');
    await pursue(project.id, waiting.id);
    await join(project.id, taskWaiting.id);
    await assignFlow('goal', waiting.id);
    await assignFlow('task', taskWaiting.id);
    await openProgress(project.title);

    fireEvent.press(await screen.findByLabelText('Open task Task waiting'));
    expect(await screen.findByText('Executable work')).toBeTruthy();
    // Lifecycle stays inspect-only on the drilled-in detail.
    expect(screen.getByText(/Lifecycle is inspect-only/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Projects tab'));
    await screen.findByText('Execution context');
    fireEvent.press(screen.getByLabelText('Show progress'));
    fireEvent.press(await screen.findByLabelText('Open goal Goal waiting'));
    expect(await screen.findByText('Intended outcome')).toBeTruthy();
  });
});

describe('Project Progress segment — load states', () => {
  it('shows a loading skeleton until the snapshot resolves', async () => {
    const project = await seedProject('Beta rollout');
    const real = harness.services.executionSnapshots.getSnapshot.bind(
      harness.services.executionSnapshots,
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const services = {
      ...harness.services,
      executionSnapshots: overrideServiceMethod(
        harness.services.executionSnapshots,
        'getSnapshot',
        async (projectId: string, options?: ProjectExecutionSnapshotOptions) => {
          const snapshot = await real(projectId, options);
          await gate;
          return snapshot;
        },
      ),
    };
    await openProgress(project.title, services);

    expect(await screen.findByLabelText('Loading progress')).toBeTruthy();
    expect(screen.queryByText(/^Work categories$/)).toBeNull();

    await act(async () => {
      release();
    });
    expect(
      await screen.findByLabelText('Derived progress: not measurable yet, 0 complete of 0 measurable'),
    ).toBeTruthy();
  });

  it('shows a Snapshot unavailable state and retries the query only', async () => {
    const project = await seedProject('Beta rollout');
    const real = harness.services.executionSnapshots.getSnapshot.bind(
      harness.services.executionSnapshots,
    );
    let calls = 0;
    const services = {
      ...harness.services,
      executionSnapshots: overrideServiceMethod(
        harness.services.executionSnapshots,
        'getSnapshot',
        async (projectId: string, options?: ProjectExecutionSnapshotOptions) => {
          calls += 1;
          if (calls === 1) throw new Error('database unavailable');
          return real(projectId, options);
        },
      ),
    };
    await openProgress(project.title, services);

    expect(await screen.findByText('Snapshot unavailable')).toBeTruthy();
    expect(screen.getByText('database unavailable')).toBeTruthy();
    expect(screen.getByText('The snapshot is a read model — no mutation was attempted.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry snapshot'));
    expect(
      await screen.findByLabelText('Derived progress: not measurable yet, 0 complete of 0 measurable'),
    ).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('keeps the Snapshot unavailable state when the retry fails again', async () => {
    const project = await seedProject('Beta rollout');
    const services = {
      ...harness.services,
      executionSnapshots: overrideServiceMethod(
        harness.services.executionSnapshots,
        'getSnapshot',
        async () => {
          throw new Error('still unavailable');
        },
      ),
    };
    await openProgress(project.title, services);

    expect(await screen.findByText('Snapshot unavailable')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Retry snapshot'));
    expect(await screen.findByText('still unavailable')).toBeTruthy();
    expect(screen.getByText('Snapshot unavailable')).toBeTruthy();
  });

  it('re-queries after a membership mutation when the segment is re-entered', async () => {
    const project = await seedProject('Beta rollout');
    await openProgress(project.title);
    expect(await screen.findByLabelText('Unmanaged: 0')).toBeTruthy();

    const task = await seedTask('Late task');
    await join(project.id, task.id);
    fireEvent.press(screen.getByLabelText('Show overview'));
    fireEvent.press(screen.getByLabelText('Show progress'));

    expect(await screen.findByLabelText('Unmanaged: 1')).toBeTruthy();
    expect(
      screen.getByLabelText('Derived progress: not measurable yet, 0 complete of 0 measurable'),
    ).toBeTruthy();
  });

  it('drops a stale snapshot response that resolves after the screen was left', async () => {
    const alpha = await seedProject('Alpha project');
    await seedProject('Beta project');
    await seedFlowLabel();
    await defineState(alpha.id, 'goal', 'Done', { isTerminal: true });
    const root = await seedGoal('Alpha goal');
    await pursue(alpha.id, root.id);
    await assignFlow('goal', root.id);
    await setCurrent(alpha.id, 'goal', root.id, 'Done');

    const real = harness.services.executionSnapshots.getSnapshot.bind(
      harness.services.executionSnapshots,
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const services = {
      ...harness.services,
      executionSnapshots: overrideServiceMethod(
        harness.services.executionSnapshots,
        'getSnapshot',
        async (projectId: string, options?: ProjectExecutionSnapshotOptions) => {
          const snapshot = await real(projectId, options);
          if (projectId === alpha.id) await gate;
          return snapshot;
        },
      ),
    };
    renderPlanningApp(services);
    fireEvent.press(screen.getByLabelText('Projects tab'));
    fireEvent.press(await screen.findByLabelText('Open project Alpha project'));
    await screen.findByText('Execution context');
    fireEvent.press(screen.getByLabelText('Show progress'));
    expect(await screen.findByLabelText('Loading progress')).toBeTruthy();

    // Leave before the slow snapshot resolves; open the other Project instead.
    fireEvent.press(screen.getByLabelText('Back to projects'));
    fireEvent.press(await screen.findByLabelText('Open project Beta project'));
    await screen.findByText('Execution context');
    fireEvent.press(screen.getByLabelText('Show progress'));
    expect(
      await screen.findByLabelText('Derived progress: not measurable yet, 0 complete of 0 measurable'),
    ).toBeTruthy();

    // The stale Alpha response arrives late and must not clobber the screen.
    await act(async () => {
      release();
    });
    expect(screen.queryByText('100%', { includeHiddenElements: true })).toBeNull();
    expect(
      screen.getByLabelText('Derived progress: not measurable yet, 0 complete of 0 measurable'),
    ).toBeTruthy();
  });

  it('reconstructs the same values from SQLite on screen re-entry', async () => {
    const project = await seedProject('Beta rollout');
    const task = await seedTask('Member task');
    await join(project.id, task.id);
    await openProgress(project.title);
    expect(await screen.findByLabelText('Unmanaged: 1')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Back to projects'));
    fireEvent.press(await screen.findByLabelText('Open project Beta rollout'));
    await screen.findByText('Execution context');
    fireEvent.press(screen.getByLabelText('Show progress'));

    expect(await screen.findByLabelText('Unmanaged: 1')).toBeTruthy();
    expect(
      screen.getByText(
        'A member Task is not connected to the decomposition structure; it still counts as Project work.',
      ),
    ).toBeTruthy();
  });
});

describe('Project Progress segment — snapshot authority guard', () => {
  it('renders only the numbers and findings the snapshot supplies, never derived ones', async () => {
    const project = await seedProject('Beta rollout');
    const task = await seedTask('Member task');
    await join(project.id, task.id);
    // The real snapshot would derive: 0/0, null percentage, unmanaged 1, and a
    // disconnected-Task finding. The stub contradicts every one of those.
    const real = harness.services.executionSnapshots.getSnapshot.bind(
      harness.services.executionSnapshots,
    );
    const services = {
      ...harness.services,
      executionSnapshots: overrideServiceMethod(
        harness.services.executionSnapshots,
        'getSnapshot',
        async (projectId: string, options?: ProjectExecutionSnapshotOptions) => {
          const snapshot = await real(projectId, options);
          return {
            ...snapshot,
            findings: [],
            progress: {
              ...snapshot.progress,
              numerator: 7,
              denominator: 11,
              percentage: 12.5,
              counts: {
                complete: 7,
                incomplete: 3,
                blocked: 1,
                unmanaged: 2,
                no_machine: 0,
                uninitialized: 4,
                invalid: 5,
              },
              findings: [],
            },
          };
        },
      ),
    };
    await openProgress(project.title, services);

    expect(
      await screen.findByLabelText('Derived progress: 12.5 percent, 7 complete of 11 measurable'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Complete: 7')).toBeTruthy();
    expect(screen.getByLabelText('Incomplete: 3')).toBeTruthy();
    expect(screen.getByLabelText('Blocked: 1')).toBeTruthy();
    expect(screen.getByLabelText('Unmanaged: 2')).toBeTruthy();
    expect(screen.getByLabelText('Uninitialized: 4')).toBeTruthy();
    expect(screen.getByLabelText('Invalid: 5')).toBeTruthy();
    // Any self-derived value would contradict the stub and fail here.
    expect(screen.queryByText('Not measurable yet', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByLabelText('Unmanaged: 1')).toBeNull();
    expect(screen.queryByText(/^Integrity findings/)).toBeNull();
    expect(
      screen.queryByText(
        'A member Task is not connected to the decomposition structure; it still counts as Project work.',
      ),
    ).toBeNull();
  });
});
