import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import { createRelation, endRelation } from '../domain/relation';
import type { Relation } from '../domain/relation';
import { resolveRelationPolicy } from '../domain/relationPolicy';
import type { RelationPolicy } from '../domain/relationPolicy';
import type { RelationRepository } from '../persistence/relationRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';
import type { CoreEntityLookup } from './coreEntityLookup';

/**
 * Application boundary for policy-validated Relation create and end
 * operations (the semantic core graph, `Table-definetion.txt` #9).
 *
 * Every create runs the full pipeline before anything is persisted:
 * 1. Domain validation of the aggregate (core endpoint types, non-blank ids,
 *    supported relation type, JSON metadata, valid interval).
 * 2. Policy resolution — the relation type must be governed by a policy.
 * 3. Direction validation against the policy's exact source→target rule.
 * 4. Policy-specific metadata validation.
 * 5. Inside the unit of work: both typed endpoints must exist (a logical
 *    reference validated here, never by database foreign keys) and, when the
 *    policy forbids it, no active Relation may already hold the same
 *    active-duplicate identity (see `src/domain/relationPolicy.ts`).
 *
 * Each failure category raises a distinct error — domain errors for type and
 * aggregate violations, `RelationPolicyNotFoundError`,
 * `RelationDirectionNotPermittedError`, `RelationMetadataPolicyError`,
 * `RelationEndpointNotFoundError`, and `DuplicateActiveRelationError` — and
 * persists nothing.
 *
 * Ending a Relation sets `ended_at` through `RelationRepository.save`, which
 * preserves the original row: endpoints, direction, metadata, and
 * `created_at` are immutable. Ending an already-ended Relation is a
 * documented idempotent no-op (see `endRelation` in `src/domain/relation`):
 * the stored Relation is returned unchanged and no provenance is appended.
 * Hard deletion is forbidden — no delete operation exists on this service or
 * on the repository; replacing a relationship is end-old/create-new.
 *
 * Provenance integration: when a `provenance` port is supplied, the Relation
 * write and the provenance append share one unit of work — either both commit
 * or neither does. The notice handed to the port identifies both endpoints,
 * the relation type, the metadata, the actor, and the event time. The
 * concrete relation-change provenance Record contract lands with its owning
 * Feature (#5); this service defines the atomic seam it plugs into. Without
 * the port, creates and ends still run atomically on their own.
 *
 * The service depends only on framework-neutral ports — a `Clock`, an
 * `IdGenerator`, a `UnitOfWork`, and repository/lookup factories bound to the
 * unit-of-work context — so the same behavior runs under any UI, HTTP, or
 * persistence framework (or none at all). The SQLite adapter is
 * `sqliteUnitOfWork` in `src/persistence/transactions.ts`.
 */

/** Thrown when no relation policy governs the command's relation type. */
export class RelationPolicyNotFoundError extends Error {
  constructor(relationType: string) {
    super(`No relation policy governs relation type ${JSON.stringify(relationType)}`);
    this.name = 'RelationPolicyNotFoundError';
  }
}

/** Thrown when the governing policy forbids the command's exact direction. */
export class RelationDirectionNotPermittedError extends Error {
  constructor(
    relationType: string,
    sourceType: CoreEntityType,
    targetType: CoreEntityType,
  ) {
    super(
      `Relation type ${JSON.stringify(relationType)} does not permit direction ${sourceType} -> ${targetType}`,
    );
    this.name = 'RelationDirectionNotPermittedError';
  }
}

/** Thrown when a typed endpoint of a relation command does not exist. */
export class RelationEndpointNotFoundError extends Error {
  constructor(
    endpoint: 'source' | 'target',
    entityType: CoreEntityType,
    id: EntityId,
  ) {
    super(`Relation ${endpoint} endpoint ${entityType} ${id} not found`);
    this.name = 'RelationEndpointNotFoundError';
  }
}

/**
 * Thrown when the governing policy forbids a second active Relation with the
 * same active-duplicate identity.
 */
export class DuplicateActiveRelationError extends Error {
  constructor(existing: Relation) {
    super(
      `An active ${JSON.stringify(existing.relationType)} relation already exists from ${existing.sourceType} ${existing.sourceId} to ${existing.targetType} ${existing.targetId} (${existing.id})`,
    );
    this.name = 'DuplicateActiveRelationError';
  }
}

/** Thrown when ending a Relation by an id that does not exist. */
export class RelationNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Relation ${id} not found`);
    this.name = 'RelationNotFoundError';
  }
}

/** Replacements require an active old relation; retries must be explicit. */
export class RelationAlreadyEndedError extends Error {
  constructor(id: EntityId) {
    super(`Relation ${id} is already ended and cannot be replaced`);
    this.name = 'RelationAlreadyEndedError';
  }
}

/**
 * Thrown when the Relation write fails inside the unit of work. The
 * transaction rolls back; the underlying error is preserved as `cause`.
 */
export class RelationPersistenceError extends Error {
  readonly cause?: unknown;

  constructor(action: string, relationId: EntityId, cause: unknown) {
    super(`Relation ${action} on ${relationId} failed and was rolled back`);
    this.name = 'RelationPersistenceError';
    this.cause = cause;
  }
}

/**
 * Thrown when the provenance append fails inside the unit of work. The
 * transaction rolls back — including the Relation write — and the underlying
 * error is preserved as `cause`.
 */
export class RelationProvenancePersistenceError extends Error {
  readonly cause?: unknown;

  constructor(action: string, relationId: EntityId, cause: unknown) {
    super(
      `Provenance append for relation ${action} on ${relationId} failed and the mutation was rolled back`,
    );
    this.name = 'RelationProvenancePersistenceError';
    this.cause = cause;
  }
}

/**
 * Logical-reference lookup for typed Relation endpoints. Implemented over the
 * per-aggregate repository boundaries; the database never enforces it.
 */
export type RelationEndpointLookup = CoreEntityLookup;

/**
 * The audit notice handed to the provenance port for one Relation mutation.
 * It identifies both endpoints, the relation type, the metadata, the actor,
 * and the event time, so relationship history can be reconstructed.
 */
export interface RelationMutationNotice {
  kind: 'created' | 'ended';
  relation: Relation;
  actor: string;
  occurredAt: IsoTimestamp;
}

/**
 * Optional provenance port. `append` runs inside the same unit of work as the
 * Relation write; throwing rolls both back.
 */
export interface RelationProvenancePort<TContext> {
  append(
    context: TContext,
    notice: RelationMutationNotice,
  ): Promise<void>;
}

/**
 * Command for creating a Relation. `actor` is required so every relationship
 * change can identify who or what caused it; `occurredAt` is the event time
 * (the moment the Relation becomes active) and defaults to the clock's
 * current time.
 */
export interface CreateRelationCommand {
  sourceType: string;
  sourceId: EntityId;
  relationType: string;
  targetType: string;
  targetId: EntityId;
  metadata?: unknown;
  actor: string;
  occurredAt?: IsoTimestamp;
}

/**
 * Command for ending a Relation. `endedAt` defaults to the clock's current
 * time. Ending an already-ended Relation is an idempotent no-op (see the
 * class documentation).
 */
export interface EndRelationCommand {
  relationId: EntityId;
  actor: string;
  endedAt?: IsoTimestamp;
}

/**
 * Atomically end one active Relation and create its successor.  The same
 * actor is recorded for both changes, while each temporal fact remains on its
 * own Relation: `endedAt` on the old row and `createdAt` on the new row.
 */
export interface ReplaceRelationCommand {
  relationId: EntityId;
  actor: string;
  endedAt?: IsoTimestamp;
  replacement: Omit<CreateRelationCommand, 'actor'>;
}

export interface RelationServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  /** Bind a Relation repository to the unit-of-work context. */
  relations: (context: TContext) => RelationRepository;
  /** Bind the typed-endpoint lookup to the unit-of-work context. */
  endpoints: (context: TContext) => RelationEndpointLookup;
  /** Optional provenance appender, executed in the same unit of work. */
  provenance?: RelationProvenancePort<TContext>;
  /** Per-relation-type policy overrides (see `resolveRelationPolicy`). */
  policies?: Readonly<Record<string, RelationPolicy>>;
  /** Extends or replaces the default relation-type policy. */
  supportedRelationTypes?: readonly string[];
  clock?: Clock;
  ids?: IdGenerator;
}

function requireActor(actor: string): string {
  if (actor.trim().length === 0) {
    throw new Error('Relation command actor must not be blank');
  }
  return actor;
}

export class RelationService<TContext> {
  private readonly unitOfWork: UnitOfWork<TContext>;
  private readonly relations: (context: TContext) => RelationRepository;
  private readonly endpoints: (context: TContext) => RelationEndpointLookup;
  private readonly provenance?: RelationProvenancePort<TContext>;
  private readonly policies?: Readonly<Record<string, RelationPolicy>>;
  private readonly supportedRelationTypes?: readonly string[];
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(ports: RelationServicePorts<TContext>) {
    this.unitOfWork = ports.unitOfWork;
    this.relations = ports.relations;
    this.endpoints = ports.endpoints;
    this.provenance = ports.provenance;
    this.policies = ports.policies;
    this.supportedRelationTypes = ports.supportedRelationTypes;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  /**
   * Create a Relation after domain, policy, endpoint, and active-cardinality
   * validation. Returns the stored Relation. See the class documentation for
   * the validation pipeline, error categories, and provenance semantics.
   */
  async createRelation(command: CreateRelationCommand): Promise<Relation> {
    const actor = requireActor(command.actor);
    const relation = this.buildNewRelation(command);

    return this.unitOfWork.run(async (context) => {
      return this.createInContext(context, relation, actor);
    });
  }

  /**
   * End an active Relation, returning the ended Relation. Throws
   * `RelationNotFoundError` when the id is unknown. Ending an already-ended
   * Relation is an idempotent no-op: the stored Relation is returned
   * unchanged and no provenance is appended (see `endRelation` in
   * `src/domain/relation`).
   */
  async endRelation(command: EndRelationCommand): Promise<Relation> {
    const actor = requireActor(command.actor);
    return this.unitOfWork.run(async (context) => {
      return this.endInContext(
        context,
        command.relationId,
        actor,
        command.endedAt ?? this.clock.now(),
        true,
      );
    });
  }

  /**
   * Replace an active relationship as one unit of work.  It appends exactly
   * two audit Records in order — `relation_ended`, then `relation_created`.
   * If either relation write or either append fails, the old Relation remains
   * active and the replacement and both Records are rolled back.
   */
  async replaceRelation(command: ReplaceRelationCommand): Promise<{
    ended: Relation;
    replacement: Relation;
  }> {
    const actor = requireActor(command.actor);
    const endedAt = command.endedAt ?? this.clock.now();
    const replacement = this.buildNewRelation({
      ...command.replacement,
      actor,
      // A replacement becomes active when the old relation ends unless the
      // caller deliberately provides a later event time.
      occurredAt: command.replacement.occurredAt ?? endedAt,
    });
    if (Date.parse(replacement.createdAt) < Date.parse(endedAt)) {
      throw new Error('Replacement Relation createdAt must not precede endedAt');
    }
    return this.unitOfWork.run(async (context) => {
      const ended = await this.endInContext(
        context,
        command.relationId,
        actor,
        endedAt,
        false,
      );
      const created = await this.createInContext(context, replacement, actor);
      return { ended, replacement: created };
    });
  }

  /** Validate and construct a new Relation before persistence. */
  private buildNewRelation(command: CreateRelationCommand): Relation {
    const relation = createRelation(
      {
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        relationType: command.relationType,
        targetType: command.targetType,
        targetId: command.targetId,
        metadata: command.metadata,
      },
      {
        id: this.ids.newId(),
        now: command.occurredAt ?? this.clock.now(),
        supportedRelationTypes: this.supportedRelationTypes,
      },
    );
    const policy = resolveRelationPolicy(relation.relationType, this.policies);
    if (policy === null) {
      throw new RelationPolicyNotFoundError(relation.relationType);
    }
    if (!policy.allowsDirection(relation.sourceType, relation.targetType)) {
      throw new RelationDirectionNotPermittedError(
        relation.relationType,
        relation.sourceType,
        relation.targetType,
      );
    }
    policy.validateMetadata(relation.metadata);
    return relation;
  }

  private async createInContext(
    context: TContext,
    relation: Relation,
    actor: string,
  ): Promise<Relation> {
    const policy = resolveRelationPolicy(relation.relationType, this.policies);
    // `buildNewRelation` already resolved it, but retain the guard at the
    // persistence boundary for callers composing a larger unit of work.
    if (policy === null) {
      throw new RelationPolicyNotFoundError(relation.relationType);
    }
    const relations = this.relations(context);
    const endpoints = this.endpoints(context);
    if (!(await endpoints.exists(relation.sourceType, relation.sourceId))) {
      throw new RelationEndpointNotFoundError(
        'source',
        relation.sourceType,
        relation.sourceId,
      );
    }
    if (!(await endpoints.exists(relation.targetType, relation.targetId))) {
      throw new RelationEndpointNotFoundError(
        'target',
        relation.targetType,
        relation.targetId,
      );
    }
    if (!policy.allowsMultipleActive) {
      const existing = await relations.findActiveByIdentity(
        relation.sourceType,
        relation.sourceId,
        relation.relationType,
        relation.targetType,
        relation.targetId,
      );
      if (existing !== null) {
        throw new DuplicateActiveRelationError(existing);
      }
    }
    try {
      await relations.add(relation);
    } catch (error) {
      throw new RelationPersistenceError('create', relation.id, error);
    }
    await this.appendProvenance(context, 'created', relation, actor);
    return relation;
  }

  private async endInContext(
    context: TContext,
    relationId: EntityId,
    actor: string,
    endedAt: IsoTimestamp,
    permitRepeatedEnd: boolean,
  ): Promise<Relation> {
    const relations = this.relations(context);
    const existing = await relations.getById(relationId);
    if (existing === null) {
      throw new RelationNotFoundError(relationId);
    }
    if (existing.endedAt !== null) {
      if (permitRepeatedEnd) {
        return existing;
      }
      throw new RelationAlreadyEndedError(relationId);
    }
    const ended = endRelation(existing, endedAt);
    try {
      await relations.save(ended);
    } catch (error) {
      throw new RelationPersistenceError('end', ended.id, error);
    }
    await this.appendProvenance(context, 'ended', ended, actor);
    return ended;
  }

  /**
   * Append provenance inside the current unit of work when the port is
   * configured; a failure rolls the Relation write back with it.
   */
  private async appendProvenance(
    context: TContext,
    kind: RelationMutationNotice['kind'],
    relation: Relation,
    actor: string,
  ): Promise<void> {
    if (this.provenance === undefined) {
      return;
    }
    try {
      await this.provenance.append(context, {
        kind,
        relation,
        actor,
        occurredAt: kind === 'created' ? relation.createdAt : (relation.endedAt as IsoTimestamp),
      });
    } catch (error) {
      throw new RelationProvenancePersistenceError(kind, relation.id, error);
    }
  }
}
