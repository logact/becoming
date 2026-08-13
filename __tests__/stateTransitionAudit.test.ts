import { CORE_ENTITY_TYPES } from '../src/domain/entityTypes';
import type { CoreEntityType } from '../src/domain/entityTypes';
import {
  buildStateTransitionAuditPayload,
  EVALUATION_OUTCOMES,
  STATE_TRANSITION_AUDIT_SCHEMA_VERSION,
  STATE_TRANSITION_RECORD_TYPE,
  stateTransitionAuditPayloadToJson,
} from '../src/domain/stateTransitionAudit';
import type { StateTransitionAuditInput } from '../src/domain/stateTransitionAudit';
import { RECORD_TYPES } from '../src/domain/record';
import type { Record } from '../src/domain/record';
import {
  archiveProjectState,
  createProjectState,
  updateProjectState,
} from '../src/domain/projectState';
import {
  CurrentStateMismatchError,
  CurrentStateNotFoundError,
  LifecycleAuditPersistenceError,
  LifecycleAuditService,
  LifecycleAuditValidationError,
  LifecycleEntityNotFoundError,
  LifecycleMachineMismatchError,
  LifecycleStateNotFoundError,
  LifecycleTransitionMismatchError,
  LifecycleTransitionNotFoundError,
} from '../src/application/lifecycleAuditService';
import type {
  LifecycleEntityLookup,
  ProjectEntityStateLookup,
  ProjectTransitionLookup,
  TransitionWithAuditCommand,
} from '../src/application/lifecycleAuditService';
import { ProjectNotFoundError } from '../src/application/projectStateService';
import type { ProjectLookup } from '../src/application/projectStateService';
import { LabelNotFoundError } from '../src/application/labelAssignmentService';
import { SqliteLabelRepository } from '../src/persistence/labelRepository';
import { SqliteProjectStateRepository } from '../src/persistence/projectStateRepository';
import { SqliteRecordRepository } from '../src/persistence/recordRepository';
import type { RecordRepository } from '../src/persistence/recordRepository';
import { sqliteUnitOfWork } from '../src/persistence/transactions';
import type { SqliteDatabase } from '../src/persistence/database';
import { createTestDatabase } from './helpers/testDatabase';

const TRANSITION_TIME = '2026-08-12T10:00:00.000Z';
const RECORDED_AT = '2026-08-12T11:00:00.000Z';
const NOW = '2026-08-12T09:00:00.000Z';

const fixedClock = { now: () => RECORDED_AT };
let idCounter = 0;
const fixedIds = { newId: () => `audit-${++idCounter}` };

function payloadInput(
  overrides: Partial<StateTransitionAuditInput> = {},
): StateTransitionAuditInput {
  return {
    projectId: 'proj-1',
    entityType: 'goal',
    entityId: 'goal-1',
    labelId: 'label-1',
    fromProjectStateId: 'state-from',
    toProjectStateId: 'state-to',
    projectTransitionId: 'trans-1',
    actor: 'user-1',
    occurredAt: TRANSITION_TIME,
    snapshot: {
      fromState: { title: 'Prototype', category: 'active' },
      toState: { title: 'UI Design', category: 'active' },
      transition: { title: 'Start design' },
      label: { name: 'Feature' },
    },
    ...overrides,
  };
}

describe('state-transition audit payload (domain)', () => {
  it('identifies project, entity, label, states, transition, actor, and time', () => {
    const payload = buildStateTransitionAuditPayload(payloadInput());

    expect(payload).toMatchObject({
      schemaVersion: STATE_TRANSITION_AUDIT_SCHEMA_VERSION,
      projectId: 'proj-1',
      entityType: 'goal',
      entityId: 'goal-1',
      labelId: 'label-1',
      fromProjectStateId: 'state-from',
      toProjectStateId: 'state-to',
      projectTransitionId: 'trans-1',
      actor: 'user-1',
      occurredAt: TRANSITION_TIME,
    });
    expect(STATE_TRANSITION_AUDIT_SCHEMA_VERSION).toBe(1);
  });

  it('supports every core entity-type discriminator', () => {
    for (const entityType of CORE_ENTITY_TYPES) {
      const payload = buildStateTransitionAuditPayload(
        payloadInput({ entityType }),
      );
      expect(payload.entityType).toBe(entityType);
    }
    expect(CORE_ENTITY_TYPES).toHaveLength(8);
  });

  it('rejects a non-core entity type', () => {
    expect(() =>
      buildStateTransitionAuditPayload(payloadInput({ entityType: 'label' })),
    ).toThrow(/entityType/);
  });

  it('requires non-blank identifiers and actor', () => {
    for (const field of [
      'projectId',
      'entityId',
      'labelId',
      'fromProjectStateId',
      'toProjectStateId',
      'projectTransitionId',
      'actor',
    ] as const) {
      expect(() =>
        buildStateTransitionAuditPayload(payloadInput({ [field]: '  ' })),
      ).toThrow(new RegExp(field));
    }
  });

  it('requires a valid transition time', () => {
    expect(() =>
      buildStateTransitionAuditPayload(payloadInput({ occurredAt: 'soon' })),
    ).toThrow(/occurredAt/);
  });

  it('freezes descriptive snapshots and defaults evaluation to empty', () => {
    const payload = buildStateTransitionAuditPayload(payloadInput());

    expect(payload.snapshot).toEqual({
      fromState: { title: 'Prototype', category: 'active' },
      toState: { title: 'UI Design', category: 'active' },
      transition: { title: 'Start design' },
      label: { name: 'Feature' },
    });
    expect(payload.evaluation).toEqual({ conditions: [], exitCriteria: [] });
  });

  it('requires non-blank snapshot titles and label name', () => {
    const input = payloadInput();
    input.snapshot.fromState.title = ' ';
    expect(() => buildStateTransitionAuditPayload(input)).toThrow(
      /snapshot\.fromState\.title/,
    );
    const other = payloadInput();
    other.snapshot.label.name = '';
    expect(() => buildStateTransitionAuditPayload(other)).toThrow(
      /snapshot\.label\.name/,
    );
  });

  it('captures condition and exit-criteria outcomes with rule identifiers', () => {
    const payload = buildStateTransitionAuditPayload(
      payloadInput({
        evaluation: {
          conditions: [
            { ruleId: 'cond.review-approved', outcome: 'satisfied', summary: 'Review approved' },
          ],
          exitCriteria: [
            { ruleId: 'exit.prototype-tested', outcome: 'satisfied', summary: 'Prototype tested' },
            { ruleId: 'exit.docs', outcome: 'not_evaluated', summary: 'Docs optional' },
          ],
        },
      }),
    );

    expect(payload.evaluation.conditions).toEqual([
      { ruleId: 'cond.review-approved', outcome: 'satisfied', summary: 'Review approved' },
    ]);
    expect(payload.evaluation.exitCriteria).toHaveLength(2);
    expect(EVALUATION_OUTCOMES).toEqual([
      'satisfied',
      'not_satisfied',
      'not_evaluated',
    ]);
  });

  it('rejects unknown evaluation outcomes and blank rule fields', () => {
    expect(() =>
      buildStateTransitionAuditPayload(
        payloadInput({
          evaluation: {
            conditions: [{ ruleId: 'r1', outcome: 'maybe', summary: 'x' }],
          },
        }),
      ),
    ).toThrow(/outcome/);
    expect(() =>
      buildStateTransitionAuditPayload(
        payloadInput({
          evaluation: {
            exitCriteria: [{ ruleId: ' ', outcome: 'satisfied', summary: 'x' }],
          },
        }),
      ),
    ).toThrow(/ruleId/);
    expect(() =>
      buildStateTransitionAuditPayload(
        payloadInput({
          evaluation: {
            conditions: [{ ruleId: 'r1', outcome: 'satisfied', summary: '' }],
          },
        }),
      ),
    ).toThrow(/summary/);
  });

  it('redacts evaluation inputs: only rule id, outcome, and summary survive', () => {
    const payload = buildStateTransitionAuditPayload(
      payloadInput({
        evaluation: {
          conditions: [
            {
              ruleId: 'cond.budget',
              outcome: 'satisfied',
              summary: 'Within budget',
              // Sensitive evaluation inputs the evaluator produced; the
              // contract must drop them.
              inputs: { apiToken: 'secret', spent: 42 },
            } as unknown as { ruleId: string; outcome: string; summary: string },
          ],
        },
      }),
    );

    const json = JSON.stringify(stateTransitionAuditPayloadToJson(payload));
    expect(json).not.toContain('apiToken');
    expect(json).not.toContain('secret');
    expect(json).not.toContain('inputs');
    expect(payload.evaluation.conditions[0]).toEqual({
      ruleId: 'cond.budget',
      outcome: 'satisfied',
      summary: 'Within budget',
    });
  });

  it('serializes as lossless JSON with the schema version', () => {
    const payload = buildStateTransitionAuditPayload(
      payloadInput({
        evaluation: {
          conditions: [{ ruleId: 'r1', outcome: 'satisfied', summary: 'ok' }],
        },
      }),
    );

    const roundTripped = JSON.parse(
      JSON.stringify(stateTransitionAuditPayloadToJson(payload)),
    );
    expect(roundTripped).toEqual({
      schemaVersion: 1,
      projectId: 'proj-1',
      entityType: 'goal',
      entityId: 'goal-1',
      labelId: 'label-1',
      fromProjectStateId: 'state-from',
      toProjectStateId: 'state-to',
      projectTransitionId: 'trans-1',
      actor: 'user-1',
      occurredAt: TRANSITION_TIME,
      snapshot: {
        fromState: { title: 'Prototype', category: 'active' },
        toState: { title: 'UI Design', category: 'active' },
        transition: { title: 'Start design' },
        label: { name: 'Feature' },
      },
      evaluation: {
        conditions: [{ ruleId: 'r1', outcome: 'satisfied', summary: 'ok' }],
        exitCriteria: [],
      },
    });
  });

  it('adopts the state_transition record type in the default record-type policy', () => {
    expect(RECORD_TYPES).toContain(STATE_TRANSITION_RECORD_TYPE);
  });
});

describe('LifecycleAuditService (contract)', () => {
  let db: SqliteDatabase;
  let service: LifecycleAuditService<SqliteDatabase>;

  const PROJECT_ID = 'proj-1';
  const LABEL_ID = 'label-1';
  const FROM_STATE_ID = 'state-from';
  const TO_STATE_ID = 'state-to';
  const TRANSITION_ID = 'trans-1';
  const CURRENT_ROW_ID = 'pes-1';

  const ENTITY_TABLES: { [K in CoreEntityType]: string } = {
    task: 'tasks',
    goal: 'goals',
    project: 'projects',
    idea: 'ideas',
    philosophy: 'philosophies',
    workflow: 'workflows',
    resource: 'resources',
    record: 'records',
  };

  async function count(table: string): Promise<number> {
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table}`,
    );
    return row?.n ?? -1;
  }

  async function auditRecords(): Promise<Record[]> {
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM records WHERE record_type = ?`,
      [STATE_TRANSITION_RECORD_TYPE],
    );
    const repository = new SqliteRecordRepository(db);
    const records: Record[] = [];
    for (const row of rows) {
      records.push((await repository.getById(row.id)) as Record);
    }
    return records;
  }

  async function currentStateRow(): Promise<{
    id: string;
    project_state_id: string;
    ended_at: string | null;
  } | null> {
    return db.getFirstAsync(
      `SELECT id, project_state_id, ended_at FROM project_entity_states
       WHERE project_id = ? AND entity_type = ? AND entity_id = ? AND label_id = ?
         AND ended_at IS NULL`,
      [PROJECT_ID, 'goal', 'goal-1', LABEL_ID],
    );
  }

  // --- SQL-backed port adapters -------------------------------------------
  // The concrete Project Transition and entity-state repositories arrive with
  // Features #28/#29; these adapters satisfy the structural lookup ports over
  // the real migrated tables, so reference validation runs against actual
  // stored rows.

  function sqlProjects(context: SqliteDatabase): ProjectLookup {
    return {
      getById: async (id) => {
        const row = await context.getFirstAsync<{
          id: string;
          archived_at: string | null;
        }>(`SELECT id, archived_at FROM projects WHERE id = ?`, [id]);
        return row === null
          ? null
          : { id: row.id, archivedAt: row.archived_at };
      },
    };
  }

  function sqlTransitions(context: SqliteDatabase): ProjectTransitionLookup {
    return {
      getById: async (id) => {
        const row = await context.getFirstAsync<{
          id: string;
          project_id: string;
          entity_type: string;
          label_id: string;
          from_state_id: string;
          to_state_id: string;
          title: string | null;
        }>(
          `SELECT id, project_id, entity_type, label_id, from_state_id, to_state_id, title
           FROM project_state_transitions WHERE id = ?`,
          [id],
        );
        return row === null
          ? null
          : {
              id: row.id,
              projectId: row.project_id,
              entityType: row.entity_type as CoreEntityType,
              labelId: row.label_id,
              fromStateId: row.from_state_id,
              toStateId: row.to_state_id,
              title: row.title,
            };
      },
    };
  }

  function sqlEntityStates(context: SqliteDatabase): ProjectEntityStateLookup {
    return {
      getCurrent: async (query) => {
        const row = await context.getFirstAsync<{
          id: string;
          project_state_id: string;
        }>(
          `SELECT id, project_state_id FROM project_entity_states
           WHERE project_id = ? AND entity_type = ? AND entity_id = ? AND label_id = ?
             AND ended_at IS NULL`,
          [query.projectId, query.entityType, query.entityId, query.labelId],
        );
        return row === null
          ? null
          : { id: row.id, projectStateId: row.project_state_id };
      },
    };
  }

  function sqlEntities(context: SqliteDatabase): LifecycleEntityLookup {
    return {
      exists: async (entityType, id) => {
        const row = await context.getFirstAsync<{ id: string }>(
          `SELECT id FROM ${ENTITY_TABLES[entityType]} WHERE id = ?`,
          [id],
        );
        return row !== null;
      },
    };
  }

  function makeService(
    overrides: Partial<{
      records: (context: SqliteDatabase) => RecordRepository;
    }> = {},
  ): LifecycleAuditService<SqliteDatabase> {
    return new LifecycleAuditService<SqliteDatabase>({
      unitOfWork: sqliteUnitOfWork(db),
      records: (context) => new SqliteRecordRepository(context),
      projects: sqlProjects,
      labels: (context) => new SqliteLabelRepository(context),
      states: (context) => new SqliteProjectStateRepository(context),
      transitions: sqlTransitions,
      entityStates: sqlEntityStates,
      entities: sqlEntities,
      clock: fixedClock,
      ids: fixedIds,
      ...overrides,
    });
  }

  // --- Fixtures ------------------------------------------------------------

  async function insertProject(id: string): Promise<void> {
    await db.runAsync(
      `INSERT INTO projects (id, title, description, purpose, created_at, updated_at, archived_at)
       VALUES (?, ?, NULL, NULL, ?, ?, NULL)`,
      [id, `Project ${id}`, NOW, NOW],
    );
  }

  async function insertLabel(id: string, name: string): Promise<void> {
    await db.runAsync(
      `INSERT INTO labels (id, name, description, created_at, updated_at, archived_at)
       VALUES (?, ?, NULL, ?, ?, NULL)`,
      [id, name, NOW, NOW],
    );
  }

  async function insertEntity(
    entityType: CoreEntityType,
    id: string,
  ): Promise<void> {
    switch (entityType) {
      case 'task':
        await db.runAsync(
          `INSERT INTO tasks (id, title, target_description, created_at, updated_at)
           VALUES (?, 't', 'td', ?, ?)`,
          [id, NOW, NOW],
        );
        break;
      case 'goal':
        await db.runAsync(
          `INSERT INTO goals (id, title, target_state, created_at, updated_at)
           VALUES (?, 'g', 'gs', ?, ?)`,
          [id, NOW, NOW],
        );
        break;
      case 'project':
        await insertProject(id);
        break;
      case 'idea':
        await db.runAsync(
          `INSERT INTO ideas (id, title, idea_description, captured_at, created_at, updated_at)
           VALUES (?, 'i', 'id', ?, ?, ?)`,
          [id, NOW, NOW, NOW],
        );
        break;
      case 'philosophy':
        await db.runAsync(
          `INSERT INTO philosophies (id, title, created_at, updated_at)
           VALUES (?, 'p', ?, ?)`,
          [id, NOW, NOW],
        );
        break;
      case 'workflow':
        await db.runAsync(
          `INSERT INTO workflows (id, title, workflow_type, version, created_at, updated_at)
           VALUES (?, 'w', 'task_execution', 1, ?, ?)`,
          [id, NOW, NOW],
        );
        break;
      case 'resource':
        await db.runAsync(
          `INSERT INTO resources (id, title, resource_type, created_at, updated_at)
           VALUES (?, 'r', 'time', ?, ?)`,
          [id, NOW, NOW],
        );
        break;
      case 'record':
        await db.runAsync(
          `INSERT INTO records (id, description, record_type, occurred_at, recorded_at, created_at, updated_at)
           VALUES (?, 'd', 'action', ?, ?, ?, ?)`,
          [id, NOW, NOW, NOW, NOW],
        );
        break;
    }
  }

  async function insertTransition(
    id: string,
    overrides: {
      projectId?: string;
      entityType?: string;
      labelId?: string;
      fromStateId?: string;
      toStateId?: string;
      title?: string | null;
    } = {},
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO project_state_transitions (
         id, project_id, entity_type, label_id, from_state_id, to_state_id,
         title, description, condition, action, requires_exit_criteria,
         source_workflow_transition_id, created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, NULL, ?, ?, NULL)`,
      [
        id,
        overrides.projectId ?? PROJECT_ID,
        overrides.entityType ?? 'goal',
        overrides.labelId ?? LABEL_ID,
        overrides.fromStateId ?? FROM_STATE_ID,
        overrides.toStateId ?? TO_STATE_ID,
        overrides.title === undefined ? 'Start design' : overrides.title,
        NOW,
        NOW,
      ],
    );
  }

  async function insertCurrentStateRow(
    entityType: string,
    entityId: string,
    stateId: string,
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO project_entity_states (
         id, project_id, entity_type, entity_id, label_id, project_state_id,
         entered_at, ended_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [CURRENT_ROW_ID, PROJECT_ID, entityType, entityId, LABEL_ID, stateId, NOW, NOW],
    );
  }

  /**
   * Seed the default machine: project, label, two states, one transition, a
   * managed goal, and its current state-history row.
   */
  async function seedMachine(): Promise<void> {
    await insertProject(PROJECT_ID);
    await insertLabel(LABEL_ID, 'Feature');
    const states = new SqliteProjectStateRepository(db);
    await states.add(
      createProjectState(
        {
          projectId: PROJECT_ID,
          entityType: 'goal',
          labelId: LABEL_ID,
          title: 'Prototype',
          category: 'active',
        },
        { id: FROM_STATE_ID, now: NOW },
      ),
    );
    await states.add(
      createProjectState(
        {
          projectId: PROJECT_ID,
          entityType: 'goal',
          labelId: LABEL_ID,
          title: 'UI Design',
          category: 'active',
        },
        { id: TO_STATE_ID, now: NOW },
      ),
    );
    await insertTransition(TRANSITION_ID);
    await insertEntity('goal', 'goal-1');
    await insertCurrentStateRow('goal', 'goal-1', FROM_STATE_ID);
  }

  /** The executor handoff: end the current row and enter the to-state. */
  function applyTransition(
    context: SqliteDatabase,
    entityType: string,
    entityId: string,
    toStateId: string,
  ): Promise<void> {
    return (async () => {
      await context.runAsync(
        `UPDATE project_entity_states SET ended_at = ? WHERE id = ?`,
        [TRANSITION_TIME, CURRENT_ROW_ID],
      );
      await context.runAsync(
        `INSERT INTO project_entity_states (
           id, project_id, entity_type, entity_id, label_id, project_state_id,
           entered_at, ended_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          `pes-next-${++idCounter}`,
          PROJECT_ID,
          entityType,
          entityId,
          LABEL_ID,
          toStateId,
          TRANSITION_TIME,
          TRANSITION_TIME,
        ],
      );
    })();
  }

  function transitionCommand(
    overrides: Partial<
      TransitionWithAuditCommand<SqliteDatabase, unknown>
    > = {},
  ): TransitionWithAuditCommand<SqliteDatabase, unknown> {
    return {
      projectId: PROJECT_ID,
      entityType: 'goal',
      entityId: 'goal-1',
      labelId: LABEL_ID,
      fromProjectStateId: FROM_STATE_ID,
      toProjectStateId: TO_STATE_ID,
      projectTransitionId: TRANSITION_ID,
      actor: 'user-1',
      occurredAt: TRANSITION_TIME,
      applyTransition: (context) =>
        applyTransition(context, 'goal', 'goal-1', TO_STATE_ID),
      ...overrides,
    };
  }

  beforeEach(async () => {
    db = await createTestDatabase();
    service = makeService();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('commits the state-history update and exactly one audit Record atomically', async () => {
    await seedMachine();

    const { audit } = await service.transitionWithAudit(
      transitionCommand({
        evaluation: {
          conditions: [
            { ruleId: 'cond.review', outcome: 'satisfied', summary: 'Reviewed' },
          ],
          exitCriteria: [
            { ruleId: 'exit.prototype', outcome: 'satisfied', summary: 'Prototype done' },
          ],
        },
      }),
    );

    // The state history moved: the old row ended, a new active row exists.
    expect(await count('project_entity_states')).toBe(2);
    const current = await currentStateRow();
    expect(current?.project_state_id).toBe(TO_STATE_ID);
    expect(current?.ended_at).toBeNull();

    // Exactly one audit Record, carrying actor, transition time, and payload.
    const records = await auditRecords();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(audit.id);
    const record = records[0];
    expect(record.recordType).toBe(STATE_TRANSITION_RECORD_TYPE);
    expect(record.actor).toBe('user-1');
    expect(record.occurredAt).toBe(TRANSITION_TIME);
    expect(record.recordedAt).toBe(RECORDED_AT);
    expect(record.description).toBe(
      'state_transition goal goal-1: Prototype -> UI Design',
    );
    expect(record.payload).toEqual({
      schemaVersion: 1,
      projectId: PROJECT_ID,
      entityType: 'goal',
      entityId: 'goal-1',
      labelId: LABEL_ID,
      fromProjectStateId: FROM_STATE_ID,
      toProjectStateId: TO_STATE_ID,
      projectTransitionId: TRANSITION_ID,
      actor: 'user-1',
      occurredAt: TRANSITION_TIME,
      snapshot: {
        fromState: { title: 'Prototype', category: 'active' },
        toState: { title: 'UI Design', category: 'active' },
        transition: { title: 'Start design' },
        label: { name: 'Feature' },
      },
      evaluation: {
        conditions: [
          { ruleId: 'cond.review', outcome: 'satisfied', summary: 'Reviewed' },
        ],
        exitCriteria: [
          { ruleId: 'exit.prototype', outcome: 'satisfied', summary: 'Prototype done' },
        ],
      },
    });
  });

  it('audits transitions for every core entity-type discriminator', async () => {
    for (const entityType of CORE_ENTITY_TYPES) {
      await insertProject(PROJECT_ID);
      await insertLabel(LABEL_ID, 'Feature');
      const states = new SqliteProjectStateRepository(db);
      await states.add(
        createProjectState(
          {
            projectId: PROJECT_ID,
            entityType,
            labelId: LABEL_ID,
            title: 'Open',
            category: 'active',
          },
          { id: FROM_STATE_ID, now: NOW },
        ),
      );
      await states.add(
        createProjectState(
          {
            projectId: PROJECT_ID,
            entityType,
            labelId: LABEL_ID,
            title: 'Closed',
            category: 'completed',
          },
          { id: TO_STATE_ID, now: NOW },
        ),
      );
      await insertTransition(TRANSITION_ID, { entityType });
      const entityId = `entity-${entityType}`;
      await insertEntity(entityType, entityId);
      await insertCurrentStateRow(entityType, entityId, FROM_STATE_ID);

      await service.transitionWithAudit(
        transitionCommand({
          entityType,
          entityId,
          applyTransition: (context) =>
            applyTransition(context, entityType, entityId, TO_STATE_ID),
        }),
      );

      const records = await auditRecords();
      expect(records).toHaveLength(1);
      expect(records[0].payload).toMatchObject({
        entityType,
        entityId,
        fromProjectStateId: FROM_STATE_ID,
        toProjectStateId: TO_STATE_ID,
      });

      // Isolate the next discriminator from this one.
      await db.closeAsync();
      db = await createTestDatabase();
      service = makeService();
    }
  });

  it('rejects an invalid command before any write and never calls the executor', async () => {
    await seedMachine();
    let executorCalled = false;

    await expect(
      service.transitionWithAudit(
        transitionCommand({
          actor: '  ',
          applyTransition: async () => {
            executorCalled = true;
          },
        }),
      ),
    ).rejects.toThrow(LifecycleAuditValidationError);
    await expect(
      service.transitionWithAudit(transitionCommand({ entityType: 'label' })),
    ).rejects.toThrow(LifecycleAuditValidationError);
    await expect(
      service.transitionWithAudit(
        transitionCommand({
          evaluation: {
            conditions: [{ ruleId: 'r', outcome: 'bogus', summary: 'x' }],
          },
        }),
      ),
    ).rejects.toThrow(LifecycleAuditValidationError);

    expect(executorCalled).toBe(false);
    expect(await count('project_entity_states')).toBe(1);
    expect(await count('records')).toBe(0);
  });

  it('rejects unresolved project, label, and entity references with no Record', async () => {
    await seedMachine();

    await expect(
      service.transitionWithAudit(transitionCommand({ projectId: 'missing' })),
    ).rejects.toThrow(ProjectNotFoundError);
    await expect(
      service.transitionWithAudit(transitionCommand({ labelId: 'missing' })),
    ).rejects.toThrow(LabelNotFoundError);
    await expect(
      service.transitionWithAudit(transitionCommand({ entityId: 'missing' })),
    ).rejects.toThrow(LifecycleEntityNotFoundError);

    expect(await count('records')).toBe(0);
    expect((await currentStateRow())?.ended_at).toBeNull();
  });

  it('rejects unresolved from/to states with no Record', async () => {
    await seedMachine();

    await expect(
      service.transitionWithAudit(
        transitionCommand({ fromProjectStateId: 'missing' }),
      ),
    ).rejects.toThrow(LifecycleStateNotFoundError);
    await expect(
      service.transitionWithAudit(
        transitionCommand({ toProjectStateId: 'missing' }),
      ),
    ).rejects.toThrow(LifecycleStateNotFoundError);

    expect(await count('records')).toBe(0);
  });

  it('rejects states and transitions from a different machine', async () => {
    await seedMachine();
    // A second machine: same project, different label.
    await insertLabel('label-2', 'Release');
    const states = new SqliteProjectStateRepository(db);
    await states.add(
      createProjectState(
        {
          projectId: PROJECT_ID,
          entityType: 'goal',
          labelId: 'label-2',
          title: 'Proposed',
        },
        { id: 'state-other', now: NOW },
      ),
    );
    await insertTransition('trans-other', {
      labelId: 'label-2',
      fromStateId: 'state-other',
      toStateId: 'state-other',
    });

    await expect(
      service.transitionWithAudit(
        transitionCommand({ toProjectStateId: 'state-other' }),
      ),
    ).rejects.toThrow(LifecycleMachineMismatchError);
    await expect(
      service.transitionWithAudit(
        transitionCommand({ projectTransitionId: 'trans-other' }),
      ),
    ).rejects.toThrow(LifecycleMachineMismatchError);

    expect(await count('records')).toBe(0);
  });

  it('rejects an unknown transition or one connecting different states', async () => {
    await seedMachine();
    await insertTransition('trans-reverse', {
      fromStateId: TO_STATE_ID,
      toStateId: FROM_STATE_ID,
    });

    await expect(
      service.transitionWithAudit(
        transitionCommand({ projectTransitionId: 'missing' }),
      ),
    ).rejects.toThrow(LifecycleTransitionNotFoundError);
    await expect(
      service.transitionWithAudit(
        transitionCommand({ projectTransitionId: 'trans-reverse' }),
      ),
    ).rejects.toThrow(LifecycleTransitionMismatchError);

    expect(await count('records')).toBe(0);
  });

  it('rejects when no current state row exists or it points elsewhere', async () => {
    await seedMachine();
    // A real managed entity that was never placed into the machine.
    await insertEntity('goal', 'goal-2');

    await expect(
      service.transitionWithAudit(transitionCommand({ entityId: 'goal-2' })),
    ).rejects.toThrow(CurrentStateNotFoundError);

    // Move the current row to the to-state: the declared from-state no longer
    // matches the stored current state.
    await db.runAsync(
      `UPDATE project_entity_states SET project_state_id = ? WHERE id = ?`,
      [TO_STATE_ID, CURRENT_ROW_ID],
    );
    await expect(
      service.transitionWithAudit(transitionCommand()),
    ).rejects.toThrow(CurrentStateMismatchError);

    expect(await count('records')).toBe(0);
  });

  it('rolls back the state-history update when the executor rejects the transition', async () => {
    await seedMachine();

    const error = await service
      .transitionWithAudit(
        transitionCommand({
          applyTransition: async (context) => {
            await applyTransition(context, 'goal', 'goal-1', TO_STATE_ID);
            throw new Error('exit criteria not satisfied');
          },
        }),
      )
      .catch((caught: unknown) => caught);

    // The executor's rejection propagates unchanged and nothing is persisted:
    // a rejected transition maps to no Record and no state-history change.
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('exit criteria not satisfied');
    expect(await count('project_entity_states')).toBe(1);
    expect((await currentStateRow())?.project_state_id).toBe(FROM_STATE_ID);
    expect((await currentStateRow())?.ended_at).toBeNull();
    expect(await count('records')).toBe(0);
  });

  it('rolls back the state-history update when the audit append fails', async () => {
    await seedMachine();
    const failingRecords: RecordRepository = {
      add: async () => {
        throw new Error('records table locked');
      },
      getById: async () => null,
    };
    const failingService = makeService({ records: () => failingRecords });

    const error = await failingService
      .transitionWithAudit(transitionCommand())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(LifecycleAuditPersistenceError);
    expect((error as LifecycleAuditPersistenceError).cause).toBeInstanceOf(Error);
    expect(
      ((error as LifecycleAuditPersistenceError).cause as Error).message,
    ).toBe('records table locked');
    expect(await count('project_entity_states')).toBe(1);
    expect((await currentStateRow())?.project_state_id).toBe(FROM_STATE_ID);
    expect((await currentStateRow())?.ended_at).toBeNull();
    expect(await count('records')).toBe(0);
  });

  it('makes retries safe: a failed attempt commits nothing, a committed one cannot re-audit', async () => {
    await seedMachine();

    // First attempt fails inside the executor; nothing is persisted.
    await expect(
      service.transitionWithAudit(
        transitionCommand({
          applyTransition: async () => {
            throw new Error('transient failure');
          },
        }),
      ),
    ).rejects.toThrow('transient failure');
    expect(await count('records')).toBe(0);

    // Retrying the same command succeeds and appends exactly one Record.
    await service.transitionWithAudit(transitionCommand());
    expect(await auditRecords()).toHaveLength(1);

    // Retrying the committed transition is rejected by the current-state
    // check: the machine already advanced, so no duplicate audit appears.
    await expect(
      service.transitionWithAudit(transitionCommand()),
    ).rejects.toThrow(CurrentStateMismatchError);
    expect(await auditRecords()).toHaveLength(1);
  });

  it('maps two accepted transitions to exactly two audit Records', async () => {
    await seedMachine();
    // Second transition: UI Design -> Done.
    const states = new SqliteProjectStateRepository(db);
    await states.add(
      createProjectState(
        {
          projectId: PROJECT_ID,
          entityType: 'goal',
          labelId: LABEL_ID,
          title: 'Done',
          category: 'completed',
          isTerminal: true,
        },
        { id: 'state-done', now: NOW },
      ),
    );
    await insertTransition('trans-2', {
      fromStateId: TO_STATE_ID,
      toStateId: 'state-done',
      title: 'Finish',
    });

    await service.transitionWithAudit(transitionCommand());
    await service.transitionWithAudit(
      transitionCommand({
        fromProjectStateId: TO_STATE_ID,
        toProjectStateId: 'state-done',
        projectTransitionId: 'trans-2',
        applyTransition: (context) =>
          applyTransition(context, 'goal', 'goal-1', 'state-done'),
      }),
    );

    const records = await auditRecords();
    expect(records).toHaveLength(2);
    expect(new Set(records.map((record) => record.id)).size).toBe(2);
    expect(await count('project_entity_states')).toBe(3);
  });

  it('keeps the stored audit meaningful after machine definitions change or archive', async () => {
    await seedMachine();
    await service.transitionWithAudit(transitionCommand());

    // Later machine edits: rename both states and archive the destination.
    const states = new SqliteProjectStateRepository(db);
    const from = (await states.getById(FROM_STATE_ID))!;
    await states.save(
      updateProjectState(from, { title: 'Renamed Prototype' }, RECORDED_AT),
    );
    const to = (await states.getById(TO_STATE_ID))!;
    await states.save(
      archiveProjectState(
        updateProjectState(to, { title: 'Renamed Design' }, RECORDED_AT),
        RECORDED_AT,
      ),
    );

    // Resolution from the stored snapshots still explains the original event.
    const records = await auditRecords();
    expect(records).toHaveLength(1);
    expect(records[0].payload).toMatchObject({
      snapshot: {
        fromState: { title: 'Prototype', category: 'active' },
        toState: { title: 'UI Design', category: 'active' },
        transition: { title: 'Start design' },
        label: { name: 'Feature' },
      },
    });
  });
});
