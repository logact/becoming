import {
  archiveProjectStateTransition,
  createProjectStateTransition,
  updateProjectStateTransition,
} from '../src/domain/projectStateTransition';
import type { ProjectStateTransitionMachine } from '../src/domain/projectStateTransition';
import { createProjectState } from '../src/domain/projectState';
import { createWorkflowStateTransition, updateWorkflowStateTransition } from '../src/domain/workflowStateTransition';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import {
  ProjectStateTransitionDuplicateError,
  SqliteProjectStateTransitionRepository,
} from '../src/persistence/projectStateTransitionRepository';
import { SqliteWorkflowStateTransitionRepository } from '../src/persistence/workflowStateTransitionRepository';
import {
  ProjectStateTransitionEndpointArchivedError,
  ProjectStateTransitionEndpointNotFoundError,
  ProjectStateTransitionMachineMismatchError,
  ProjectStateTransitionNotFoundError,
  ProjectStateTransitionService,
} from '../src/application/projectStateTransitionService';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const CREATED = '2026-08-13T04:10:02.000Z';
const UPDATED = '2026-08-13T04:20:02.000Z';
const ARCHIVED = '2026-08-13T04:30:02.000Z';
const MACHINE: ProjectStateTransitionMachine = { projectId: 'project-a', entityType: 'task', labelId: 'label-a' };

function input() { return { ...MACHINE, fromStateId: 'state-a', toStateId: 'state-b' }; }

describe('ProjectStateTransition domain model', () => {
  it('allows an explicit self-transition policy and preserves opaque fields and optional origin', () => {
    const transition = createProjectStateTransition({ ...input(), toStateId: 'state-a', condition: 'opaque', action: 'also opaque', sourceWorkflowTransitionId: 'workflow-edge' }, { id: 'edge', now: CREATED });
    expect(transition.toStateId).toBe('state-a');
    expect(transition.sourceWorkflowTransitionId).toBe('workflow-edge');
    expect(updateProjectStateTransition(transition, { action: 'edited' }, UPDATED).action).toBe('edited');
    expect(archiveProjectStateTransition(transition, ARCHIVED).archivedAt).toBe(ARCHIVED);
  });

  it('rejects blank identities and non-core entity types', () => {
    expect(() => createProjectStateTransition({ ...input(), fromStateId: ' ' })).toThrow(/fromStateId/);
    expect(() => createProjectStateTransition({ ...input(), entityType: 'project_state' })).toThrow(/core entity type/);
  });
});

describe('ProjectStateTransitionRepository', () => {
  it('supports deterministic active/historical machine and endpoint queries, including historical archived edges', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateTransitionRepository(db);
    const a = createProjectStateTransition({ ...input(), toStateId: 'state-c' }, { id: 'a', now: CREATED });
    const b = createProjectStateTransition({ ...input(), fromStateId: 'state-c' }, { id: 'b', now: CREATED });
    const c = createProjectStateTransition(input(), { id: 'c', now: UPDATED });
    const archived = archiveProjectStateTransition(createProjectStateTransition(input(), { id: 'd', now: CREATED }), ARCHIVED);
    const other = createProjectStateTransition({ ...input(), projectId: 'project-b' }, { id: 'other', now: CREATED });
    await Promise.all([a, b, c, archived, other].map((t) => repository.add(t)));
    expect((await repository.listActiveForMachine(MACHINE)).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect((await repository.listForMachine(MACHINE)).map((t) => t.id)).toEqual(['a', 'b', 'd', 'c']);
    expect((await repository.listActiveOutgoingForState(MACHINE, 'state-a')).map((t) => t.id)).toEqual(['a', 'c']);
    expect((await repository.listOutgoingForState(MACHINE, 'state-a')).map((t) => t.id)).toEqual(['a', 'd', 'c']);
    expect((await repository.listActiveIncomingForState(MACHINE, 'state-b')).map((t) => t.id)).toEqual(['b', 'c']);
    expect((await repository.listIncomingForState(MACHINE, 'state-b')).map((t) => t.id)).toEqual(['b', 'd', 'c']);
    expect(await repository.getById('d')).toEqual(archived);
    await closeQuietly(db);
  });

  it('enforces the active directed-edge duplicate rule and permits reuse after archive', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateTransitionRepository(db);
    const first = createProjectStateTransition(input(), { id: 'first', now: CREATED });
    await repository.add(first);
    await expect(repository.add(createProjectStateTransition(input(), { id: 'duplicate', now: UPDATED }))).rejects.toBeInstanceOf(ProjectStateTransitionDuplicateError);
    await repository.save(archiveProjectStateTransition(first, ARCHIVED));
    await expect(repository.add(createProjectStateTransition(input(), { id: 'reused', now: UPDATED }))).resolves.toBeUndefined();
    await closeQuietly(db);
  });

  it('stores project-native transitions without a source workflow transition', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteProjectStateTransitionRepository(db);
    const native = createProjectStateTransition(input(), { id: 'native', now: CREATED });
    await repository.add(native);
    expect((await repository.getById(native.id))?.sourceWorkflowTransitionId).toBeNull();
    await closeQuietly(db);
  });
});

describe('ProjectStateTransitionService', () => {
  async function setup() {
    const db = await createTestDatabase();
    const states = new SqliteProjectStateRepository(db);
    const transitions = new SqliteProjectStateTransitionRepository(db);
    let number = 0;
    const service = new ProjectStateTransitionService({ states, transitions, clock: { now: () => CREATED }, ids: { newId: () => `edge-${++number}` } });
    return { db, states, transitions, service };
  }
  function state(id: string, changes: Partial<{ projectId: string; entityType: string; labelId: string; archivedAt: string | null }> = {}) {
    return { ...createProjectState({ ...MACHINE, title: id, ...changes }, { id, now: CREATED }), ...changes } as ReturnType<typeof createProjectState>;
  }

  it('requires active endpoint states in exactly the same project/entity-type/label machine', async () => {
    const { db, states, service } = await setup();
    const source = state('source');
    const destination = state('destination');
    const otherProject = state('other-project', { projectId: 'project-b' });
    const otherType = state('other-type', { entityType: 'goal' });
    const otherLabel = state('other-label', { labelId: 'label-b' });
    const archived = state('archived', { archivedAt: ARCHIVED });
    await Promise.all([source, destination, otherProject, otherType, otherLabel, archived].map((s) => states.add(s)));
    const edge = await service.defineTransition({ fromStateId: source.id, toStateId: destination.id, sourceWorkflowTransitionId: 'template-edge' });
    expect(edge).toMatchObject({ ...MACHINE, sourceWorkflowTransitionId: 'template-edge' });
    await expect(service.defineTransition({ fromStateId: 'missing', toStateId: source.id })).rejects.toBeInstanceOf(ProjectStateTransitionEndpointNotFoundError);
    await expect(service.defineTransition({ fromStateId: source.id, toStateId: archived.id })).rejects.toBeInstanceOf(ProjectStateTransitionEndpointArchivedError);
    for (const target of [otherProject, otherType, otherLabel]) {
      await expect(service.defineTransition({ fromStateId: source.id, toStateId: target.id })).rejects.toBeInstanceOf(ProjectStateTransitionMachineMismatchError);
    }
    await expect(service.updateTransition('missing', {})).rejects.toBeInstanceOf(ProjectStateTransitionNotFoundError);
    await closeQuietly(db);
  });

  it('keeps copied transitions independent from source edits and later workflow versions', async () => {
    const { db, states, transitions, service } = await setup();
    const source = state('source'); const destination = state('destination');
    await states.add(source); await states.add(destination);
    const sourceTemplates = new SqliteWorkflowStateTransitionRepository(db);
    const sourceTemplate = createWorkflowStateTransition({ workflowId: 'workflow-v1', entityType: 'task', labelId: 'label-a', fromStateId: 'template-source', toStateId: 'template-destination', title: 'Template' }, { id: 'template-edge', now: CREATED });
    await sourceTemplates.add(sourceTemplate);
    const copied = await service.defineTransition({ fromStateId: source.id, toStateId: destination.id, title: sourceTemplate.title, sourceWorkflowTransitionId: sourceTemplate.id });
    await service.updateTransition(copied.id, { title: 'Project-specific', action: 'project-only' }, UPDATED);
    await sourceTemplates.save(updateWorkflowStateTransition(sourceTemplate, { title: 'Template changed' }, UPDATED));
    await sourceTemplates.add(createWorkflowStateTransition({
      workflowId: 'workflow-v2',
      entityType: 'task',
      labelId: 'label-a',
      fromStateId: 'template-source',
      toStateId: 'template-destination',
      title: 'Template V2',
    }, { id: 'template-v2-edge', now: UPDATED }));
    expect(await transitions.getById(copied.id)).toMatchObject({ title: 'Project-specific', action: 'project-only', sourceWorkflowTransitionId: sourceTemplate.id });
    expect((await sourceTemplates.getById(sourceTemplate.id))?.title).toBe('Template changed');
    await closeQuietly(db);
  });
});
