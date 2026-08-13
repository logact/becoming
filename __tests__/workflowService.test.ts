import { createWorkflow } from '../src/domain/workflow';
import { PROVENANCE_RECORD_TYPE } from '../src/domain/mutationProvenance';
import type { Record } from '../src/domain/record';
import {
  MutationPersistenceError,
  ProvenancePersistenceError,
  ProvenanceValidationError,
} from '../src/application/mutationProvenanceService';
import { WorkflowService } from '../src/application/workflowService';
import { WorkflowNotFoundError } from '../src/application/workflowStateService';
import {
  SqliteWorkflowRepository,
} from '../src/persistence/workflowRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import type { RecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { createTestDatabase } from './helpers/testDatabase';

const NOW = '2026-08-12T11:00:00.000Z';

const fixedClock = { now: () => NOW };
let idCounter = 0;
const fixedIds = { newId: () => `wf-prov-${++idCounter}` };

describe('WorkflowService', () => {
  let db: SqliteDatabase;
  let service: WorkflowService<SqliteDatabase>;

  async function count(table: string): Promise<number> {
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table}`,
    );
    return row?.n ?? -1;
  }

  async function provenanceRecords(): Promise<Record[]> {
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM records WHERE record_type = ?`,
      [PROVENANCE_RECORD_TYPE],
    );
    const repository = new SqliteRecordRepository(db);
    const records: Record[] = [];
    for (const row of rows) {
      records.push((await repository.getById(row.id)) as Record);
    }
    return records;
  }

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new WorkflowService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db),
      workflows: (context) => new SqliteWorkflowRepository(context),
      records: (context) => new SqliteRecordRepository(context),
      readWorkflows: new SqliteWorkflowRepository(db),
      clock: fixedClock,
      ids: fixedIds,
    });
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('discovery queries', () => {
    it('finds an exact version by type', async () => {
      const repository = new SqliteWorkflowRepository(db);
      await repository.add(
        createWorkflow({ title: 'v1', workflowType: 'task_execution' }),
      );
      const v2 = createWorkflow({
        title: 'v2',
        workflowType: 'task_execution',
        version: 2,
      });
      await repository.add(v2);

      const result = await service.discover({
        workflowType: 'task_execution',
        version: 1,
      });

      expect(result.kind).toBe('found');
      if (result.kind === 'found') {
        expect(result.workflow.title).toBe('v1');
        expect(result.workflow.version).toBe(1);
      }
    });

    it('resolves the latest version as the highest active version', async () => {
      const repository = new SqliteWorkflowRepository(db);
      await repository.add(
        createWorkflow({ title: 'v1', workflowType: 'task_execution' }),
      );
      await repository.add(
        createWorkflow({
          title: 'v2',
          workflowType: 'task_execution',
          version: 2,
        }),
      );

      const result = await service.discover({ workflowType: 'task_execution' });

      expect(result.kind).toBe('found');
      if (result.kind === 'found') {
        expect(result.workflow.title).toBe('v2');
        expect(result.workflow.version).toBe(2);
      }
    });

    it('narrows discovery by exact purpose', async () => {
      const repository = new SqliteWorkflowRepository(db);
      await repository.add(
        createWorkflow({
          title: 'other purpose',
          workflowType: 'goal_execution',
          purpose: 'coaching',
        }),
      );
      const wanted = createWorkflow({
        title: 'wanted',
        workflowType: 'goal_execution',
        purpose: 'planning',
      });
      await repository.add(wanted);

      const result = await service.discover({
        workflowType: 'goal_execution',
        purpose: 'planning',
      });

      expect(result.kind).toBe('found');
      if (result.kind === 'found') {
        expect(result.workflow.id).toBe(wanted.id);
      }
    });

    it('lists active versions in deterministic order, highest version first', async () => {
      const repository = new SqliteWorkflowRepository(db);
      await repository.add(
        createWorkflow({ title: 'v1', workflowType: 'task_execution' }),
      );
      await repository.add(
        createWorkflow({
          title: 'v3',
          workflowType: 'task_execution',
          version: 3,
        }),
      );
      await repository.add(
        createWorkflow({
          title: 'v2',
          workflowType: 'task_execution',
          version: 2,
        }),
      );

      const active = await service.listActive({
        workflowType: 'task_execution',
      });

      expect(active.map((w) => w.version)).toEqual([3, 2, 1]);
    });

    it('excludes archived versions from active discovery but keeps them in history', async () => {
      const draft = await service.createWorkflowDefinition({
        actor: 'user-1',
        title: 'old',
        workflowType: 'task_execution',
      });
      await service.archiveWorkflow(draft.id, 'user-1');

      expect(await service.discover({ workflowType: 'task_execution' })).toEqual(
        { kind: 'missing' },
      );
      expect(
        await service.listActive({ workflowType: 'task_execution' }),
      ).toHaveLength(0);

      const history = await service.listHistory({
        workflowType: 'task_execution',
      });
      expect(history).toHaveLength(1);
      expect(history[0].archivedAt).not.toBeNull();

      const historical = await service.discoverInHistory({
        workflowType: 'task_execution',
        version: 1,
      });
      expect(historical.kind).toBe('found');
      if (historical.kind === 'found') {
        expect(historical.workflow.id).toBe(draft.id);
        expect(historical.workflow.archivedAt).not.toBeNull();
      }
    });

    it('returns missing when nothing matches', async () => {
      expect(
        await service.discover({ workflowType: 'idea_triage' }),
      ).toEqual({ kind: 'missing' });
      expect(
        await service.discoverInHistory({
          workflowType: 'idea_triage',
          version: 1,
        }),
      ).toEqual({ kind: 'missing' });
    });

    it('returns ambiguous with candidates instead of picking arbitrarily', async () => {
      const repository = new SqliteWorkflowRepository(db);
      const first = createWorkflow({
        title: 'one',
        workflowType: 'task_execution',
      });
      const second = createWorkflow({
        title: 'two',
        workflowType: 'task_execution',
      });
      await repository.add(first);
      await repository.add(second);

      const result = await service.discover({ workflowType: 'task_execution' });

      expect(result.kind).toBe('ambiguous');
      if (result.kind === 'ambiguous') {
        expect(result.candidates.map((w) => w.id).sort()).toEqual(
          [first.id, second.id].sort(),
        );
      }

      const exact = await service.discover({
        workflowType: 'task_execution',
        version: 1,
      });
      expect(exact.kind).toBe('ambiguous');
    });
  });

  describe('provenance-aware mutations', () => {
    it('creates a definition with one create provenance record', async () => {
      const workflow = await service.createWorkflowDefinition({
        actor: 'user-1',
        title: 'Task execution',
        workflowType: 'task_execution',
        purpose: 'run tasks',
      });

      expect(await count('workflows')).toBe(1);
      const records = await provenanceRecords();
      expect(records).toHaveLength(1);
      expect(records[0].actor).toBe('user-1');
      expect(records[0].payload).toMatchObject({
        entityType: 'workflow',
        entityId: workflow.id,
        action: 'create',
        actor: 'user-1',
        before: null,
      });
      const payload = records[0].payload as {
        after: { title: string; workflowType: string; purpose: string };
      };
      expect(payload.after).toMatchObject({
        title: 'Task execution',
        workflowType: 'task_execution',
        purpose: 'run tasks',
      });
    });

    it('updates a draft with only the changed fields in the payload', async () => {
      const workflow = await service.createWorkflowDefinition({
        actor: 'user-1',
        title: 'Old title',
        workflowType: 'task_execution',
      });

      const updated = await service.updateWorkflowDraft(
        workflow.id,
        { title: 'New title' },
        'user-2',
      );

      expect(updated.title).toBe('New title');
      const records = await provenanceRecords();
      expect(records).toHaveLength(2);
      const update = records[1].payload as {
        action: string;
        actor: string;
        before: { [field: string]: unknown };
        after: { [field: string]: unknown };
      };
      expect(update.action).toBe('update');
      expect(update.actor).toBe('user-2');
      expect(update.before).toEqual({ title: 'Old title', updatedAt: workflow.updatedAt });
      expect(update.after).toEqual({ title: 'New title', updatedAt: NOW });
    });

    it('publishes a draft with an update record whose after includes publishedAt', async () => {
      const workflow = await service.createWorkflowDefinition({
        actor: 'user-1',
        title: 'Publishable',
        workflowType: 'goal_decomposition',
      });

      const published = await service.publishWorkflow(workflow.id, 'user-1');

      expect(published.publishedAt).toBe(NOW);
      const records = await provenanceRecords();
      expect(records).toHaveLength(2);
      const payload = records[1].payload as {
        action: string;
        before: { publishedAt: string | null };
        after: { publishedAt: string | null };
      };
      expect(payload.action).toBe('update');
      expect(payload.before.publishedAt).toBeNull();
      expect(payload.after.publishedAt).toBe(NOW);
    });

    it('creates the next version with a create record carrying supersedesId lineage', async () => {
      const workflow = await service.createWorkflowDefinition({
        actor: 'user-1',
        title: 'Versionable',
        workflowType: 'project_management',
      });
      await service.publishWorkflow(workflow.id, 'user-1');

      const successor = await service.createWorkflowVersion(
        workflow.id,
        { title: 'Versionable v2' },
        'user-1',
      );

      expect(successor.version).toBe(2);
      expect(successor.supersedesId).toBe(workflow.id);
      const records = await provenanceRecords();
      expect(records).toHaveLength(3);
      expect(records[2].payload).toMatchObject({
        entityType: 'workflow',
        entityId: successor.id,
        action: 'create',
      });
      const payload = records[2].payload as {
        after: { supersedesId: string; version: number; title: string };
      };
      expect(payload.after).toMatchObject({
        supersedesId: workflow.id,
        version: 2,
        title: 'Versionable v2',
      });
    });

    it('archives a definition with an archive record diffing archivedAt', async () => {
      const workflow = await service.createWorkflowDefinition({
        actor: 'user-1',
        title: 'Archivable',
        workflowType: 'idea_triage',
      });

      const archived = await service.archiveWorkflow(workflow.id, 'user-1');

      expect(archived.archivedAt).toBe(NOW);
      const records = await provenanceRecords();
      expect(records).toHaveLength(2);
      const payload = records[1].payload as {
        action: string;
        before: { archivedAt: string | null };
        after: { archivedAt: string | null };
      };
      expect(payload.action).toBe('archive');
      expect(payload.before.archivedAt).toBeNull();
      expect(payload.after.archivedAt).toBe(NOW);
    });

    it('throws WorkflowNotFoundError for unknown ids without persisting anything', async () => {
      await expect(
        service.updateWorkflowDraft('no-such-id', { title: 'X' }, 'user-1'),
      ).rejects.toThrow(WorkflowNotFoundError);
      await expect(
        service.archiveWorkflow('no-such-id', 'user-1'),
      ).rejects.toThrow(WorkflowNotFoundError);
      await expect(
        service.createWorkflowVersion('no-such-id', {}, 'user-1'),
      ).rejects.toThrow(WorkflowNotFoundError);

      expect(await count('workflows')).toBe(0);
      expect(await count('records')).toBe(0);
    });

    it('rolls back both sides when the mutation itself is rejected', async () => {
      const workflow = await service.createWorkflowDefinition({
        actor: 'user-1',
        title: 'Frozen',
        workflowType: 'task_execution',
      });
      await service.publishWorkflow(workflow.id, 'user-1');
      const recordsBefore = await count('records');

      // The published definition is immutable; the update is rejected and no
      // provenance record for it may survive.
      await expect(
        service.updateWorkflowDraft(workflow.id, { title: 'Hacked' }, 'user-2'),
      ).rejects.toThrow(/immutable/);

      const stored = await new SqliteWorkflowRepository(db).getById(workflow.id);
      expect(stored?.title).toBe('Frozen');
      expect(stored?.publishedAt).not.toBeNull();
      expect(await count('records')).toBe(recordsBefore);
    });

    it('rolls back the mutation when the provenance append fails', async () => {
      const failingRecords: RecordRepository = {
        add: async () => {
          throw new Error('records table locked');
        },
        getById: async () => null,
      };
      const failingService = new WorkflowService<SqliteDatabase>({
        unitOfWork: sqliteUnitOfWork(db),
        workflows: (context) => new SqliteWorkflowRepository(context),
        records: () => failingRecords,
        readWorkflows: new SqliteWorkflowRepository(db),
        clock: fixedClock,
        ids: fixedIds,
      });

      await expect(
        failingService.createWorkflowDefinition({
          actor: 'user-1',
          title: 'Lost',
          workflowType: 'task_execution',
        }),
      ).rejects.toThrow(ProvenancePersistenceError);

      expect(await count('workflows')).toBe(0);
      expect(await count('records')).toBe(0);
    });

    it('rolls back a persisted workflow when its mutation reports failure', async () => {
      const failingService = new WorkflowService<SqliteDatabase>({
        unitOfWork: sqliteUnitOfWork(db),
        workflows: (context) => {
          const repository = new SqliteWorkflowRepository(context);
          return {
            add: async (workflow) => {
              await repository.add(workflow);
              throw new Error('workflow write acknowledgement lost');
            },
            getById: repository.getById.bind(repository),
            save: repository.save.bind(repository),
            list: repository.list.bind(repository),
          };
        },
        records: (context) => new SqliteRecordRepository(context),
        readWorkflows: new SqliteWorkflowRepository(db),
        clock: fixedClock,
        ids: fixedIds,
      });

      await expect(
        failingService.createWorkflowDefinition({
          actor: 'user-1',
          title: 'Rollback me',
          workflowType: 'task_execution',
        }),
      ).rejects.toThrow(MutationPersistenceError);

      expect(await count('workflows')).toBe(0);
      expect(await count('records')).toBe(0);
    });

    it('rejects invalid provenance commands before any persistence', async () => {
      await expect(
        service.createWorkflowDefinition({
          actor: '',
          title: 'No actor',
          workflowType: 'task_execution',
        }),
      ).rejects.toThrow(ProvenanceValidationError);

      expect(await count('workflows')).toBe(0);
      expect(await count('records')).toBe(0);
    });
  });

  describe('acceptance: every Feature #23 workflow type', () => {
    const WORKFLOW_TYPES = [
      'project_management',
      'goal_decomposition',
      'goal_execution',
      'task_decomposition',
      'task_execution',
      'idea_triage',
    ];

    it.each(WORKFLOW_TYPES)(
      'creates and discovers a %s definition',
      async (workflowType) => {
        await service.createWorkflowDefinition({
          actor: 'user-1',
          title: `${workflowType} workflow`,
          workflowType,
        });

        const result = await service.discover({ workflowType });

        expect(result.kind).toBe('found');
        if (result.kind === 'found') {
          expect(result.workflow.workflowType).toBe(workflowType);
        }
      },
    );
  });
});
