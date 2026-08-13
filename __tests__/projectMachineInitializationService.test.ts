import { ProjectMachineInitializationConflictError, ProjectMachineInitializationService } from '../src/application/projectMachineInitializationService';
import { createProject } from '../src/domain/project';
import { createLabel } from '../src/domain/label';
import { createWorkflowState } from '../src/domain/workflowState';
import { createWorkflowStateTransition } from '../src/domain/workflowStateTransition';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteProjectStateTransitionRepository } from '../src/persistence/projectStateTransitionRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { SqliteWorkflowStateRepository } from '../src/persistence/workflowStateRepository';
import { SqliteWorkflowStateTransitionRepository } from '../src/persistence/workflowStateTransitionRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { createTestDatabase } from './helpers/testDatabase';

const NOW = '2026-08-13T00:00:00.000Z';

describe('ProjectMachineInitializationService', () => {
  let db: SqliteDatabase;
  let ids: number;
  const projectId = 'project-1';
  const workflowId = 'workflow-1';
  const labels = ['label-project', 'label-task'];

  beforeEach(async () => {
    db = await createTestDatabase();
    ids = 0;
    await new SqliteProjectRepository(db).add(createProject({ title: 'M1' }, { id: projectId, now: NOW }));
    for (const id of labels) {
      await new SqliteLabelRepository(db).add({ ...createLabel({ name: id }), id, createdAt: NOW, updatedAt: NOW });
    }
  });
  afterEach(async () => { await db.closeAsync(); });

  function service(hooks: { afterStateCopy?: () => void; afterTransitionCopy?: () => void } = {}) {
    return new ProjectMachineInitializationService({
      applicability: { resolve: async () => ({ relation: {} as never, workflowId, version: 1 }) },
      projects: new SqliteProjectRepository(db), labels: new SqliteLabelRepository(db),
      workflowStates: new SqliteWorkflowStateRepository(db),
      workflowTransitions: new SqliteWorkflowStateTransitionRepository(db),
      unitOfWork: sqliteUnitOfWork(db),
      states: (context) => new SqliteProjectStateRepository(context),
      transitions: (context) => new SqliteProjectStateTransitionRepository(context),
      clock: { now: () => NOW }, ids: { newId: () => `copy-${++ids}` },
      afterStateCopy: hooks.afterStateCopy,
      afterTransitionCopy: hooks.afterTransitionCopy,
    });
  }

  async function templateMachine(entityType: 'project' | 'task', labelId: string, suffix: string) {
    const states = new SqliteWorkflowStateRepository(db);
    const transitions = new SqliteWorkflowStateTransitionRepository(db);
    const ready = createWorkflowState({ workflowId, entityType, labelId, title: `Ready ${suffix}`, isInitial: true, sortOrder: 1 }, { id: `source-${suffix}-ready`, now: NOW });
    const done = createWorkflowState({ workflowId, entityType, labelId, title: `Done ${suffix}`, isTerminal: true, sortOrder: 2 }, { id: `source-${suffix}-done`, now: NOW });
    await states.add(ready); await states.add(done);
    const edge = createWorkflowStateTransition({ workflowId, entityType, labelId, fromStateId: ready.id, toStateId: done.id, title: `Finish ${suffix}`, condition: 'approved', requiresExitCriteria: true }, { id: `source-${suffix}-edge`, now: NOW });
    await transitions.add(edge);
    return { ready, done, edge };
  }

  it('copies every active template machine with mapped endpoints and source provenance only', async () => {
    const projectTemplate = await templateMachine('project', labels[0], 'project');
    const taskTemplate = await templateMachine('task', labels[1], 'task');

    const result = await service().initialize({ projectId, entityType: 'task', labelId: labels[1], purpose: 'deliver' });

    expect(result).toMatchObject({ workflowId, workflowVersion: 1, idempotent: false });
    expect(result.machines).toHaveLength(2);
    const projectMachine = result.machines.find((candidate) => candidate.machine.entityType === 'project')!;
    const taskMachine = result.machines.find((candidate) => candidate.machine.entityType === 'task')!;
    expect(projectMachine.states).toEqual(expect.arrayContaining([
      expect.objectContaining({ projectId, labelId: labels[0], sourceWorkflowStateId: projectTemplate.ready.id }),
      expect.objectContaining({ projectId, labelId: labels[0], sourceWorkflowStateId: projectTemplate.done.id }),
    ]));
    const copiedTaskReady = taskMachine.states.find((state) => state.sourceWorkflowStateId === taskTemplate.ready.id)!;
    const copiedTaskDone = taskMachine.states.find((state) => state.sourceWorkflowStateId === taskTemplate.done.id)!;
    expect(taskMachine.transitions).toEqual([expect.objectContaining({
      projectId, entityType: 'task', labelId: labels[1], sourceWorkflowTransitionId: taskTemplate.edge.id,
      fromStateId: copiedTaskReady.id, toStateId: copiedTaskDone.id,
    })]);
    expect(taskMachine.transitions[0].fromStateId).not.toBe(taskTemplate.ready.id);
  });

  it.each([
    ['state', { afterStateCopy: () => { throw new Error('state-copy-fault'); } }],
    ['transition', { afterTransitionCopy: () => { throw new Error('transition-copy-fault'); } }],
  ])('rolls back every machine when the %s copy stage fails', async (_stage, hooks) => {
    await templateMachine('project', labels[0], 'project');
    await templateMachine('task', labels[1], 'task');
    await expect(service(hooks).initialize({ projectId, entityType: 'task', labelId: labels[1], purpose: 'deliver' })).rejects.toThrow(/copy-fault/);
    expect(await db.getAllAsync('SELECT id FROM project_states')).toEqual([]);
    expect(await db.getAllAsync('SELECT id FROM project_state_transitions')).toEqual([]);
  });

  it('uses complete source-provenance identity for retry idempotency and rejects partial target machines', async () => {
    const source = await templateMachine('task', labels[1], 'task');
    const initializer = service();
    const first = await initializer.initialize({ projectId, entityType: 'task', labelId: labels[1], purpose: 'deliver' });
    const retry = await initializer.initialize({ projectId, entityType: 'task', labelId: labels[1], purpose: 'deliver' });
    expect(retry).toMatchObject({ idempotent: true, machines: [{ states: first.machines[0].states, transitions: first.machines[0].transitions }] });

    await new SqliteProjectStateTransitionRepository(db).save({
      ...first.machines[0].transitions[0], archivedAt: NOW, updatedAt: NOW,
    });
    await expect(initializer.initialize({ projectId, entityType: 'task', labelId: labels[1], purpose: 'deliver' })).rejects.toBeInstanceOf(ProjectMachineInitializationConflictError);
    expect(source.ready.title).toBe('Ready task');
  });

  it('leaves copies untouched when source templates are later edited', async () => {
    const source = await templateMachine('task', labels[1], 'task');
    const result = await service().initialize({ projectId, entityType: 'task', labelId: labels[1], purpose: 'deliver' });
    const copied = result.machines[0].states.find((state) => state.sourceWorkflowStateId === source.ready.id)!;
    await new SqliteWorkflowStateRepository(db).save({ ...source.ready, title: 'Changed later', updatedAt: '2026-08-13T01:00:00.000Z' });
    expect((await new SqliteProjectStateRepository(db).getById(copied.id))?.title).toBe('Ready task');
  });
});
