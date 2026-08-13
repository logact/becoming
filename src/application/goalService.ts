import type { EntityId, IsoTimestamp } from '../domain/ids';
import { archiveGoal, createGoal, updateGoal } from '../domain/goal';
import type { Goal, GoalChanges, NewGoal } from '../domain/goal';
import { MutationProvenanceService } from './mutationProvenanceService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';
import type { GoalListOptions, GoalRepository } from '../persistence/goalRepository';
import type { RecordRepository } from '../persistence/recordRepository';

/** Thrown when an intrinsic Goal command names no stored Goal. */
export class GoalNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Goal ${id} not found`);
    this.name = 'GoalNotFoundError';
  }
}

export interface CreateGoalCommand extends NewGoal {
  actor: string;
  occurredAt?: IsoTimestamp;
}

/** Framework-neutral ports for the intrinsic Goal mutation use cases. */
export interface GoalServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  goals: (context: TContext) => GoalRepository;
  records: (context: TContext) => RecordRepository;
  /** Read path used to build before/after snapshots and answer queries. */
  readGoals: GoalRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Application boundary for intrinsic Goal mutations. Project pursuit, goal
 * hierarchy, workflow state, labels, resources, and all relations remain out
 * of scope: this service owns only Goal definition and archival provenance.
 */
export class GoalService<TContext> {
  private readonly goals: (context: TContext) => GoalRepository;
  private readonly readGoals: GoalRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly provenance: MutationProvenanceService<TContext>;

  constructor(ports: GoalServicePorts<TContext>) {
    this.goals = ports.goals;
    this.readGoals = ports.readGoals;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.provenance = new MutationProvenanceService({
      unitOfWork: ports.unitOfWork,
      records: ports.records,
      clock: this.clock,
      ids: this.ids,
    });
  }

  async createGoal(command: CreateGoalCommand): Promise<Goal> {
    const goal = createGoal(command, {
      id: this.ids.newId(),
      now: this.clock.now(),
    });
    return this.provenance.mutateWithProvenance({
      entityType: 'goal', entityId: goal.id, action: 'create',
      actor: command.actor, occurredAt: command.occurredAt, after: snapshot(goal),
      mutate: async (context) => {
        await this.goals(context).add(goal);
        return goal;
      },
    });
  }

  async updateGoal(
    id: EntityId,
    changes: GoalChanges,
    actor: string,
    occurredAt?: IsoTimestamp,
  ): Promise<Goal> {
    const before = await this.requireGoal(id);
    const after = updateGoal(before, changes, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'goal', entityId: id, action: 'update', actor, occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.goals(context).save(after);
        return after;
      },
    });
  }

  /**
   * Archive is intentionally non-idempotent: an already archived Goal is an
   * invalid lifecycle transition and is rejected without a second record.
   */
  async archiveGoal(
    id: EntityId,
    actor: string,
    occurredAt?: IsoTimestamp,
  ): Promise<Goal> {
    const before = await this.requireGoal(id);
    const after = archiveGoal(before, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'goal', entityId: id, action: 'archive', actor, occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.goals(context).save(after);
        return after;
      },
    });
  }

  /**
   * Resolve a Goal by id regardless of archival state. `null` means no row
   * exists; an archived Goal is returned with its `archivedAt` intact, never
   * presented as missing.
   */
  async getGoal(id: EntityId): Promise<Goal | null> {
    return this.readGoals.getById(id);
  }

  /** Active Goals by default; use a named status to inspect history. */
  async listGoals(options?: GoalListOptions): Promise<Goal[]> {
    return this.readGoals.list(options);
  }

  async listActiveGoals(options?: Omit<GoalListOptions, 'status'>): Promise<Goal[]> {
    return this.readGoals.list({ ...options, status: 'active' });
  }

  async listArchivedGoals(options?: Omit<GoalListOptions, 'status'>): Promise<Goal[]> {
    return this.readGoals.list({ ...options, status: 'archived' });
  }

  async listGoalHistory(options?: Omit<GoalListOptions, 'status'>): Promise<Goal[]> {
    return this.readGoals.list({ ...options, status: 'all' });
  }

  private async requireGoal(id: EntityId): Promise<Goal> {
    const goal = await this.readGoals.getById(id);
    if (goal === null) throw new GoalNotFoundError(id);
    return goal;
  }
}

function snapshot(goal: Goal): { [field: string]: unknown } {
  return { ...goal };
}
