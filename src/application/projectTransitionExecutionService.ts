import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  createProjectEntityState,
  endProjectEntityState,
} from '../domain/projectEntityState';
import type { ProjectEntityState } from '../domain/projectEntityState';
import { SqliteProjectEntityStateRepository } from '../persistence/projectEntityStateRepository';
import type { SqliteDatabase } from '../persistence/database';
import { withTransaction } from '../persistence/transactions';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import {
  ProjectTransitionValidationService,
} from './projectTransitionValidationService';
import type {
  ProjectTransitionAccepted,
  ProjectTransitionValidationResult,
  ValidateProjectTransitionRequest,
} from './projectTransitionValidationService';

/** A validation rejection is an expected non-mutating command outcome. */
export class ProjectTransitionRejectedError extends Error {
  constructor(readonly rejection: Exclude<ProjectTransitionValidationResult, { authorized: true }>) {
    super(`Project transition rejected: ${rejection.reason}`);
    this.name = 'ProjectTransitionRejectedError';
  }
}

export interface ExecuteProjectTransitionCommand extends ValidateProjectTransitionRequest {
  /** One authoritative instant is used for both closing and opening periods. */
  occurredAt?: IsoTimestamp;
}

export interface ExecutedProjectTransition {
  previous: ProjectEntityState;
  current: ProjectEntityState;
  validation: ProjectTransitionAccepted;
}

export interface ProjectTransitionExecutionServicePorts {
  db: SqliteDatabase;
  /** Must bind validation repositories to the supplied transaction context. */
  validation: (context: SqliteDatabase) => ProjectTransitionValidationService;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Commits a previously-defined Project transition. Validation is deliberately
 * repeated inside a BEGIN IMMEDIATE transaction, so a stale request cannot
 * close a newer current row. The service exposes `transitionInTransaction`
 * for LifecycleAuditService's UnitOfWork callback: caller-provided audit
 * records and state history therefore commit or roll back together.
 */
export class ProjectTransitionExecutionService {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: ProjectTransitionExecutionServicePorts) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async transition(command: ExecuteProjectTransitionCommand): Promise<ExecutedProjectTransition> {
    return withTransaction(this.ports.db, (context) =>
      this.transitionInTransaction(context, command),
    );
  }

  /**
   * Execute within a caller-owned transaction. It revalidates current state
   * immediately before the close/open pair, which makes this safe to use as
   * the `applyTransition` callback of LifecycleAuditService.
   */
  async transitionInTransaction(
    context: SqliteDatabase,
    command: ExecuteProjectTransitionCommand,
  ): Promise<ExecutedProjectTransition> {
    const validation = await this.ports.validation(context).validate(command);
    if (!validation.authorized) {
      throw new ProjectTransitionRejectedError(
        validation as Exclude<ProjectTransitionValidationResult, { authorized: true }>,
      );
    }

    const at = command.occurredAt ?? this.clock.now();
    const periods = new SqliteProjectEntityStateRepository(context);
    // Do not rely solely on the validation snapshot; check the exact current
    // row again before ending it. This also catches corrupt multi-current data.
    const latest = await periods.findCurrent({
      projectId: command.projectId,
      entityType: validation.currentState.entityType,
      entityId: command.entityId,
      labelId: command.labelId,
    });
    if (latest === null || latest.id !== validation.currentState.id ||
      latest.projectStateId !== validation.sourceState.id) {
      throw new ProjectTransitionRejectedError({
        authorized: false,
        reason: latest === null ? 'current_state_missing' : 'current_state_identity_mismatch',
      });
    }

    const previous = endProjectEntityState(latest, at);
    await periods.end(previous);
    const current = createProjectEntityState(
      {
        projectId: command.projectId,
        entityType: validation.destinationState.entityType,
        entityId: command.entityId,
        labelId: command.labelId,
        projectStateId: validation.destinationState.id,
        enteredAt: at,
      },
      { id: this.ids.newId(), now: at },
    );
    await periods.add(current);
    return { previous, current, validation };
  }
}

/** Raised when state history refers to a missing or wrong-machine State. */
export class ProjectEntityStateIdentityAnomalyError extends Error {
  constructor(
    readonly periodId: EntityId,
    readonly projectStateId: EntityId,
    detail: string,
  ) {
    super(`Project entity state ${periodId} has invalid Project State ${projectStateId}: ${detail}`);
    this.name = 'ProjectEntityStateIdentityAnomalyError';
  }
}

export interface ProjectEntityStateQueryServicePorts {
  db: SqliteDatabase;
  /** Resolves States from their owning aggregate; no foreign keys are used. */
  states: {
    getById(id: EntityId): Promise<{
      projectId: EntityId;
      entityType: CoreEntityType;
      labelId: EntityId;
    } | null>;
  };
}

/** Coherent current/history reads that expose legacy identity anomalies. */
export class ProjectEntityStateQueryService {
  constructor(private readonly ports: ProjectEntityStateQueryServicePorts) {}

  async getCurrent(context: {
    projectId: EntityId;
    entityType: CoreEntityType;
    entityId: EntityId;
    labelId: EntityId;
  }): Promise<ProjectEntityState | null> {
    const current = await new SqliteProjectEntityStateRepository(this.ports.db).findCurrent(context);
    if (current !== null) await this.assertStateIdentity(current);
    return current;
  }

  async listHistory(context: {
    projectId: EntityId;
    entityType: CoreEntityType;
    entityId: EntityId;
    labelId: EntityId;
  }): Promise<ProjectEntityState[]> {
    const history = await new SqliteProjectEntityStateRepository(this.ports.db).listHistory(context);
    for (const period of history) await this.assertStateIdentity(period);
    return history;
  }

  private async assertStateIdentity(period: ProjectEntityState): Promise<void> {
    const state = await this.ports.states.getById(period.projectStateId);
    if (state === null) {
      throw new ProjectEntityStateIdentityAnomalyError(period.id, period.projectStateId, 'state is missing');
    }
    if (state.projectId !== period.projectId || state.entityType !== period.entityType ||
      state.labelId !== period.labelId) {
      throw new ProjectEntityStateIdentityAnomalyError(
        period.id,
        period.projectStateId,
        `state belongs to ${state.projectId}/${state.entityType}/${state.labelId}`,
      );
    }
  }
}
