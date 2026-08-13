import {
  buildProvenancePayload,
  isMutationAction,
  PROVENANCE_RECORD_TYPE,
  provenancePayloadToJson,
  resolveFieldPolicy,
} from '../domain/mutationProvenance';
import type {
  EntitySnapshot,
  FieldSelectionPolicy,
  ProvenancePayload,
} from '../domain/mutationProvenance';
import { isCoreEntityType } from '../domain/entityTypes';
import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import { createRecord } from '../domain/record';
import type { Record } from '../domain/record';
import type { RecordRepository } from '../persistence/recordRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

/**
 * Application contract for atomic core-mutation provenance.
 *
 * `mutateWithProvenance` persists one current-state change (via the command's
 * `mutate` callback) and appends exactly one structured provenance Record in
 * the same unit of work, for any of the eight independent core concepts —
 * Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record —
 * without an `entities` table and without database foreign keys.
 *
 * The service depends only on framework-neutral ports — a `Clock`, an
 * `IdGenerator`, a `UnitOfWork`, and a `RecordRepository` factory bound to
 * the unit-of-work context — so the same behavior runs under any UI, HTTP,
 * or persistence framework (or none at all). The SQLite adapter is
 * `sqliteUnitOfWork` in `src/persistence/transactions.ts`.
 *
 * Error and rollback semantics:
 * - Payload validation runs before the transaction starts; an invalid
 *   command throws `ProvenanceValidationError` and nothing is persisted and
 *   `mutate` is never called.
 * - A failing current-state mutation throws `MutationPersistenceError`
 *   (original error preserved as `cause`); the unit of work rolls back, so
 *   no partial mutation and no provenance Record survive.
 * - A failing provenance append throws `ProvenancePersistenceError`
 *   (original error preserved as `cause`); the unit of work rolls back, so
 *   the current-state mutation does not commit without its provenance.
 *
 * Recursion semantics: the provenance Record is appended through the raw
 * `RecordRepository` inside the same transaction; it never re-enters
 * `mutateWithProvenance`. A user-facing Record mutation (`entityType:
 * 'record'`) is therefore audited exactly once, and the internal insertion of
 * its provenance Record never produces further provenance — the audit trail
 * is finite by construction.
 */

/** Thrown when a mutation command's provenance data fails validation. */
export class ProvenanceValidationError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ProvenanceValidationError';
    this.cause = cause;
  }
}

/**
 * Thrown when the current-state mutation fails inside the unit of work. The
 * transaction rolls back; the underlying error is preserved as `cause`.
 */
export class MutationPersistenceError extends Error {
  readonly cause?: unknown;

  constructor(
    entityType: string,
    entityId: EntityId,
    action: string,
    cause: unknown,
  ) {
    super(
      `Mutation ${action} on ${entityType} ${entityId} failed and was rolled back`,
    );
    this.name = 'MutationPersistenceError';
    this.cause = cause;
  }
}

/**
 * Thrown when appending the provenance Record fails inside the unit of work.
 * The transaction rolls back — including the current-state mutation — and the
 * underlying error is preserved as `cause`.
 */
export class ProvenancePersistenceError extends Error {
  readonly cause?: unknown;

  constructor(
    entityType: string,
    entityId: EntityId,
    action: string,
    cause: unknown,
  ) {
    super(
      `Provenance append for ${action} on ${entityType} ${entityId} failed and the mutation was rolled back`,
    );
    this.name = 'ProvenancePersistenceError';
    this.cause = cause;
  }
}

/**
 * Command for one audited core-entity mutation. `entityType`, `entityId`,
 * `action`, and `actor` are required and identify the mutation; `occurredAt`
 * is the event time and defaults to the clock's current time; `before` /
 * `after` are plain field snapshots filtered through the entity's
 * field-selection policy (see `buildProvenancePayload` for the per-action
 * snapshot rules). `mutate` performs the current-state change against
 * repositories bound to the unit-of-work context and returns its result.
 */
export interface MutateWithProvenanceCommand<TContext, TResult> {
  entityType: string;
  entityId: EntityId;
  action: string;
  actor: string;
  occurredAt?: IsoTimestamp;
  description?: string;
  before?: EntitySnapshot | null;
  after?: EntitySnapshot | null;
  mutate: (context: TContext) => Promise<TResult>;
}

export interface MutationProvenanceServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  /** Bind a Record repository to the unit-of-work context. */
  records: (context: TContext) => RecordRepository;
  clock?: Clock;
  ids?: IdGenerator;
  /** Extends or replaces the default per-entity field-selection policies. */
  fieldPolicies?: Partial<{ [K in CoreEntityType]: FieldSelectionPolicy }>;
}

export class MutationProvenanceService<TContext> {
  private readonly unitOfWork: UnitOfWork<TContext>;
  private readonly records: (context: TContext) => RecordRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly fieldPolicies?: Partial<{
    [K in CoreEntityType]: FieldSelectionPolicy;
  }>;

  constructor(ports: MutationProvenanceServicePorts<TContext>) {
    this.unitOfWork = ports.unitOfWork;
    this.records = ports.records;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.fieldPolicies = ports.fieldPolicies;
  }

  /**
   * Perform one current-state mutation and append its provenance Record
   * atomically. Returns the mutation's result. See the class documentation
   * for validation, error, rollback, and recursion semantics.
   */
  async mutateWithProvenance<TResult>(
    command: MutateWithProvenanceCommand<TContext, TResult>,
  ): Promise<TResult> {
    const payload = this.buildPayload(command);
    return this.unitOfWork.run(async (context) => {
      let result: TResult;
      try {
        result = await command.mutate(context);
      } catch (error) {
        throw new MutationPersistenceError(
          payload.entityType,
          payload.entityId,
          payload.action,
          error,
        );
      }
      const provenanceRecord = this.buildProvenanceRecord(command, payload);
      try {
        await this.records(context).add(provenanceRecord);
      } catch (error) {
        throw new ProvenancePersistenceError(
          payload.entityType,
          payload.entityId,
          payload.action,
          error,
        );
      }
      return result;
    });
  }

  /**
   * Validate the command and build its provenance payload before the
   * transaction starts, so invalid commands never reach a repository.
   */
  private buildPayload(
    command: MutateWithProvenanceCommand<TContext, unknown>,
  ): ProvenancePayload {
    if (!isCoreEntityType(command.entityType)) {
      throw new ProvenanceValidationError(
        `Provenance entityType must be a core entity type, got ${JSON.stringify(command.entityType)}`,
      );
    }
    if (!isMutationAction(command.action)) {
      throw new ProvenanceValidationError(
        `Provenance action must be a supported mutation action, got ${JSON.stringify(command.action)}`,
      );
    }
    const policy = resolveFieldPolicy(command.entityType, this.fieldPolicies);
    try {
      return buildProvenancePayload(
        {
          entityType: command.entityType,
          entityId: command.entityId,
          action: command.action,
          actor: command.actor,
          occurredAt: command.occurredAt ?? this.clock.now(),
          before: command.before,
          after: command.after,
        },
        policy,
      );
    } catch (error) {
      throw new ProvenanceValidationError(
        error instanceof Error ? error.message : String(error),
        error,
      );
    }
  }

  /**
   * Build the provenance Record for a validated payload. This Record is
   * appended directly through the repository — never through this service —
   * which is what keeps the audit trail finite (see class documentation).
   */
  private buildProvenanceRecord(
    command: MutateWithProvenanceCommand<TContext, unknown>,
    payload: ProvenancePayload,
  ): Record {
    return createRecord(
      {
        description:
          command.description ??
          `${payload.action} ${payload.entityType} ${payload.entityId}`,
        recordType: PROVENANCE_RECORD_TYPE,
        occurredAt: payload.occurredAt,
        recordedAt: this.clock.now(),
        actor: payload.actor,
        payload: provenancePayloadToJson(payload),
      },
      { id: this.ids.newId(), now: this.clock.now() },
    );
  }
}
