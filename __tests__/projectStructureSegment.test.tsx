import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Goal } from '../src/domain/goal';
import type { Project } from '../src/domain/project';
import type { Task } from '../src/domain/task';
import { decompositionMetadata } from '../src/domain/decompositionPolicy';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import type { AppServices } from '../src/ui/composition/appServices';
import { DECOMPOSITION_MANAGEMENT_LABEL_ID } from '../src/ui/projects/structure/structureTree';
import type { StructureNodeRef } from '../src/ui/projects/structure/structureTree';
import { seedDecompositionGuidance } from './helpers/decompositionGuidance';
import { expectTransientToast, overrideServiceMethod } from './helpers/goalScreenHarness';
import { renderPlanningApp } from './helpers/projectScreenHarness';
import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';

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

function decompose(projectId: string, parent: StructureNodeRef, child: StructureNodeRef) {
  return harness.services.decomposition.create({
    projectId,
    parentType: parent.type,
    parentId: parent.id,
    childType: child.type,
    childId: child.id,
    managementLabelId: DECOMPOSITION_MANAGEMENT_LABEL_ID,
    actor: 'test',
  });
}

/** Render the full app (the production wiring) and open the Project's Structure segment. */
async function openStructure(projectTitle: string, services: AppServices = harness.services) {
  renderPlanningApp(services);
  fireEvent.press(screen.getByLabelText('Projects tab'));
  fireEvent.press(await screen.findByLabelText(`Open project ${projectTitle}`));
  await screen.findByText('Execution context');
  fireEvent.press(screen.getByLabelText('Show structure'));
}

async function seedNestedTree() {
  const project = await seedProject('Beta rollout');
  await seedDecompositionGuidance(harness.db, project.id);
  const root = await seedGoal('Root goal');
  const branch = await seedGoal('Branch goal');
  const leaf = await seedGoal('Leaf goal');
  const taskOne = await seedTask('Task one');
  const taskTwo = await seedTask('Task two');
  await pursue(project.id, root.id);
  await pursue(project.id, branch.id);
  await pursue(project.id, leaf.id);
  await join(project.id, taskOne.id);
  await join(project.id, taskTwo.id);
  await decompose(project.id, { type: 'goal', id: root.id }, { type: 'goal', id: branch.id });
  await decompose(project.id, { type: 'goal', id: root.id }, { type: 'task', id: taskOne.id });
  await decompose(project.id, { type: 'goal', id: branch.id }, { type: 'goal', id: leaf.id });
  await decompose(project.id, { type: 'task', id: taskOne.id }, { type: 'task', id: taskTwo.id });
  return { project, root, branch, leaf, taskOne, taskTwo };
}

describe('Project Structure segment — rendering', () => {
  it('shows the explicit empty state and routes Pursue a Goal through the #134 flow', async () => {
    const project = await seedProject('Beta rollout');
    await seedGoal('Ship the beta');
    await openStructure(project.title);

    expect(await screen.findByText('No structure yet')).toBeTruthy();
    expect(
      screen.getByText('A pursued Goal becomes the root of this Project hierarchy.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Add pursued goals'));
    fireEvent.press(await screen.findByLabelText('Ship the beta'));
    fireEvent.press(screen.getByLabelText('Pursue selected goals'));
    await expectTransientToast('Pursuit started');

    // The pursued Goal becomes the tree root — no fabricated hierarchy root.
    expect(await screen.findByLabelText('Open goal Ship the beta')).toBeTruthy();
    expect(screen.queryByText('No structure yet')).toBeNull();
  });

  it('renders a root-only structure: type text, add-child action, no toggle, no truncation note', async () => {
    const project = await seedProject('Beta rollout');
    await seedDecompositionGuidance(harness.db, project.id);
    const root = await seedGoal('Ship the beta');
    await pursue(project.id, root.id);
    await openStructure(project.title);

    expect(await screen.findByLabelText('Open goal Ship the beta')).toBeTruthy();
    expect(screen.getByText('GOAL', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByLabelText('Collapse Ship the beta')).toBeNull();
    expect(screen.getByLabelText('Add a child to Ship the beta')).toBeTruthy();
    expect(screen.queryByText(/Traversal reached the display limit/)).toBeNull();
    expect(screen.queryByText('Structure findings')).toBeNull();
  });

  it('renders a deeply nested mixed Goal/Task tree deterministically with inspect-only lifecycle badges', async () => {
    await seedNestedTree();
    await openStructure('Beta rollout');

    const tree = await screen.findByLabelText('Project structure');
    const opened = within(tree)
      .getAllByLabelText(/^Open (goal|task) /)
      .map((element) => element.props.accessibilityLabel as string);
    expect([...opened].sort()).toEqual(
      [
        'Open goal Branch goal',
        'Open goal Leaf goal',
        'Open goal Root goal',
        'Open task Task one',
        'Open task Task two',
      ].sort(),
    );
    // Depth-first nesting: every parent renders before its child.
    expect(opened.indexOf('Open goal Root goal')).toBeLessThan(opened.indexOf('Open goal Branch goal'));
    expect(opened.indexOf('Open goal Branch goal')).toBeLessThan(opened.indexOf('Open goal Leaf goal'));
    expect(opened.indexOf('Open task Task one')).toBeLessThan(opened.indexOf('Open task Task two'));
    // Type text and snapshot-derived Task lifecycle badges (inspect-only).
    expect(within(tree).getAllByText('GOAL', { includeHiddenElements: true })).toHaveLength(3);
    expect(within(tree).getAllByText('TASK', { includeHiddenElements: true })).toHaveLength(2);
    expect(within(tree).getAllByLabelText('Unmanaged')).toHaveLength(2);
    // Re-render is deterministic.
    const again = within(screen.getByLabelText('Project structure'))
      .getAllByLabelText(/^Open (goal|task) /)
      .map((element) => element.props.accessibilityLabel as string);
    expect(again).toEqual(opened);
  });

  it('navigates rows to the Goal and Task details on their own destinations', async () => {
    await seedNestedTree();
    await openStructure('Beta rollout');

    fireEvent.press(await screen.findByLabelText('Open task Task two'));
    expect(await screen.findByText('Executable work')).toBeTruthy();

    // The Projects destination kept its detail stack; the segment remounts.
    fireEvent.press(screen.getByLabelText('Projects tab'));
    await screen.findByText('Execution context');
    fireEvent.press(screen.getByLabelText('Show structure'));
    fireEvent.press(await screen.findByLabelText('Open goal Leaf goal'));
    expect(await screen.findByText('Intended outcome')).toBeTruthy();
  });
});

describe('Project Structure segment — expansion state', () => {
  it('keeps a collapsed branch collapsed across add-child, end-edge, and refresh', async () => {
    const { project, root } = await seedNestedTree();
    const taskThree = await seedTask('Task three');
    await join(project.id, taskThree.id);
    await openStructure('Beta rollout');

    await screen.findByLabelText('Open goal Leaf goal');
    fireEvent.press(screen.getByLabelText('Collapse Branch goal'));
    expect(screen.queryByLabelText('Open goal Leaf goal')).toBeNull();
    expect(screen.getByLabelText('Open goal Branch goal')).toBeTruthy();

    // Add a child elsewhere through the UI; the collapsed branch stays collapsed.
    fireEvent.press(screen.getByLabelText('Add a child to Task one'));
    fireEvent.press(await screen.findByLabelText('Choose Task three'));
    await expectTransientToast('Child added');
    expect(await screen.findByLabelText('Open task Task three')).toBeTruthy();
    expect(screen.queryByLabelText('Open goal Leaf goal')).toBeNull();

    // End another edge; the collapsed branch still stays collapsed.
    fireEvent.press(screen.getByLabelText('End decomposition of Task one'));
    fireEvent.press(await screen.findByLabelText('End decomposition'));
    await expectTransientToast('Decomposition ended');
    expect(screen.queryByLabelText('Open task Task one')).toBeNull();
    expect(screen.queryByLabelText('Open goal Leaf goal')).toBeNull();

    // The preserved branch expands again on demand.
    fireEvent.press(screen.getByLabelText('Expand Branch goal'));
    expect(await screen.findByLabelText('Open goal Leaf goal')).toBeTruthy();

    // Sanity: only the ended edge left the committed structure.
    const rootChildren = await harness.services.decompositionQueries.listDirectChildren(
      project.id,
      { type: 'goal', id: root.id },
    );
    expect(rootChildren.edges).toHaveLength(1);
    expect(rootChildren.edges[0].child).toEqual({ type: 'goal', id: expect.any(String) });
  }, 20000);
});

describe('Project Structure segment — mutations', () => {
  async function seedRootWithChildren() {
    const project = await seedProject('Beta rollout');
    await seedDecompositionGuidance(harness.db, project.id);
    const root = await seedGoal('Root goal');
    const sub = await seedGoal('Sub-goal');
    const taskOne = await seedTask('Task one');
    const taskTwo = await seedTask('Task two');
    await pursue(project.id, root.id);
    await pursue(project.id, sub.id);
    await join(project.id, taskOne.id);
    await join(project.id, taskTwo.id);
    return { project, root, sub, taskOne, taskTwo };
  }

  it('commits a Goal->Goal child with the in-context direction explanation', async () => {
    const { project, root, sub } = await seedRootWithChildren();
    await openStructure(project.title);

    fireEvent.press(await screen.findByLabelText('Add a child to Root goal'));
    expect(await screen.findByText(/A Goal may contain a Goal or a Task\./)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Choose Sub-goal'));
    await expectTransientToast('Child added');
    expect(await screen.findByLabelText('Open goal Sub-goal')).toBeTruthy();

    const children = await harness.services.decompositionQueries.listDirectChildren(
      project.id,
      { type: 'goal', id: root.id },
    );
    expect(children.edges.map((edge) => edge.child.id)).toEqual([sub.id]);
  });

  it('commits a Goal->Task child and refreshes the Project activity on the Overview', async () => {
    const { project, root, taskOne } = await seedRootWithChildren();
    await openStructure(project.title);

    fireEvent.press(await screen.findByLabelText('Add a child to Root goal'));
    fireEvent.press(await screen.findByLabelText('Choose Task one'));
    await expectTransientToast('Child added');
    expect(await screen.findByLabelText('Open task Task one')).toBeTruthy();

    const children = await harness.services.decompositionQueries.listDirectChildren(
      project.id,
      { type: 'goal', id: root.id },
    );
    expect(children.edges.map((edge) => edge.child.id)).toEqual([taskOne.id]);

    // The Project's persisted activity refreshed on the Overview.
    fireEvent.press(screen.getByLabelText('Show overview'));
    expect(
      (await screen.findAllByText('A relationship became active')).length,
    ).toBeGreaterThan(0);
  });

  it('commits a Task->Task child with the Task-parent direction explanation', async () => {
    const { project, root, taskOne, taskTwo } = await seedRootWithChildren();
    await decompose(project.id, { type: 'goal', id: root.id }, { type: 'task', id: taskOne.id });
    await openStructure(project.title);

    fireEvent.press(await screen.findByLabelText('Add a child to Task one'));
    expect(await screen.findByText(/A Task may only contain another Task\./)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Choose Task two'));
    await expectTransientToast('Child added');
    expect(await screen.findByLabelText('Open task Task two')).toBeTruthy();

    const children = await harness.services.decompositionQueries.listDirectChildren(
      project.id,
      { type: 'task', id: taskOne.id },
    );
    expect(children.edges.map((edge) => edge.child.id)).toEqual([taskTwo.id]);
  });

  it('ends an edge with a confirmation that preserves both entities and the historical relation', async () => {
    const { project, root, branch } = await seedNestedTree();
    await openStructure(project.title);

    fireEvent.press(await screen.findByLabelText('End decomposition of Branch goal'));
    expect(await screen.findByText('End this decomposition?')).toBeTruthy();
    expect(
      screen.getByText(
        `"Root goal" will no longer contain "Branch goal" in this Project. ` +
          'Only the active connection ends — both items and their past relationship remain in history.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('End decomposition'));
    await expectTransientToast('Decomposition ended');
    // Only the active edge ended: the still-pursued Branch goal remains
    // visible (now as a root), and its own branch is intact.
    expect(await screen.findByLabelText('Open goal Branch goal')).toBeTruthy();
    expect(screen.getByLabelText('Open goal Leaf goal')).toBeTruthy();
    expect(screen.queryByLabelText('End decomposition of Branch goal')).toBeNull();

    // The endpoints survive and the historical relation is retained.
    expect(await harness.services.goals.getGoal(branch.id)).not.toBeNull();
    expect(await harness.services.goals.getGoal(root.id)).not.toBeNull();
    const current = await harness.services.decompositionQueries.listDirectChildren(
      project.id,
      { type: 'goal', id: root.id },
    );
    expect(
      current.edges.filter((edge) => edge.child.type === 'goal' && edge.child.id === branch.id),
    ).toHaveLength(0);
    const history = await harness.services.decompositionQueries.listDirectChildren(
      project.id,
      { type: 'goal', id: root.id },
      { includeEnded: true },
    );
    const ended = history.edges.filter(
      (edge) => edge.child.type === 'goal' && edge.child.id === branch.id,
    );
    expect(ended).toHaveLength(1);
    expect(ended[0].validUntil).not.toBeNull();
  });
});

describe('Project Structure segment — rejections', () => {
  it('keeps rejected add-child candidates visible with distinct reasons', async () => {
    const project = await seedProject('Beta rollout');
    await seedDecompositionGuidance(harness.db, project.id);
    const root = await seedGoal('Root goal');
    const directChild = await seedGoal('Direct child');
    const nestedChild = await seedGoal('Nested child');
    const archived = await seedGoal('Archived goal');
    const outside = await seedGoal('Outside goal');
    const member = await seedTask('Member task');
    const freeTask = await seedTask('Free task');
    const outsideTask = await seedTask('Outside task');
    await pursue(project.id, root.id);
    await pursue(project.id, directChild.id);
    await pursue(project.id, nestedChild.id);
    await pursue(project.id, archived.id);
    await join(project.id, member.id);
    await join(project.id, freeTask.id);
    await harness.services.goals.archiveGoal(archived.id, 'test');
    await decompose(project.id, { type: 'goal', id: root.id }, { type: 'goal', id: directChild.id });
    await decompose(project.id, { type: 'goal', id: directChild.id }, { type: 'goal', id: nestedChild.id });
    // The Task parent must sit inside the tree for its add-child action to exist.
    await decompose(project.id, { type: 'goal', id: root.id }, { type: 'task', id: member.id });
    await openStructure(project.title);

    fireEvent.press(await screen.findByLabelText('Add a child to Root goal'));
    expect(await screen.findByLabelText('Root goal, unavailable: An item cannot contain itself')).toBeTruthy();
    expect(screen.getByLabelText('Direct child, unavailable: Duplicate active relationship')).toBeTruthy();
    expect(screen.getByLabelText('Nested child, unavailable: Already in this structure')).toBeTruthy();
    expect(screen.getByLabelText('Archived goal, unavailable: Archived endpoint')).toBeTruthy();
    expect(screen.getByLabelText('Outside goal, unavailable: Cross-Project structure')).toBeTruthy();
    expect(screen.getByLabelText('Member task, unavailable: Duplicate active relationship')).toBeTruthy();
    expect(screen.getByLabelText('Outside task, unavailable: Cross-Project structure')).toBeTruthy();
    expect(screen.getByLabelText('Choose Free task')).toBeTruthy();

    // Under a Task parent, Goals are an invalid direction.
    fireEvent.press(screen.getByLabelText('Close Add a child to Root goal'));
    fireEvent.press(await screen.findByLabelText('Add a child to Member task'));
    expect(await screen.findByText(/A Task may only contain another Task\./)).toBeTruthy();
    expect(
      await screen.findByLabelText('Direct child, unavailable: Invalid direction'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Choose Free task')).toBeTruthy();
  });

  it('shows the rejection sheet on commit-time failure, preserves the selection, and succeeds on retry', async () => {
    const project = await seedProject('Beta rollout');
    await seedDecompositionGuidance(harness.db, project.id);
    const root = await seedGoal('Root goal');
    const sub = await seedGoal('Sub-goal');
    await pursue(project.id, root.id);
    await pursue(project.id, sub.id);

    let attempts = 0;
    const services = {
      ...harness.services,
      decomposition: overrideServiceMethod(
        harness.services.decomposition,
        'create',
        async (command: Parameters<typeof harness.services.decomposition.create>[0]) => {
          attempts += 1;
          if (attempts === 1) {
            throw Object.assign(new Error('would cycle'), { name: 'DecompositionCycleError' });
          }
          return harness.services.decomposition.create(command);
        },
      ),
    };
    await openStructure(project.title, services);

    fireEvent.press(await screen.findByLabelText('Add a child to Root goal'));
    fireEvent.press(await screen.findByLabelText('Choose Sub-goal'));

    expect(await screen.findByText('Change not allowed')).toBeTruthy();
    expect(screen.getByText('Would create a loop')).toBeTruthy();
    // Nothing was committed and the picker selection is preserved.
    expect(screen.getByLabelText('Choose Sub-goal')).toBeTruthy();
    expect(
      await harness.services.decompositionQueries.listDirectChildren(project.id, {
        type: 'goal',
        id: root.id,
      }),
    ).toMatchObject({ edges: [] });

    fireEvent.press(screen.getByLabelText('Try again'));
    await expectTransientToast('Child added');
    expect(await screen.findByLabelText('Open goal Sub-goal')).toBeTruthy();
  });
});

describe('Project Structure segment — load states', () => {
  it('shows a recoverable error state and retries the bounded query', async () => {
    const project = await seedProject('Beta rollout');
    await seedDecompositionGuidance(harness.db, project.id);
    const root = await seedGoal('Root goal');
    await pursue(project.id, root.id);

    const original = harness.services.decompositionQueries.findDescendants.bind(
      harness.services.decompositionQueries,
    );
    let calls = 0;
    const services = {
      ...harness.services,
      decompositionQueries: overrideServiceMethod(
        harness.services.decompositionQueries,
        'findDescendants',
        async (
          projectId: string,
          rootNode: StructureNodeRef,
          options?: Parameters<typeof original>[2],
        ) => {
          calls += 1;
          if (calls === 1) throw new Error('database unavailable');
          return original(projectId, rootNode, options);
        },
      ),
    };
    await openStructure(project.title, services);

    expect(await screen.findByText('Structure unavailable')).toBeTruthy();
    expect(screen.getByText('database unavailable')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Retry loading structure'));
    expect(await screen.findByLabelText('Open goal Root goal')).toBeTruthy();
  });

  it('shows truncation guidance only when the bounded query reports truncation', async () => {
    const project = await seedProject('Beta rollout');
    await seedDecompositionGuidance(harness.db, project.id);
    const root = await seedGoal('Root goal');
    const child = await seedGoal('Child goal');
    await pursue(project.id, root.id);
    await pursue(project.id, child.id);
    await decompose(project.id, { type: 'goal', id: root.id }, { type: 'goal', id: child.id });

    const original = harness.services.decompositionQueries.findDescendants.bind(
      harness.services.decompositionQueries,
    );
    const services = {
      ...harness.services,
      decompositionQueries: overrideServiceMethod(
        harness.services.decompositionQueries,
        'findDescendants',
        async (
          projectId: string,
          rootNode: StructureNodeRef,
          options?: Parameters<typeof original>[2],
        ) => {
          const result = await original(projectId, rootNode, options);
          return {
            ...result,
            truncation: { ...result.truncation, truncated: true, nodeLimitReached: true },
          };
        },
      ),
    };
    await openStructure(project.title, services);

    expect(
      await screen.findByText(
        'Traversal reached the display limit (node limit 1000). Some branches are not shown — the tree below is incomplete.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Partial structure warning')).toBeTruthy();
    // The partial tree is still rendered beneath the warning.
    expect(screen.getByLabelText('Open goal Child goal')).toBeTruthy();
  });
});

describe('Project Structure segment — integrity findings', () => {
  it('shows a missing endpoint as an unopenable row plus a finding', async () => {
    const project = await seedProject('Beta rollout');
    await seedDecompositionGuidance(harness.db, project.id);
    const root = await seedGoal('Root goal');
    await pursue(project.id, root.id);
    await new SqliteRelationRepository(harness.db).add({
      id: 'corrupt-edge',
      sourceType: 'goal',
      sourceId: root.id,
      relationType: 'decomposes',
      targetType: 'goal',
      targetId: 'ghost-goal',
      metadata: decompositionMetadata(project.id),
      createdAt: '2026-08-14T00:00:00.000Z',
      endedAt: null,
    });
    await openStructure(project.title);

    expect(await screen.findByLabelText('Missing endpoint, unavailable')).toBeTruthy();
    expect(screen.getByText('Structure findings')).toBeTruthy();
    expect(
      screen.getByText(
        'An edge references a missing child (goal). Its row stays visible but cannot be opened.',
      ),
    ).toBeTruthy();
  });

  it('reports a stored cycle instead of looping the tree', async () => {
    const project = await seedProject('Beta rollout');
    await seedDecompositionGuidance(harness.db, project.id);
    const first = await seedGoal('First goal');
    const second = await seedGoal('Second goal');
    await pursue(project.id, first.id);
    await pursue(project.id, second.id);
    const relations = new SqliteRelationRepository(harness.db);
    await relations.add({
      id: 'cycle-a',
      sourceType: 'goal',
      sourceId: first.id,
      relationType: 'decomposes',
      targetType: 'goal',
      targetId: second.id,
      metadata: decompositionMetadata(project.id),
      createdAt: '2026-08-14T00:00:00.000Z',
      endedAt: null,
    });
    await relations.add({
      id: 'cycle-b',
      sourceType: 'goal',
      sourceId: second.id,
      relationType: 'decomposes',
      targetType: 'goal',
      targetId: first.id,
      metadata: decompositionMetadata(project.id),
      createdAt: '2026-08-14T00:01:00.000Z',
      endedAt: null,
    });
    await openStructure(project.title);

    expect(
      await screen.findAllByText(
        'A cycle was detected in the stored structure; the loop is not expanded.',
      ),
    ).not.toHaveLength(0);
    // Both pursued Goals render as roots; the loop is not infinitely expanded.
    expect((await screen.findAllByLabelText('Open goal First goal')).length).toBeGreaterThan(0);
  });
});
