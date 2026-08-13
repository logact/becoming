import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import { isCoreEntityType } from '../domain/entityTypes';
import {
  buildStateTransitionAuditPayload,
  STATE_TRANSITION_RECORD_TYPE,
  stateTransitionAuditPayloadToJson,
} from '../domain/stateTransitionAudit';
import type {
  EvaluationResultInput,
  StateTransitionAuditPayload,
} from '../domain/stateTransitionAudit';
import { createRecord } from '../domain/record';
import type { Record } from '../domain/record';
import type { RecordRepository } from '../persistence/recordRepository';
import type { LabelRepository } from '../persistence/labelRepository';
import type { ProjectStateRepository } from '../persistence/projectStateRepository';
import { ProjectNotFoundError } from './projectStateService';
import type { ProjectLookup } from './projectStateService';
import { LabelNotFoundError } from './labelAssignmentService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

/**
 * Application contract for the lifecycle-transition audit payload
 * (Feature #9): the transaction handoff between the lifecycle executor
 * (Feature #29) and the Record repository.
 *
 * `transitionWithAudit` resolves and validates every logical reference of one
 * accepted project-scoped transition, runs the executor's state-history
 * update through the `applyTransition` callback, and appends exactly one
 * `state_transition` audit Record — all inside a single unit of work, so the
 * state-history update and its audit commit or roll back together.
 *
 * Record-count, retry, and failure semantics:
 * - Exactly one accepted transition maps to exactly one `state_transition`
 *   Record. A rejected transition — invalid command, unresolved or mismatched
 *   reference, or an executor rejection thrown from `applyTransition` — maps
 *   to none.
 * - Command and payload validation run before any write; an invalid command
 *   throws `LifecycleAuditValidationError` and `applyTransition` is never
 *   called.
 * - An executor failure propagates unchanged and rolls the unit of work
 *   back: no state-history change and no audit Record survive.
 * - A failing audit append throws `LifecycleAuditPersistenceError` (original
 *   error preserved as `cause`); the unit of work rolls back, so the
 *   state-history update does not commit without its audit Record.
 * - Every failure is all-or-nothing, so the executor may retry the whole
 *   command after any failure — a failed attempt persists nothing to dedupe.
 *   Retrying an already-committed transition is rejected by the current-state
 *   check (the stored current state has advanced), which is what keeps
 *   committed transitions from being audited twice.
 *
 * Logical-reference integrity lives here because no table has database
 * foreign keys and there is no `entities` table. Every reference is validated
 * inside the unit of work against the owning boundary:
 * - `projectId` resolves through the `ProjectLookup` port;
 * - `labelId` resolves through `LabelRepository`;
 * - `entityType` + `entityId` resolve through the `LifecycleEntityLookup`
 *   port against the appropriate independent core entity table;
 * - the from/to Project States resolve through `ProjectStateRepository` and
 *   must belong to the machine `projectId + entityType + labelId`;
 * - the Project Transition resolves through the `ProjectTransitionLookup`
 *   port and must belong to the same machine and connect exactly the
 *   declared from/to states;
 * - the current `project_entity_states` row resolves through the
 *   `ProjectEntityStateLookup` port and must still point at the declared
 *   from-state.
 * Existence is validated, not archival status: a state or label archived
 * after occupancy must stay auditable. Machine-definition edits after the
 * commit never rewrite the stored audit — the payload's immutable snapshots
 * keep the event meaningful (see `src/domain/stateTransitionAudit.ts`).
 *
 * The `ProjectTransitionLookup` and `ProjectEntityStateLookup` ports are
 * structural seams: their concrete repositories land with Project transition
 * management and entity state history (Features #28/#29); any adapter
 * matching these shapes plugs in unchanged.
 */

/** Thrown when a transition command or its audit payload fails validation. */
export class LifecycleAuditValidationError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LifecycleAuditValidationError';
    this.cause = cause;
  }
}

/** Thrown when the managed core entity does not exist in its own table. */
export class LifecycleEntityNotFoundError extends Error {
  constructor(entityType: CoreEntityType, id: EntityId) {
    super(`Lifecycle entity ${entityType} ${id} not found`);
    this.name = 'LifecycleEntityNotFoundError';
  }
}

/** Thrown when a from/to Project State id does not resolve. */
export class LifecycleStateNotFoundError extends Error {
  constructor(role: 'from' | 'to', id: EntityId) {
    super(`Lifecycle ${role}-state ${id} not found`);
    this.name = 'LifecycleStateNotFoundError';
  }
}

/**
 * Thrown when a resolved Project State or the Project Transition belongs to a
 * different machine than `projectId + entityType + labelId`.
 */
export class LifecycleMachineMismatchError extends Error {
  constructor(detail: string) {
    super(`Lifecycle machine mismatch: ${detail}`);
    this.name = 'LifecycleMachineMismatchError';
  }
}

/** Thrown when the Project Transition id does not resolve. */
export class LifecycleTransitionNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Project transition ${id} not found`);
    this.name = 'LifecycleTransitionNotFoundError';
  }
}

/**
 * Thrown when the resolved Project Transition does not connect the declared
 * from/to states.
 */
export class LifecycleTransitionMismatchError extends Error {
  constructor(id: EntityId) {
    super(
      `Project transition ${id} does not connect the declared from/to states`,
    );
    this.name = 'LifecycleTransitionMismatchError';
  }
}

/** Thrown when the entity has no active state-history row in this machine. */
export class CurrentStateNotFoundError extends Error {
  constructor(
    projectId: EntityId,
    entityType: CoreEntityType,
    entityId: EntityId,
    labelId: EntityId,
  ) {
    super(
      `No current project_entity_states row for ${projectId}/${entityType}/${entityId}/${labelId}`,
    );
    this.name = 'CurrentStateNotFoundError';
  }
}

/**
 * Thrown when the stored current state no longer matches the declared
 * from-state — the transition was already applied or the machine moved on.
 * This is what makes retrying a committed transition safe.
 */
export class CurrentStateMismatchError extends Error {
  constructor(currentStateId: EntityId, declaredFromStateId: EntityId) {
    super(
      `Current state ${currentStateId} does not match the declared from-state ${declaredFromStateId}`,
    );
    this.name = 'CurrentStateMismatchError';
  }
}

/**
 * Thrown when appending the audit Record fails inside the unit of work. The
 * transaction rolls back — including the state-history update — and the
 * underlying error is preserved as `cause`.
 */
export class LifecycleAuditPersistenceError extends Error {
  readonly cause?: unknown;

  constructor(entityType: string, entityId: EntityId, cause: unknown) {
    super(
      `Lifecycle audit append for ${entityType} ${entityId} failed and the transition was rolled back`,
    );
    this.name = 'LifecycleAuditPersistenceError';
    this.cause = cause;
  }
}

/**
 * Logical-reference lookup for the managed core entity. Implemented over the
 * per-aggregate repository boundaries; the database never enforces it.
 */
export interface LifecycleEntityLookup {
  exists(entityType: CoreEntityType, id: EntityId): Promise<boolean>;
}

/**
 * The reference shape of a Project Transition the audit contract needs. The
 * full ProjectTransition aggregate and its repository arrive with Project
 * transition management (Feature #28); any repository whose `getById`
 * resolves these fields satisfies this port structurally.
 */
export interface ProjectTransitionRef {
  id: EntityId;
  projectId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
  fromStateId: EntityId;
  toStateId: EntityId;
  title: string | null;
}

/** Logical-reference lookup for the executed Project Transition. */
export interface ProjectTransitionLookup {
  getById(id: EntityId): Promise<ProjectTransitionRef | null>;
}

/** The current state-history row of one entity in one machine. */
export interface CurrentEntityState {
  id: EntityId;
  projectStateId: EntityId;
}

/**
 * Logical-reference lookup for the current `project_entity_states` row (the
 * active row with `ended_at IS NULL`). The owning repository arrives with
 * entity state history (Feature #29); any adapter matching this shape
 * satisfies the port structurally.
 */
export interface ProjectEntityStateLookup {
  getCurrent(query: {
    projectId: EntityId;
    entityType: CoreEntityType;
    entityId: EntityId;
    labelId: EntityId;
  }): Promise<CurrentEntityState | null>;
}

/**
 * Command for auditing one accepted lifecycle transition. `occurredAt` is the
 * transition time and defaults to the clock's current time. `evaluation`
 * carries the redacted condition/exit-criteria results. `applyTransition` is
 * the executor handoff: it performs the `project_entity_states` history
 * update (ending the current row and inserting the new one) against
 * repositories bound to the unit-of-work context and returns its result;
 * throwing rejects the transition and rolls everything back.
 */
export interface TransitionWithAuditCommand<TContext, TResult> {
  projectId: EntityId;
  entityType: string;
  entityId: EntityId;
  labelId: EntityId;
  fromProjectStateId: EntityId;
  toProjectStateId: EntityId;
  projectTransitionId: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
  title?: string;
  description?: string;
  evaluation?: {
    conditions?: readonly EvaluationResultInput[];
    exitCriteria?: readonly EvaluationResultInput[];
  };
  applyTransition: (context: TContext) => Promise<TResult>;
}

/** The outcome of one audited transition: the executor result and its Record. */
export interface AuditedTransition<TResult> {
  result: TResult;
  audit: Record;
}

export interface LifecycleAuditServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  /** Bind a Record repository to the unit-of-work context. */
  records: (context: TContext) => RecordRepository;
  /** Bind the Project lookup to the unit-of-work context. */
  projects: (context: TContext) => ProjectLookup;
  /** Bind a Label repository to the unit-of-work context. */
  labels: (context: TContext) => LabelRepository;
  /** Bind a ProjectState repository to the unit-of-work context. */
  states: (context: TContext) => ProjectStateRepository;
  /** Bind the Project Transition lookup to the unit-of-work context. */
  transitions: (context: TContext) => ProjectTransitionLookup;
  /** Bind the current entity-state lookup to the unit-of-work context. */
  entityStates: (context: TContext) => ProjectEntityStateLookup;
  /** Bind the core-entity lookup to the unit-of-work context. */
  entities: (context: TContext) => LifecycleEntityLookup;
  clock?: Clock;
  ids?: IdGenerator;
}

export class LifecycleAuditService<TContext> {
  private readonly unitOfWork: UnitOfWork<TContext>;
  private readonly records: (context: TContext) => RecordRepository;
  private readonly projects: (context: TContext) => ProjectLookup;
  private readonly labels: (context: TContext) => LabelRepository;
  private readonly states: (context: TContext) => ProjectStateRepository;
  private readonly transitions: (context: TContext) => ProjectTransitionLookup;
  private readonly entityStates: (context: TContext) => ProjectEntityStateLookup;
  private readonly entities: (context: TContext) => LifecycleEntityLookup;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(ports: LifecycleAuditServicePorts<TContext>) {
    this.unitOfWork = ports.unitOfWork;
    this.records = ports.records;
    this.projects = ports.projects;
    this.labels = ports.labels;
    this.states = ports.states;
    this.transitions = ports.transitions;
    this.entityStates = ports.entityStates;
    this.entities = ports.entities;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  /**
   * Audit one accepted lifecycle transition atomically with its state-history
   * update. Returns the executor result and the appended audit Record. See
   * the class documentation for validation, Record-count, retry, and failure
   * semantics.
   */
  async transitionWithAudit<TResult>(
    command: TransitionWithAuditCommand<TContext, TResult>,
  ): Promise<AuditedTransition<TResult>> {
    return this.unitOfWork.run(async (context) => {
      const resolved = await this.resolveReferences(context, command);
      const payload = this.buildPayload(command, resolved);
      // The executor handoff: rejection propagates and rolls the unit of
      // work back, so a rejected transition maps to no audit Record.
      const result = await command.applyTransition(context);
      const audit = this.buildAuditRecord(command, payload);
      try {
        await this.records(context).add(audit);
      } catch (error) {
        throw new LifecycleAuditPersistenceError(
          payload.entityType,
          payload.entityId,
          error,
        );
      }
      return { result, audit };
    });
  }

  /**
   * Resolve and validate every logical reference of the command inside the
   * unit of work, before any write. Returns the resolved Label, States, and
   * Transition for snapshotting.
   */
  private async resolveReferences(
    context: TContext,
    command: TransitionWithAuditCommand<TContext, unknown>,
  ) {
    if (!isCoreEntityType(command.entityType)) {
      throw new LifecycleAuditValidationError(
        `State-transition audit entityType must be a core entity type, got ${JSON.stringify(command.entityType)}`,
      );
    }
    const entityType = command.entityType;
    const project = await this.projects(context).getById(command.projectId);
    if (project === null) {
      throw new ProjectNotFoundError(command.projectId);
    }
    const label = await this.labels(context).getById(command.labelId);
    if (label === null) {
      throw new LabelNotFoundError(command.labelId);
    }
    if (!(await this.entities(context).exists(entityType, command.entityId))) {
      throw new LifecycleEntityNotFoundError(entityType, command.entityId);
    }
    const states = this.states(context);
    const fromState = await states.getById(command.fromProjectStateId);
    if (fromState === null) {
      throw new LifecycleStateNotFoundError('from', command.fromProjectStateId);
    }
    const toState = await states.getById(command.toProjectStateId);
    if (toState === null) {
      throw new LifecycleStateNotFoundError('to', command.toProjectStateId);
    }
    for (const [role, state] of [
      ['from', fromState],
      ['to', toState],
    ] as const) {
      if (
        state.projectId !== command.projectId ||
        state.entityType !== entityType ||
        state.labelId !== command.labelId
      ) {
        throw new LifecycleMachineMismatchError(
          `${role}-state ${state.id} belongs to machine ${state.projectId}/${state.entityType}/${state.labelId}, not ${command.projectId}/${entityType}/${command.labelId}`,
        );
      }
    }
    const transition = await this.transitions(context).getById(
      command.projectTransitionId,
    );
    if (transition === null) {
      throw new LifecycleTransitionNotFoundError(command.projectTransitionId);
    }
    if (
      transition.projectId !== command.projectId ||
      transition.entityType !== entityType ||
      transition.labelId !== command.labelId
    ) {
      throw new LifecycleMachineMismatchError(
        `transition ${transition.id} belongs to machine ${transition.projectId}/${transition.entityType}/${transition.labelId}, not ${command.projectId}/${entityType}/${command.labelId}`,
      );
    }
    if (
      transition.fromStateId !== command.fromProjectStateId ||
      transition.toStateId !== command.toProjectStateId
    ) {
      throw new LifecycleTransitionMismatchError(transition.id);
    }
    const current = await this.entityStates(context).getCurrent({
      projectId: command.projectId,
      entityType,
      entityId: command.entityId,
      labelId: command.labelId,
    });
    if (current === null) {
      throw new CurrentStateNotFoundError(
        command.projectId,
        entityType,
        command.entityId,
        command.labelId,
      );
    }
    if (current.projectStateId !== command.fromProjectStateId) {
      throw new CurrentStateMismatchError(
        current.projectStateId,
        command.fromProjectStateId,
      );
    }
    return { entityType, label, fromState, toState, transition };
  }

  /**
   * Build the validated audit payload from the command and the resolved
   * references, freezing the descriptive snapshots at transition time.
   */
  private buildPayload(
    command: TransitionWithAuditCommand<TContext, unknown>,
    resolved: {
      entityType: CoreEntityType;
      label: { name: string };
      fromState: { title: string; category: string | null };
      toState: { title: string; category: string | null };
      transition: { title: string | null };
    },
  ): StateTransitionAuditPayload {
    try {
      return buildStateTransitionAuditPayload({
        projectId: command.projectId,
        entityType: resolved.entityType,
        entityId: command.entityId,
        labelId: command.labelId,
        fromProjectStateId: command.fromProjectStateId,
        toProjectStateId: command.toProjectStateId,
        projectTransitionId: command.projectTransitionId,
        actor: command.actor,
        occurredAt: command.occurredAt ?? this.clock.now(),
        snapshot: {
          fromState: {
            title: resolved.fromState.title,
            category: resolved.fromState.category,
          },
          toState: {
            title: resolved.toState.title,
            category: resolved.toState.category,
          },
          transition: { title: resolved.transition.title },
          label: { name: resolved.label.name },
        },
        evaluation: command.evaluation,
      });
    } catch (error) {
      throw new LifecycleAuditValidationError(
        error instanceof Error ? error.message : String(error),
        error,
      );
    }
  }

  /**
   * Build the audit Record for a validated payload. It is appended directly
   * through the Record repository in the same unit of work as the
   * state-history update — exactly one Record per accepted transition.
   */
  private buildAuditRecord(
    command: TransitionWithAuditCommand<TContext, unknown>,
    payload: StateTransitionAuditPayload,
  ): Record {
    return createRecord(
      {
        title: command.title,
        description:
          command.description ??
          `state_transition ${payload.entityType} ${payload.entityId}: ${payload.snapshot.fromState.title} -> ${payload.snapshot.toState.title}`,
        recordType: STATE_TRANSITION_RECORD_TYPE,
        occurredAt: payload.occurredAt,
        recordedAt: this.clock.now(),
        actor: payload.actor,
        payload: stateTransitionAuditPayloadToJson(payload),
      },
      { id: this.ids.newId(), now: this.clock.now() },
    );
  }
}
