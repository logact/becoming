import { LabelService } from '../src/application/labelService';
import { createLabel } from '../src/domain/label';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import type { Record } from '../src/domain/record';
import type { SqliteDatabase } from '../src/persistence/database';
import { SqliteEntityLabelRepository } from '../src/persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import { createTestDatabase } from './helpers/testDatabase';

const NOW = '2026-08-13T04:00:00.000Z';
const LATER = '2026-08-13T05:00:00.000Z';
const TASK_ID = 'task-1';
const GOAL_ID = 'goal-1';

describe('LabelService', () => {
  let db: SqliteDatabase;
  let service: LabelService<SqliteDatabase>;
  let id = 0;

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new LabelService({
      unitOfWork: sqliteUnitOfWork(db),
      labels: (context) => new SqliteLabelRepository(context),
      assignments: (context) => new SqliteEntityLabelRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      readLabels: new SqliteLabelRepository(db),
      readAssignments: new SqliteEntityLabelRepository(db),
      clock: { now: () => NOW },
      ids: { newId: () => `generated-${++id}` },
    });
  });

  afterEach(async () => db.closeAsync());

  async function records(): Promise<Record[]> {
    const ids = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM records WHERE record_type = ? ORDER BY id',
      [PROVENANCE_RECORD_TYPE],
    );
    const repository = new SqliteRecordRepository(db);
    return Promise.all(ids.map(({ id: recordId }) => repository.getById(recordId) as Promise<Record>));
  }

  async function count(table: string): Promise<number> {
    return (await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0;
  }

  it('queries active labels and historical assignments by entity without silently returning ended rows', async () => {
    const feature = await service.createLabel({ actor: 'user', name: 'Feature' });
    const bug = await service.createLabel({ actor: 'user', name: 'Bug' });
    const ended = await service.assignLabel({
      actor: 'user', entityType: 'task', entityId: TASK_ID, labelId: feature.id, assignedAt: NOW,
    });
    await service.endLabelAssignment(ended.id, 'user', LATER);
    const active = await service.assignLabel({
      actor: 'user', entityType: 'task', entityId: TASK_ID, labelId: bug.id, assignedAt: LATER,
    });

    expect(await service.listActiveLabelsForEntity('task', TASK_ID)).toEqual([
      { assignment: active, label: bug },
    ]);
    const history = await service.listAssignmentHistoryForEntity('task', TASK_ID);
    expect(history.map(({ assignment }) => assignment.id)).toEqual([ended.id, active.id]);
    expect(history[0].assignment.endedAt).toBe(LATER);
    expect(await service.listAssignmentHistoryForEntity('task', TASK_ID, { limit: 1, offset: 1 })).toEqual([
      { assignment: active, label: bug },
    ]);
  });

  it('queries active and historical entities by label with deterministic pagination and empty results', async () => {
    const label = await service.createLabel({ actor: 'user', name: 'Feature' });
    const first = await service.assignLabel({
      actor: 'user', entityType: 'task', entityId: TASK_ID, labelId: label.id, assignedAt: NOW,
    });
    const ended = await service.assignLabel({
      actor: 'user', entityType: 'goal', entityId: GOAL_ID, labelId: label.id, assignedAt: LATER,
    });
    await service.endLabelAssignment(ended.id, 'user', '2026-08-13T06:00:00.000Z');

    expect(await service.listActiveEntitiesForLabel(label.id)).toEqual([first]);
    expect(await service.listEntityHistoryForLabel(label.id, { limit: 1, offset: 1 })).toEqual([
      { ...ended, endedAt: '2026-08-13T06:00:00.000Z' },
    ]);
    expect(await service.listActiveEntitiesForLabel('no-label')).toEqual([]);
  });

  it('keeps archived definitions out of active discovery but resolves them in definition and assignment history', async () => {
    const label = await service.createLabel({ actor: 'user', name: 'Experimental' });
    const assignment = await service.assignLabel({
      actor: 'user', entityType: 'task', entityId: TASK_ID, labelId: label.id,
    });
    const archived = await service.archiveLabel(label.id, 'user', LATER);

    expect(await service.listActiveDefinitions()).toEqual([]);
    expect(await service.listDefinitionHistory()).toEqual([archived]);
    expect(await service.listAssignmentHistoryForEntity('task', TASK_ID)).toEqual([
      { assignment, label: archived },
    ]);
  });

  it('writes definition and assignment provenance atomically using explicit supporting-aggregate policies', async () => {
    const label = await service.createLabel({ actor: 'creator', name: 'Feature' });
    const updated = await service.updateLabel(label.id, { description: 'Product work' }, 'editor');
    const assignment = await service.assignLabel({
      actor: 'assignee', entityType: 'task', entityId: TASK_ID, labelId: label.id,
    });
    await service.endLabelAssignment(assignment.id, 'assignee', LATER);

    const audit = await records();
    expect(audit).toHaveLength(4);
    expect(audit.map((record) => (record.payload as { entityType: string }).entityType)).toEqual([
      'label', 'label', 'entity_label', 'entity_label',
    ]);
    expect(audit[1].payload).toMatchObject({
      entityId: updated.id, action: 'update', actor: 'editor',
      after: { description: 'Product work' },
    });
    expect(audit[3].payload).toMatchObject({
      entityId: assignment.id, action: 'update', actor: 'assignee',
      after: { endedAt: LATER },
    });
  });

  it('rolls back assignment and emits no provenance when its current-state mutation fails', async () => {
    const labels = new SqliteLabelRepository(db);
    const label = createLabel({ name: 'Existing' });
    await labels.add(label);
    await service.assignLabel({ actor: 'user', entityType: 'task', entityId: TASK_ID, labelId: label.id });
    const beforeRecords = await count('records');

    await expect(service.assignLabel({
      actor: 'user', entityType: 'task', entityId: TASK_ID, labelId: label.id,
    })).rejects.toThrow(/rolled back/);
    expect(await count('entity_labels')).toBe(1);
    expect(await count('records')).toBe(beforeRecords);
  });

  it('rolls back assignment start and end when the provenance append fails', async () => {
    const label = await service.createLabel({ actor: 'user', name: 'Feature' });
    const assignment = await service.assignLabel({
      actor: 'user', entityType: 'task', entityId: TASK_ID, labelId: label.id,
    });
    const failing = new LabelService({
      unitOfWork: sqliteUnitOfWork(db),
      labels: (context) => new SqliteLabelRepository(context),
      assignments: (context) => new SqliteEntityLabelRepository(context),
      records: () => ({
        add: async () => { throw new Error('records table locked'); },
        getById: async () => null,
      }),
      readLabels: new SqliteLabelRepository(db),
      readAssignments: new SqliteEntityLabelRepository(db),
      clock: { now: () => LATER },
      ids: { newId: () => `failed-${++id}` },
    });

    await expect(failing.assignLabel({
      actor: 'user', entityType: 'goal', entityId: GOAL_ID, labelId: label.id,
    })).rejects.toThrow(/Provenance append/);
    expect(await count('entity_labels')).toBe(1);

    await expect(failing.endLabelAssignment(assignment.id, 'user', LATER)).rejects.toThrow(/Provenance append/);
    expect(await new SqliteEntityLabelRepository(db).getById(assignment.id)).toEqual(assignment);
  });

  it('does not create, choose, or mutate any workflow or state-machine data for classification-only labels', async () => {
    const label = await service.createLabel({ actor: 'user', name: 'Classification only' });
    await service.assignLabel({ actor: 'user', entityType: 'task', entityId: TASK_ID, labelId: label.id });

    for (const table of ['workflows', 'workflow_states', 'workflow_state_transitions', 'project_states', 'project_state_transitions']) {
      expect(await count(table)).toBe(0);
    }
  });
});
