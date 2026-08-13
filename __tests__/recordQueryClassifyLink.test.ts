import {
  LabelAssignmentEntityNotFoundError,
  LabelAssignmentService,
  LabelNotFoundError,
} from '../src/application/labelAssignmentService';
import { RelationEndpointNotFoundError, RelationService } from '../src/application/relationService';
import { RecordRelationProvenancePort } from '../src/application/relationProvenanceService';
import { RecordService } from '../src/application/recordService';
import { SqliteCoreEntityLookup } from '../src/persistence/sqlite/coreEntityLookup';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteRelationRepository } from '../src/persistence/relationRepository';
import type { SqliteDatabase } from '../src/persistence/database';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { archiveRecord, createRecord } from '../src/domain/record';
import { createLabel } from '../src/domain/label';
import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import { closeQuietly, createTestDatabase } from './helpers/testDatabase';

const T0 = '2026-08-12T08:00:00.000Z';
const T1 = '2026-08-12T09:00:00.000Z';
const T2 = '2026-08-12T10:00:00.000Z';
const T3 = '2026-08-12T11:00:00.000Z';

function record(id: string, overrides: Partial<ReturnType<typeof baseRecord>> = {}) {
  return createRecord({ ...baseRecord(), ...overrides }, { id, now: T3 });
}

function baseRecord() {
  return {
    description: 'An occurrence', recordType: 'observation', occurredAt: T1,
    recordedAt: T2, actor: 'agent-a',
  };
}

async function insertCoreEndpoints(
  db: Awaited<ReturnType<typeof createTestDatabase>>,
  recordId: string,
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {
    task: 'task-endpoint', goal: 'goal-endpoint', project: 'project-endpoint',
    idea: 'idea-endpoint', philosophy: 'philosophy-endpoint', workflow: 'workflow-endpoint',
    resource: 'resource-endpoint', record: recordId,
  };
  await db.runAsync(`INSERT INTO tasks (id,title,target_description,created_at,updated_at) VALUES (?,?,?,?,?)`, [ids.task, 'Task', 'Target', T0, T0]);
  await db.runAsync(`INSERT INTO goals (id,title,target_state,created_at,updated_at) VALUES (?,?,?,?,?)`, [ids.goal, 'Goal', 'Done', T0, T0]);
  await db.runAsync(`INSERT INTO projects (id,title,created_at,updated_at) VALUES (?,?,?,?)`, [ids.project, 'Project', T0, T0]);
  await db.runAsync(`INSERT INTO ideas (id,title,idea_description,captured_at,created_at,updated_at) VALUES (?,?,?,?,?,?)`, [ids.idea, 'Idea', 'Description', T0, T0, T0]);
  await db.runAsync(`INSERT INTO philosophies (id,title,created_at,updated_at) VALUES (?,?,?,?)`, [ids.philosophy, 'Philosophy', T0, T0]);
  await db.runAsync(`INSERT INTO workflows (id,title,workflow_type,version,created_at,updated_at) VALUES (?,?,?,?,?,?)`, [ids.workflow, 'Workflow', 'delivery', 1, T0, T0]);
  await db.runAsync(`INSERT INTO resources (id,title,resource_type,created_at,updated_at) VALUES (?,?,?,?,?)`, [ids.resource, 'Resource', 'time', T0, T0]);
  return ids;
}

describe('Record query, classification, and semantic linking (#57)', () => {
  it('filters independent occurred and recorded time axes with type, actor, archive visibility, and stable order', async () => {
    const db = await createTestDatabase();
    const repository = new SqliteRecordRepository(db);
    const first = record('a', { occurredAt: T0, recordedAt: T2, actor: 'agent-a' });
    const second = record('b', { occurredAt: T1, recordedAt: T2, actor: 'agent-a' });
    const archived = record('c', { occurredAt: T1, recordedAt: T3, recordType: 'action', actor: 'agent-b' });
    await repository.add(first);
    await repository.add(second);
    await repository.add(archived);
    await repository.save(archiveRecord(archived, T3));

    expect((await repository.list()).map((value) => value.id)).toEqual(['a', 'b']);
    expect((await repository.list({ status: 'all' })).map((value) => value.id)).toEqual(['a', 'b', 'c']);
    expect((await repository.list({ status: 'archived' })).map((value) => value.id)).toEqual(['c']);
    expect((await repository.list({ occurredAt: { start: T1 }, recordedAt: { end: T2 }, recordType: 'observation', actor: 'agent-a' })).map((value) => value.id)).toEqual(['b']);

    const service = new RecordService({
      repository,
      unitOfWork: sqliteUnitOfWork(db),
      records: (context) => new SqliteRecordRepository(context),
      clock: { now: () => T3 },
      ids: { newId: () => 'unused' },
    });
    expect((await service.listRecordHistory({ recordType: 'action' })).map((value) => value.id)).toEqual(['c']);
    await closeQuietly(db);
  });

  it('validates Record label targets logically and leaves no partial assignment for unknown Records', async () => {
    const db = await createTestDatabase();
    const records = new SqliteRecordRepository(db);
    const target = record('record-endpoint');
    await records.add(target);
    const labels = new SqliteLabelRepository(db);
    const label = { ...createLabel({ name: 'Observed' }), id: 'label-1', createdAt: T0, updatedAt: T0 };
    await labels.add(label);
    const assignments = new SqliteEntityLabelRepository(db);
    const service = new LabelAssignmentService({
      labels, assignments, entities: new SqliteCoreEntityLookup(db),
      clock: { now: () => T2 }, ids: { newId: () => 'assignment-1' },
    });

    await expect(service.assignLabel({ entityType: 'record', entityId: target.id, labelId: label.id }))
      .resolves.toMatchObject({ entityType: 'record', entityId: target.id, labelId: label.id });
    await expect(service.assignLabel({ entityType: 'record', entityId: target.id, labelId: 'missing-label' }))
      .rejects.toBeInstanceOf(LabelNotFoundError);
    await expect(service.assignLabel({ entityType: 'record', entityId: 'missing-record', labelId: label.id }))
      .rejects.toBeInstanceOf(LabelAssignmentEntityNotFoundError);
    expect(await assignments.listForEntity('record', 'missing-record')).toEqual([]);
    expect(await assignments.listForEntity('record', target.id)).toHaveLength(1);
    await closeQuietly(db);
  });

  it('links a Record to every supported core endpoint and rejects unknown typed endpoints atomically', async () => {
    const db = await createTestDatabase();
    const records = new SqliteRecordRepository(db);
    const source = record('source-record');
    await records.add(source);
    const ids = await insertCoreEndpoints(db, source.id);
    let sequence = 0;
    const relations = new SqliteRelationRepository(db);
    const service = new RelationService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db),
      relations: (context) => new SqliteRelationRepository(context),
      endpoints: (context) => new SqliteCoreEntityLookup(context),
      provenance: new RecordRelationProvenancePort({
        records: (context) => new SqliteRecordRepository(context),
        clock: { now: () => T2 },
        ids: { newId: () => `relation-audit-${++sequence}` },
      }),
      clock: { now: () => T2 }, ids: { newId: () => `relation-${++sequence}` },
    });

    for (const endpointType of CORE_ENTITY_TYPES) {
      await service.createRelation({
        sourceType: 'record', sourceId: source.id, relationType: 'related_to',
        targetType: endpointType, targetId: ids[endpointType], actor: 'agent-a',
      });
    }
    expect((await relations.list({ source: { type: 'record', id: source.id } })).map((value) => value.targetType).sort())
      .toEqual([...CORE_ENTITY_TYPES].sort());

    await expect(service.createRelation({
      sourceType: 'record', sourceId: source.id, relationType: 'related_to',
      targetType: 'goal', targetId: 'missing-goal', actor: 'agent-a',
    })).rejects.toBeInstanceOf(RelationEndpointNotFoundError);
    expect(await relations.list({ target: { type: 'goal', id: 'missing-goal' } })).toEqual([]);
    await closeQuietly(db);
  });
});
