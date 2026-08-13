import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import { isCoreEntityType } from '../domain/entityTypes';
import { RELATION_CHANGE_ACTIONS } from '../domain/relationProvenance';
import type { RelationChangeAction } from '../domain/relationProvenance';
import type { Relation } from '../domain/relation';
import { PROVENANCE_RECORD_TYPE } from '../domain/mutationProvenance';
import type { RecordHistoryRepository } from '../persistence/recordRepository';
import type {
  RelationEndpointFilter,
  RelationListQuery,
  RelationQuery,
  RelationRepository,
  RelationStatus,
  RelationTimeRange,
} from '../persistence/relationRepository';
import type { CoreEntityLookup } from './coreEntityLookup';

/** A typed relation endpoint passed to an optional application-level resolver. */
export interface RelationEndpoint {
  type: CoreEntityType;
  id: EntityId;
}

/**
 * Logical endpoint lookup is deliberately separate from the relation store:
 * every core aggregate owns its own repository, and relations use no SQL
 * foreign keys. Returning null means the referenced entity is absent.
 */
export interface RelationEndpointResolver<TEndpoint = unknown> {
  resolve(endpoint: RelationEndpoint): Promise<TEndpoint | null>;
}

export type RelationIntegrityAnomaly =
  | {
      kind: 'malformed_endpoint_type';
      endpoint: 'source' | 'target';
      entityType: string;
      entityId: EntityId;
    }
  | {
      kind: 'missing_endpoint';
      endpoint: 'source' | 'target';
      entityType: CoreEntityType;
      entityId: EntityId;
    };

/**
 * A relation stays directional in every result; source and target are never
 * swapped merely because a query matched the target side. Hydrated endpoint
 * values are kept beside relation metadata rather than merged into entities.
 */
export interface HydratedRelationQueryResult<TEndpoint = unknown> {
  relation: Relation;
  source: TEndpoint | null;
  target: TEndpoint | null;
  anomalies: RelationIntegrityAnomaly[];
}

/**
 * Explicit validation error for endpoint history queries. It is intentionally
 * separate from persistence errors so callers do not need to depend on SQL
 * implementation details to report an invalid filter.
 */
export class RelationHistoryQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RelationHistoryQueryValidationError';
  }
}

/** Thrown when a requested, typed history endpoint is not a live core entity. */
export class RelationHistoryEndpointNotFoundError extends Error {
  constructor(endpoint: 'source' | 'target', type: CoreEntityType, id: EntityId) {
    super(`Relation history ${endpoint} endpoint ${type} ${id} not found`);
    this.name = 'RelationHistoryEndpointNotFoundError';
  }
}

/** The Record reference explaining one relation creation or ending. */
export interface RelationChangeAuditReference {
  recordId: EntityId;
  action: RelationChangeAction;
  occurredAt: IsoTimestamp;
  actor: string | null;
}

/**
 * Endpoint-directed history input. At least one endpoint is required; callers
 * may provide both to narrow a directional relationship without reversing it.
 */
export interface EndpointRelationHistoryQuery {
  source?: RelationEndpointFilter;
  target?: RelationEndpointFilter;
  relationType?: string;
  status?: RelationStatus;
  at?: IsoTimestamp;
  overlaps?: RelationTimeRange;
  limit?: number;
  offset?: number;
}

/** A temporal Relation together with its independent, append-only audit refs. */
export interface EndpointRelationHistoryEntry {
  relation: Relation;
  auditReferences: RelationChangeAuditReference[];
}

/** Dependencies that turn generic relation listings into endpoint history. */
export interface RelationHistoryQueryPorts {
  /** Logical-reference lookup across aggregate boundaries; never a SQL FK. */
  endpoints: CoreEntityLookup;
  /** Record history boundary used to locate relation-change audit records. */
  records: RecordHistoryRepository;
}

/**
 * Read-side facade for relation traversal inputs. The underlying repository
 * supplies composable filters and deterministic `created_at, id` pagination;
 * this facade optionally resolves logical endpoints and reports corruption or
 * dangling references explicitly instead of silently omitting relation rows.
 */
export class RelationQueryService<TEndpoint = unknown> {
  constructor(
    private readonly relations: RelationRepository,
    private readonly endpoints?: RelationEndpointResolver<TEndpoint>,
    private readonly history?: RelationHistoryQueryPorts,
  ) {}

  async list(query: RelationQuery = {}): Promise<Relation[]> {
    return this.relations.list(query);
  }

  async listCurrent(query: RelationListQuery = {}): Promise<Relation[]> {
    return this.relations.listCurrent(query);
  }

  async listHistory(query: RelationListQuery = {}): Promise<Relation[]> {
    return this.relations.listHistory(query);
  }

  /** Resolve each endpoint and preserve any logical-integrity anomaly. */
  async listHydrated(
    query: RelationQuery = {},
  ): Promise<HydratedRelationQueryResult<TEndpoint>[]> {
    if (this.endpoints === undefined) {
      throw new Error('Relation endpoint resolution was requested without a resolver');
    }
    const relations = await this.relations.list(query);
    return Promise.all(relations.map((relation) => this.hydrate(relation)));
  }

  /**
   * Return active and/or ended relation history from its source and/or target
   * endpoint. Returned relations remain directional, and audit data stays in
   * independent Record rows rather than being denormalized into relations.
   */
  async listEndpointHistory(
    query: EndpointRelationHistoryQuery,
  ): Promise<EndpointRelationHistoryEntry[]> {
    if (this.history === undefined) {
      throw new Error('Relation endpoint history was requested without history ports');
    }
    assertEndpointHistoryQuery(query);
    await this.assertKnownEndpoint('source', query.source);
    await this.assertKnownEndpoint('target', query.target);

    const relations = await this.relations.listHistory(query);
    const auditReferencesByRelationId = await this.listAuditReferences(
      new Set(relations.map((relation) => relation.id)),
    );
    return relations.map((relation) => ({
      relation,
      auditReferences: auditReferencesByRelationId.get(relation.id) ?? [],
    }));
  }

  private async hydrate(
    relation: Relation,
  ): Promise<HydratedRelationQueryResult<TEndpoint>> {
    const anomalies: RelationIntegrityAnomaly[] = [];
    const source = await this.resolveEndpoint(
      'source', relation.sourceType, relation.sourceId, anomalies,
    );
    const target = await this.resolveEndpoint(
      'target', relation.targetType, relation.targetId, anomalies,
    );
    return { relation, source, target, anomalies };
  }

  private async resolveEndpoint(
    endpoint: 'source' | 'target',
    entityType: string,
    entityId: EntityId,
    anomalies: RelationIntegrityAnomaly[],
  ): Promise<TEndpoint | null> {
    if (!isCoreEntityType(entityType)) {
      anomalies.push({ kind: 'malformed_endpoint_type', endpoint, entityType, entityId });
      return null;
    }
    const resolved = await this.endpoints!.resolve({ type: entityType, id: entityId });
    if (resolved === null) {
      anomalies.push({ kind: 'missing_endpoint', endpoint, entityType, entityId });
    }
    return resolved;
  }

  private async assertKnownEndpoint(
    endpoint: 'source' | 'target',
    filter: RelationEndpointFilter | undefined,
  ): Promise<void> {
    if (filter === undefined) return;
    if (!(await this.history!.endpoints.exists(filter.type, filter.id))) {
      throw new RelationHistoryEndpointNotFoundError(endpoint, filter.type, filter.id);
    }
  }

  private async listAuditReferences(
    relationIds: ReadonlySet<EntityId>,
  ): Promise<Map<EntityId, RelationChangeAuditReference[]>> {
    const references = new Map<EntityId, RelationChangeAuditReference[]>();
    if (relationIds.size === 0) return references;

    // RecordRepository deliberately has no relation-specific payload index.
    // Page the append-only provenance Records so history remains complete even
    // when more than one default repository page exists.
    const pageSize = 100;
    for (let offset = 0;; offset += pageSize) {
      const records = await this.history!.records.list({
        status: 'all',
        recordType: PROVENANCE_RECORD_TYPE,
        limit: pageSize,
        offset,
      });
      for (const record of records) {
        const reference = relationChangeAuditReference(record);
        if (reference !== null && relationIds.has(reference.relationId)) {
          const entries = references.get(reference.relationId) ?? [];
          entries.push({
            recordId: record.id,
            action: reference.action,
            occurredAt: reference.occurredAt,
            actor: record.actor,
          });
          references.set(reference.relationId, entries);
        }
      }
      if (records.length < pageSize) break;
    }
    return references;
  }
}

function assertEndpointHistoryQuery(query: EndpointRelationHistoryQuery): void {
  if (query.source === undefined && query.target === undefined) {
    throw new RelationHistoryQueryValidationError(
      'Relation endpoint history requires a source or target endpoint',
    );
  }
  assertHistoryEndpoint('source', query.source);
  assertHistoryEndpoint('target', query.target);
  if (query.relationType !== undefined && query.relationType.trim().length === 0) {
    throw new RelationHistoryQueryValidationError('Relation history relationType must not be blank');
  }
  if (query.status !== undefined && query.status !== 'active' && query.status !== 'ended') {
    throw new RelationHistoryQueryValidationError('Relation history status must be active or ended');
  }
  if (query.at !== undefined) assertHistoryTimestamp('at', query.at);
  if (query.overlaps !== undefined) {
    assertHistoryTimestamp('overlaps.start', query.overlaps.start);
    assertHistoryTimestamp('overlaps.end', query.overlaps.end);
    if (Date.parse(query.overlaps.start) >= Date.parse(query.overlaps.end)) {
      throw new RelationHistoryQueryValidationError(
        'Relation history overlaps must have start before end',
      );
    }
  }
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RelationHistoryQueryValidationError('Relation history limit must be a positive integer');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new RelationHistoryQueryValidationError('Relation history offset must be a non-negative integer');
  }
}

function assertHistoryEndpoint(
  name: 'source' | 'target',
  endpoint: RelationEndpointFilter | undefined,
): void {
  if (endpoint === undefined) return;
  if (!isCoreEntityType(endpoint.type)) {
    throw new RelationHistoryQueryValidationError(
      `Relation history ${name} endpoint type must be a core entity type`,
    );
  }
  if (endpoint.id.trim().length === 0) {
    throw new RelationHistoryQueryValidationError(
      `Relation history ${name} endpoint id must not be blank`,
    );
  }
}

function assertHistoryTimestamp(name: string, value: IsoTimestamp): void {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new RelationHistoryQueryValidationError(
      `Relation history ${name} must be a valid ISO 8601 timestamp`,
    );
  }
}

function relationChangeAuditReference(record: {
  payload: unknown;
}): { relationId: EntityId; action: RelationChangeAction; occurredAt: IsoTimestamp } | null {
  const payload = record.payload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const values = payload as Record<string, unknown>;
  const action = values.action;
  const relationId = values.relationId;
  const occurredAt = values.occurredAt;
  if (
    typeof action !== 'string' ||
    !RELATION_CHANGE_ACTIONS.includes(action as RelationChangeAction) ||
    typeof relationId !== 'string' ||
    relationId.trim().length === 0 ||
    typeof occurredAt !== 'string' ||
    occurredAt.trim().length === 0 ||
    Number.isNaN(Date.parse(occurredAt))
  ) {
    return null;
  }
  return { relationId, action: action as RelationChangeAction, occurredAt };
}
