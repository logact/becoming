import {
  EntityTimelineQueryService,
  EntityTimelineQueryValidationError,
} from '../src/application/entityTimelineQueryService';
import { TimelineEntityNotFoundError } from '../src/application/timelineEntityResolver';
import { createRecord } from '../src/domain/record';
import type { Record as OccurrenceRecord } from '../src/domain/record';
import type { RecordHistoryRepository } from '../src/persistence/recordRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { SqliteCoreEntityLookup } from '../src/persistence/sqlite/coreEntityLookup';
import { createTestDatabase } from './helpers/testDatabase';

const FIRST = '2026-08-13T08:00:00.000Z';
const SECOND = '2026-08-13T08:01:00.000Z';
const THIRD = '2026-08-13T08:02:00.000Z';
const FOURTH = '2026-08-13T08:03:00.000Z';
const FIFTH = '2026-08-13T08:04:00.000Z';
const SIXTH = '2026-08-13T08:05:00.000Z';

function event(id: string, recordType: string, occurredAt: string, payload: unknown): OccurrenceRecord {
  return createRecord({
    description: id,
    recordType,
    occurredAt,
    recordedAt: occurredAt,
    actor: 'agent:test',
    payload,
  }, { id, now: occurredAt });
}

describe('EntityTimelineQueryService (#86)', () => {
  it('composes all supported categories, de-duplicates multi-path records, filters, and orders them', async () => {
    const db = await createTestDatabase();
    const records = new SqliteRecordRepository(db);
    await insertCoreEntity(db, 'goals', 'goal-1');
    await insertCoreEntity(db, 'projects', 'project-1');

    const entries = [
      event('mutation', 'mutation', SECOND, {
        entityType: 'goal', entityId: 'goal-1', action: 'update', actor: 'agent:test', occurredAt: SECOND,
        before: { title: 'old' }, after: { title: 'new' },
      }),
      event('relation', 'mutation', FIRST, {
        action: 'relation_created', relationId: 'relation-1', sourceType: 'goal', sourceId: 'goal-1',
        relationType: 'belongs_to', targetType: 'project', targetId: 'project-1', metadata: null,
        actor: 'agent:test', occurredAt: FIRST, created_at: FIRST,
      }),
      event('lineage', 'mutation', THIRD, {
        action: 'relation_created', relationId: 'lineage-1', sourceType: 'goal', sourceId: 'goal-1',
        relationType: 'origin_of', targetType: 'project', targetId: 'project-1', metadata: null,
        actor: 'agent:test', occurredAt: THIRD, created_at: THIRD,
      }),
      event('lifecycle', 'state_transition', FOURTH, {
        schemaVersion: 1, projectId: 'project-1', entityType: 'goal', entityId: 'goal-1', labelId: 'label-1',
        fromProjectStateId: 'state-1', toProjectStateId: 'state-2', projectTransitionId: 'transition-1',
        actor: 'agent:test', occurredAt: FOURTH, snapshot: {}, evaluation: {},
      }),
      event('correction', 'correction', FIFTH, {
        targetRecordId: 'goal-record', changes: { description: { before: 'before', after: 'after' } },
      }),
      event('unrelated', 'action', SIXTH, { source: 'not the goal' }),
    ];
    const direct = event('goal-record', 'action', FIRST, { source: 'direct' });
    for (const entry of [...entries, direct]) await records.add(entry);

    const service = new EntityTimelineQueryService({
      entities: new SqliteCoreEntityLookup(db), records,
    });
    const goalEvents = await service.list({ type: 'goal', id: 'goal-1' });
    expect(goalEvents.map(({ recordId }) => recordId)).toEqual([
      'relation', 'mutation', 'lineage', 'lifecycle',
    ]);
    expect(goalEvents.map(({ category }) => category)).toEqual([
      'relation', 'mutation', 'lineage', 'lifecycle',
    ]);
    expect(new Set(goalEvents.map(({ recordId }) => recordId)).size).toBe(goalEvents.length);

    const recordEvents = await service.list({ type: 'record', id: 'goal-record' }, {
      categories: ['occurrence', 'correction'], occurredAt: { start: FIRST, end: FIFTH },
    });
    expect(recordEvents.map(({ recordId }) => recordId)).toEqual(['goal-record', 'correction']);
    await expect(service.list({ type: 'goal', id: 'goal-1' }, {
      recordType: 'action', category: 'mutation',
    })).resolves.toEqual([]);
  });

  it('validates every core type, keeps archived history visible when authorized, and rejects invalid queries', async () => {
    const db = await createTestDatabase();
    const records = new SqliteRecordRepository(db);
    const mapping: [string, string][] = [
      ['tasks', 'task'], ['goals', 'goal'], ['projects', 'project'], ['ideas', 'idea'],
      ['philosophies', 'philosophy'], ['workflows', 'workflow'], ['resources', 'resource'],
    ];
    for (const [table, type] of mapping) await insertCoreEntity(db, table, `${type}-1`, type === 'goal');
    const archived = event('record-1', 'action', FIRST, null);
    await records.add(archived);
    await records.save({ ...archived, archivedAt: SECOND, updatedAt: SECOND });
    const calls = { list: 0 };
    const counted: RecordHistoryRepository = {
      getById: records.getById.bind(records), add: records.add.bind(records), save: records.save.bind(records),
      list: async (options) => { calls.list += 1; return records.list(options); },
    };
    const service = new EntityTimelineQueryService({
      entities: new SqliteCoreEntityLookup(db), records: counted,
    });
    for (const type of ['task', 'goal', 'project', 'idea', 'philosophy', 'workflow', 'resource']) {
      await expect(service.list({ type, id: `${type}-1` })).resolves.toEqual([]);
    }
    await expect(service.list({ type: 'record', id: 'record-1' }, { status: 'all' }))
      .resolves.toMatchObject([{ recordId: 'record-1', archivedAt: SECOND }]);
    expect(calls.list).toBe(8); // exactly one bounded page per query, never per event/reference
    await expect(service.list({ type: 'goal', id: 'missing' })).rejects.toBeInstanceOf(TimelineEntityNotFoundError);
    await expect(service.list({ type: 'unknown', id: 'x' })).rejects.toThrow(/core entity type/);
    await expect(service.list({ type: 'goal', id: 'goal-1' }, { status: 'bad' as 'active' }))
      .rejects.toBeInstanceOf(EntityTimelineQueryValidationError);
    await expect(service.list({ type: 'goal', id: 'goal-1' }, { occurredAt: { start: SECOND, end: FIRST } }))
      .rejects.toBeInstanceOf(EntityTimelineQueryValidationError);
  });
});

async function insertCoreEntity(
  db: Awaited<ReturnType<typeof createTestDatabase>>,
  table: string,
  id: string,
  archived = false,
): Promise<void> {
  const archivedAt = archived ? SECOND : null;
  const values: Record<string, unknown> = {
    tasks: [`${id}`, 'title', null, 'target', null, null, FIRST, FIRST, archivedAt],
    goals: [`${id}`, 'title', null, 'target', null, FIRST, FIRST, archivedAt],
    projects: [`${id}`, 'title', null, null, FIRST, FIRST, archivedAt],
    ideas: [`${id}`, 'title', null, 'idea', FIRST, FIRST, FIRST, archivedAt],
    philosophies: [`${id}`, 'title', null, FIRST, FIRST, archivedAt],
    workflows: [`${id}`, 'title', null, 'project', null, 1, null, null, FIRST, FIRST, archivedAt],
    resources: [`${id}`, 'title', null, 'time', null, null, null, FIRST, FIRST, archivedAt],
  };
  const columns: Record<string, string> = {
    tasks: 'id, title, description, target_description, exit_criteria, priority, created_at, updated_at, archived_at',
    goals: 'id, title, description, target_state, success_criteria, created_at, updated_at, archived_at',
    projects: 'id, title, description, purpose, created_at, updated_at, archived_at',
    ideas: 'id, title, description, idea_description, captured_at, created_at, updated_at, archived_at',
    philosophies: 'id, title, description, created_at, updated_at, archived_at',
    workflows: 'id, title, description, workflow_type, purpose, version, entry_criteria, exit_criteria, created_at, updated_at, archived_at',
    resources: 'id, title, description, resource_type, unit, behavior, capacity, created_at, updated_at, archived_at',
  };
  const row = values[table] as (string | number | null)[];
  await db.runAsync(`INSERT INTO ${table} (${columns[table]}) VALUES (${row.map(() => '?').join(', ')})`, row);
}
