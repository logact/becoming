import { closeUiTestHarness, createUiTestHarness } from './helpers/uiTestHarness';
import type { UiTestHarness } from './helpers/uiTestHarness';
import { DEFAULT_DECOMPOSITION_MANAGEMENT_LABEL_ID } from '../src/application/defaultDecompositionGuidanceService';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import { SqliteWorkflowRepository } from '../src/persistence/workflowRepository';
import { SqliteWorkflowStateRepository } from '../src/persistence/workflowStateRepository';

let harness: UiTestHarness;

beforeEach(async () => {
  harness = await createUiTestHarness();
});

afterEach(async () => {
  await closeUiTestHarness(harness);
});

async function seedProjectRoot() {
  const root = await harness.services.goals.createGoal({
    actor: 'test',
    title: 'Root goal',
    targetState: 'Done',
  });
  const project = await harness.services.projects.createProject({
    actor: 'test',
    title: 'Beta rollout',
  });
  await harness.services.goalPursuit.startPursuit({
    projectId: project.id,
    goalId: root.id,
    actor: 'test',
  });
  return { project, root };
}

describe('ProjectStructureCreationService — atomic creation', () => {
  it('installs default decomposition guidance on first use in a normal database', async () => {
    const { project, root } = await seedProjectRoot();

    const result = await harness.services.structureCreation.createGoalChild({
      projectId: project.id,
      parentType: 'goal',
      parentId: root.id,
      managementLabelId: DEFAULT_DECOMPOSITION_MANAGEMENT_LABEL_ID,
      actor: 'test',
      goal: { title: 'Created in Structure', targetState: 'Attached' },
    });

    expect(await new SqliteLabelRepository(harness.db).getById('management'))
      .toMatchObject({ name: 'Management', archivedAt: null });
    const workflows = await new SqliteWorkflowRepository(harness.db).list({
      workflowType: 'execution',
      purpose: 'decompose',
    });
    expect(workflows).toHaveLength(1);
    const states = new SqliteWorkflowStateRepository(harness.db);
    for (const entityType of ['goal', 'task'] as const) {
      expect(await states.listActiveForMachine({
        workflowId: workflows[0].id,
        entityType,
        labelId: 'management',
      })).toHaveLength(1);
    }
    const applicability = await new SqliteRelationRepository(harness.db).listCurrent({
      source: { type: 'project', id: project.id },
      relationType: 'workflow_applies_to',
    });
    expect(applicability).toHaveLength(2);
    expect(result.decomposition.relation.targetId).toBe(result.goal.id);
  });

  it('uses the same default guidance path when attaching an existing child', async () => {
    const { project, root } = await seedProjectRoot();
    const child = await harness.services.goals.createGoal({
      actor: 'test',
      title: 'Existing child',
      targetState: 'Attached',
    });

    const result = await harness.services.structureCreation.attachExistingChild({
      projectId: project.id,
      parentType: 'goal',
      parentId: root.id,
      childType: 'goal',
      childId: child.id,
      managementLabelId: DEFAULT_DECOMPOSITION_MANAGEMENT_LABEL_ID,
      actor: 'test',
    });

    expect(result.relation.targetId).toBe(child.id);
  });

  it('rolls a new Goal back when its decomposition edge is rejected', async () => {
    const { project, root } = await seedProjectRoot();

    await expect(
      harness.services.structureCreation.createGoalChild({
        projectId: project.id,
        parentType: 'goal',
        parentId: root.id,
        managementLabelId: 'missing-guidance-label',
        actor: 'test',
        goal: { title: 'Orphan candidate', targetState: 'Never persisted' },
      }),
    ).rejects.toThrow();

    expect((await harness.services.goals.listGoalHistory()).map((goal) => goal.title))
      .toEqual(['Root goal']);
  });

  it('rolls a new Task and its membership back when decomposition is rejected', async () => {
    const { project, root } = await seedProjectRoot();

    await expect(
      harness.services.structureCreation.createTaskChild({
        projectId: project.id,
        parentType: 'goal',
        parentId: root.id,
        managementLabelId: 'missing-guidance-label',
        actor: 'test',
        task: { title: 'Orphan candidate', targetDescription: 'Never persisted' },
      }),
    ).rejects.toThrow();

    expect(await harness.services.tasks.listHistory()).toHaveLength(0);
    expect(await harness.services.taskMembershipQueries.listActiveTasksForProject(project.id))
      .toHaveLength(0);
  });
});
