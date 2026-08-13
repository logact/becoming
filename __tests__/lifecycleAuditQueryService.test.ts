import {
  LifecycleAuditQueryService,
  LifecycleAuditQueryValidationError,
} from '../src/application/lifecycleAuditQueryService';
import { archiveRecord, createRecord } from '../src/domain/record';
import { buildStateTransitionAuditPayload, stateTransitionAuditPayloadToJson } from '../src/domain/stateTransitionAudit';
import { archiveLabel } from '../src/domain/label';
import { archiveProjectState, createProjectState, updateProjectState } from '../src/domain/projectState';
import { createProjectStateTransition, updateProjectStateTransition } from '../src/domain/projectStateTransition';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteProjectRepository } from '../src/persistence/projectRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteProjectStateTransitionRepository } from '../src/persistence/projectStateTransitionRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-13T09:00:00.000Z';
const T1 = '2026-08-13T10:00:00.000Z';
const T2 = '2026-08-13T11:00:00.000Z';
const machine = { projectId: 'project-1', entityType: 'goal' as const, labelId: 'label-1' };

function audit(id: string, occurredAt: string, actor = 'user-1', overrides: Partial<Parameters<typeof buildStateTransitionAuditPayload>[0]> = {}) {
  return createRecord({
    recordType: 'state_transition', description: 'Lifecycle transition', actor, occurredAt, recordedAt: T2,
    payload: stateTransitionAuditPayloadToJson(buildStateTransitionAuditPayload({
      ...machine, entityId: 'goal-1', fromProjectStateId: 'ready', toProjectStateId: 'done', projectTransitionId: 'ready-done', actor, occurredAt,
      snapshot: { fromState: { title: 'Ready', category: 'active' }, toState: { title: 'Done', category: 'completed' }, transition: { title: 'Complete' }, label: { name: 'Feature' } },
      evaluation: { conditions: [{ ruleId: 'condition-1', outcome: 'satisfied', summary: 'approved' }], exitCriteria: [{ ruleId: 'exit-1', outcome: 'not_evaluated', summary: 'not required' }] },
      ...overrides,
    })),
  }, { id, now: T2 });
}

async function fixture() {
  const db = await createTestDatabase();
  const records = new SqliteRecordRepository(db);
  const projects = new SqliteProjectRepository(db);
  const labels = new SqliteLabelRepository(db);
  const states = new SqliteProjectStateRepository(db);
  const transitions = new SqliteProjectStateTransitionRepository(db);
  await projects.add({ id: 'project-1', title: 'Project', description: null, purpose: null, createdAt: T0, updatedAt: T0, archivedAt: null });
  await labels.add({ id: 'label-1', name: 'Feature', description: null, createdAt: T0, updatedAt: T0, archivedAt: null });
  await states.add(createProjectState({ ...machine, title: 'Ready', category: 'active' }, { id: 'ready', now: T0 }));
  await states.add(createProjectState({ ...machine, title: 'Done', category: 'completed' }, { id: 'done', now: T0 }));
  await transitions.add(createProjectStateTransition({ ...machine, fromStateId: 'ready', toStateId: 'done', title: 'Complete' }, { id: 'ready-done', now: T0 }));
  const service = new LifecycleAuditQueryService({ records, projects, labels, states, transitions,
    entities: { exists: async (type, id) => type === 'goal' && id === 'goal-1' },
  });
  return { db, records, labels, states, transitions, service };
}

describe('LifecycleAuditQueryService (#81)', () => {
  it('combines project/entity/label/state/transition/actor/time filters in transition-time order and exposes redacted evidence', async () => {
    const { db, records, service } = await fixture();
    await records.add(audit('later', T2));
    await records.add(audit('earlier', T1));
    await records.add(audit('other-actor', T1, 'user-2'));
    const result = await service.listHistory({ projectId: 'project-1', entityType: 'goal', entityId: 'goal-1', labelId: 'label-1', fromProjectStateId: 'ready', toProjectStateId: 'done', projectTransitionId: 'ready-done', actor: 'user-1', occurredAt: { start: T1, end: T2 } });
    expect(result.map((entry) => entry.record.id)).toEqual(['earlier', 'later']);
    expect(result[0]).toMatchObject({ actor: 'user-1', occurredAt: T1, payload: { evaluation: { conditions: [{ ruleId: 'condition-1', outcome: 'satisfied', summary: 'approved' }], exitCriteria: [{ outcome: 'not_evaluated' }] } } });
    expect(JSON.stringify(result[0].payload)).not.toContain('secret');
    await closeQuietly(db);
  });

  it('keeps archived audit Records behind explicit history visibility', async () => {
    const { db, records, service } = await fixture();
    const historical = archiveRecord(audit('archived', T1), T2);
    await records.add(historical);
    await records.add(audit('active', T2));
    expect((await service.listHistory()).map((entry) => entry.record.id)).toEqual(['active']);
    expect((await service.listHistory({ status: 'all', includeLiveReferences: false })).map((entry) => entry.record.id)).toEqual(['archived', 'active']);
    await closeQuietly(db);
  });

  it('returns immutable snapshots with archived, changed, and missing live-reference statuses', async () => {
    const { db, records, labels, states, transitions, service } = await fixture();
    await records.add(audit('audit-1', T1));
    await labels.save(archiveLabel((await labels.getById('label-1'))!, T2));
    await states.save(updateProjectState((await states.getById('ready'))!, { title: 'Queued' }, T2));
    await states.save(archiveProjectState((await states.getById('done'))!, T2));
    await transitions.save(updateProjectStateTransition((await transitions.getById('ready-done'))!, { title: 'Finish' }, T2));
    const [entry] = await service.listHistory();
    expect(entry.payload.snapshot).toEqual(expect.objectContaining({ fromState: expect.objectContaining({ title: 'Ready' }), toState: expect.objectContaining({ title: 'Done' }), label: { name: 'Feature' } }));
    expect(entry.references).toMatchObject({ project: { status: 'available' }, entity: { status: 'available' }, label: { status: 'archived' }, fromState: { status: 'changed' }, toState: { status: 'archived' }, transition: { status: 'changed' } });
    const missing = new LifecycleAuditQueryService({ records });
    expect((await missing.listHistory())[0].references).toEqual({});
    await closeQuietly(db);
  });

  it('rejects invalid entity and time filters explicitly', async () => {
    const { db, service } = await fixture();
    await expect(service.listHistory({ entityType: 'invalid' })).rejects.toBeInstanceOf(LifecycleAuditQueryValidationError);
    await expect(service.listHistory({ entityId: 'goal-1' })).rejects.toBeInstanceOf(LifecycleAuditQueryValidationError);
    await expect(service.listHistory({ occurredAt: { start: T2, end: T1 } })).rejects.toBeInstanceOf(LifecycleAuditQueryValidationError);
    await closeQuietly(db);
  });
});
