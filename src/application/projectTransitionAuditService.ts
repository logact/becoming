import { isCoreEntityType } from '../domain/entityTypes';
import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import { createRecord } from '../domain/record';
import type { Record } from '../domain/record';
import {
  buildStateTransitionAuditPayload,
  STATE_TRANSITION_RECORD_TYPE,
  stateTransitionAuditPayloadToJson,
} from '../domain/stateTransitionAudit';
import type { EvaluationResultInput } from '../domain/stateTransitionAudit';
import type { LabelRepository } from '../persistence/labelRepository';
import type { RecordRepository } from '../persistence/recordRepository';
import { withTransaction } from '../persistence/transactions';
import type { SqliteDatabase } from '../persistence/database';
import { LabelNotFoundError } from './labelAssignmentService';
import {
  LifecycleAuditPersistenceError,
  LifecycleAuditValidationError,
  LifecycleEntityNotFoundError,
} from './lifecycleAuditService';
import {
  ProjectTransitionExecutionService,
} from './projectTransitionExecutionService';
import type {
  ExecuteProjectTransitionCommand,
  ExecutedProjectTransition,
} from './projectTransitionExecutionService';
import { ProjectNotFoundError } from './projectStateService';
import type { ProjectLookup } from './projectStateService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';

/** Logical lookup for the independently stored core entity being moved. */
export interface ProjectTransitionAuditEntityLookup {
  exists(entityType: CoreEntityType, id: EntityId): Promise<boolean>;
}

/**
 * The command accepted by the concrete lifecycle executor plus the actor that
 * caused the move.  The machine edge and source State deliberately are not
 * caller supplied: #55 resolves them while validating the current runtime
 * state, and the resulting accepted decision is the audit source of truth.
 */
export interface ExecuteAuditedProjectTransitionCommand
  extends ExecuteProjectTransitionCommand {
  actor: string;
  title?: string;
  description?: string;
}

export interface AuditedProjectTransition {
  transition: ExecutedProjectTransition;
  audit: Record;
}

export interface ProjectTransitionAuditServicePorts {
  db: SqliteDatabase;
  /** #55's runtime executor; it must be configured against this same DB. */
  execution: ProjectTransitionExecutionService;
  records: (context: SqliteDatabase) => RecordRepository;
  projects: (context: SqliteDatabase) => ProjectLookup;
  labels: (context: SqliteDatabase) => LabelRepository;
  entities: (context: SqliteDatabase) => ProjectTransitionAuditEntityLookup;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * The production handoff between #55's validated state-history executor and
 * #77's append-only audit payload.  Its single immediate SQLite transaction
 * ensures a successful lifecycle move has one closed period, one new current
 * period, and exactly one matching Record; any validation or persistence
 * error rolls the entire operation back.
 */
export class ProjectTransitionAuditService {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: ProjectTransitionAuditServicePorts) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async transition(
    command: ExecuteAuditedProjectTransitionCommand,
  ): Promise<AuditedProjectTransition> {
    this.validateCommand(command);
    const occurredAt = command.occurredAt ?? this.clock.now();

    return withTransaction(this.ports.db, async (context) => {
      // These logical references have no database foreign keys.  Resolve them
      // before #55 can close a period, so unknown entities reject without any
      // state-history or Record write.
      await this.resolveOwnership(context, command);

      // Revalidation, close, and open all happen inside this caller-owned
      // transaction.  The returned validation snapshot is authoritative even
      // if a stale caller raced another successful command.
      const transition = await this.ports.execution.transitionInTransaction(
        context,
        { ...command, occurredAt },
      );
      const payload = buildStateTransitionAuditPayload({
        projectId: command.projectId,
        entityType: transition.validation.currentState.entityType,
        entityId: command.entityId,
        labelId: command.labelId,
        fromProjectStateId: transition.validation.sourceState.id,
        toProjectStateId: transition.validation.destinationState.id,
        projectTransitionId: transition.validation.transition.id,
        actor: command.actor,
        occurredAt,
        snapshot: {
          fromState: {
            title: transition.validation.sourceState.title,
            category: transition.validation.sourceState.category,
          },
          toState: {
            title: transition.validation.destinationState.title,
            category: transition.validation.destinationState.category,
          },
          transition: { title: transition.validation.transition.title },
          label: { name: (await this.ports.labels(context).getById(command.labelId))!.name },
        },
        evaluation: evaluationFrom(transition),
      });
      const audit = createRecord(
        {
          title: command.title,
          description:
            command.description ??
            `state_transition ${payload.entityType} ${payload.entityId}: ${payload.snapshot.fromState.title} -> ${payload.snapshot.toState.title}`,
          recordType: STATE_TRANSITION_RECORD_TYPE,
          occurredAt,
          recordedAt: this.clock.now(),
          actor: command.actor,
          payload: stateTransitionAuditPayloadToJson(payload),
        },
        { id: this.ids.newId(), now: this.clock.now() },
      );
      try {
        await this.ports.records(context).add(audit);
      } catch (error) {
        throw new LifecycleAuditPersistenceError(
          payload.entityType,
          payload.entityId,
          error,
        );
      }
      return { transition, audit };
    });
  }

  private validateCommand(command: ExecuteAuditedProjectTransitionCommand): void {
    if (command.actor.trim().length === 0) {
      throw new LifecycleAuditValidationError('State-transition audit actor must not be blank');
    }
    if (
      command.occurredAt !== undefined &&
      (command.occurredAt.trim().length === 0 || Number.isNaN(Date.parse(command.occurredAt)))
    ) {
      throw new LifecycleAuditValidationError('State-transition audit occurredAt must be a valid ISO 8601 timestamp');
    }
  }

  private async resolveOwnership(
    context: SqliteDatabase,
    command: ExecuteAuditedProjectTransitionCommand,
  ): Promise<void> {
    if (!isAuditableEntityType(command.entityType)) {
      throw new LifecycleAuditValidationError(
        `State-transition audit entityType must be a core entity type, got ${JSON.stringify(command.entityType)}`,
      );
    }
    if ((await this.ports.projects(context).getById(command.projectId)) === null) {
      throw new ProjectNotFoundError(command.projectId);
    }
    if ((await this.ports.labels(context).getById(command.labelId)) === null) {
      throw new LabelNotFoundError(command.labelId);
    }
    if (!(await this.ports.entities(context).exists(command.entityType, command.entityId))) {
      throw new LifecycleEntityNotFoundError(command.entityType, command.entityId);
    }
  }
}

function isAuditableEntityType(value: string): value is CoreEntityType {
  return isCoreEntityType(value);
}

/**
 * Validation only exposes a passed flag and opaque evidence.  Persist the
 * accepted outcomes without serializing evaluator inputs/evidence, which may
 * contain confidential values.  Rejected evaluations never reach this point.
 */
function evaluationFrom(
  transition: ExecutedProjectTransition,
): { conditions: EvaluationResultInput[]; exitCriteria: EvaluationResultInput[] } {
  const accepted = transition.validation;
  return {
    conditions: accepted.condition === null
      ? []
      : [{
          ruleId: `${accepted.transition.id}:condition`,
          outcome: 'satisfied',
          summary: 'Transition condition satisfied',
        }],
    exitCriteria: accepted.exitCriteria === null
      ? []
      : [{
          ruleId: `${accepted.sourceState.id}:exit_criteria`,
          outcome: 'satisfied',
          summary: 'Required exit criteria satisfied',
        }],
  };
}
