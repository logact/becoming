import type { CoreEntityType } from '../domain/entityTypes';
import { isCoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  LINEAGE_RELATION_TYPES,
  type LineageRelationType,
} from '../domain/relationPolicy';
import type { Relation } from '../domain/relation';
import { PROVENANCE_RECORD_TYPE } from '../domain/mutationProvenance';
import {
  RELATION_CHANGE_ACTIONS,
  type RelationChangeAction,
} from '../domain/relationProvenance';
import type { RecordHistoryRepository } from '../persistence/recordRepository';
import type {
  RelationRepository,
  RelationStatus,
  RelationTimeRange,
} from '../persistence/relationRepository';
import type { CoreEntityLookup } from './coreEntityLookup';
import type { RelationChangeAuditReference } from './relationQueryService';

export interface LineageEndpoint {
  type: CoreEntityType;
  id: EntityId;
}

/** The canonical direction of a returned direct lineage edge. */
export type LineageNeighborDirection = 'source' | 'derivative';

/**
 * Filters for an immediate lineage-neighbor query. The repository's
 * `created_at ASC, id ASC` order is deliberately retained for stable pages.
 */
export interface ImmediateLineageQuery {
  relationType?: LineageRelationType;
  status?: RelationStatus;
  at?: IsoTimestamp;
  overlaps?: RelationTimeRange;
  limit?: number;
  offset?: number;
}

/** A direct lineage relation with the endpoint on the other side and its audit trail. */
export interface ImmediateLineageNeighbor {
  direction: LineageNeighborDirection;
  endpoint: LineageEndpoint;
  relation: Relation;
  auditReferences: RelationChangeAuditReference[];
}

/** Explicit application-level validation rather than storage-specific errors. */
export class LineageQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LineageQueryValidationError';
  }
}

/** A typed query endpoint must identify an existing core aggregate. */
export class LineageEndpointNotFoundError extends Error {
  constructor(endpoint: LineageEndpoint) {
    super(`Lineage endpoint ${endpoint.type} ${endpoint.id} not found`);
    this.name = 'LineageEndpointNotFoundError';
  }
}

/** Optional ports turn raw direct edges into endpoint-validated history results. */
export interface LineageQueryPorts {
  endpoints: CoreEntityLookup;
  records: RecordHistoryRepository;
}

/**
 * Read model for V1 lineage. A lineage edge is always source -> derivative:
 * `immediateSources(x)` reads incoming edges; `immediateDerivatives(x)` reads
 * outgoing ones. The legacy raw methods retain their active-only contract;
 * `listImmediateSources` and `listImmediateDerivatives` expose history,
 * filters, endpoint validation, and relation-change audit references.
 */
export class LineageQueryService {
  constructor(
    private readonly relations: RelationRepository,
    private readonly ports?: LineageQueryPorts,
  ) {}

  async immediateSources(endpoint: LineageEndpoint): Promise<Relation[]> {
    return this.rawLineageRows({ target: endpoint });
  }

  async immediateDerivatives(endpoint: LineageEndpoint): Promise<Relation[]> {
    return this.rawLineageRows({ source: endpoint });
  }

  async listImmediateSources(
    endpoint: LineageEndpoint,
    query: ImmediateLineageQuery = {},
  ): Promise<ImmediateLineageNeighbor[]> {
    return this.listNeighbors('source', endpoint, query);
  }

  async listImmediateDerivatives(
    endpoint: LineageEndpoint,
    query: ImmediateLineageQuery = {},
  ): Promise<ImmediateLineageNeighbor[]> {
    return this.listNeighbors('derivative', endpoint, query);
  }

  private async rawLineageRows(query: {
    source?: LineageEndpoint;
    target?: LineageEndpoint;
  }): Promise<Relation[]> {
    const rows = await this.relations.listCurrent({ ...query, limit: 1_000 });
    return rows.filter(isLineageRelation);
  }

  private async listNeighbors(
    direction: LineageNeighborDirection,
    endpoint: LineageEndpoint,
    query: ImmediateLineageQuery,
  ): Promise<ImmediateLineageNeighbor[]> {
    assertEndpoint(endpoint);
    assertQuery(query);
    if (this.ports === undefined) {
      throw new Error('Lineage history queries require endpoint and record history ports');
    }
    if (!(await this.ports.endpoints.exists(endpoint.type, endpoint.id))) {
      throw new LineageEndpointNotFoundError(endpoint);
    }

    const rows = await this.relations.listHistory({
      ...(direction === 'source' ? { target: endpoint } : { source: endpoint }),
      ...query,
    });
    const lineageRows = rows.filter(isLineageRelation);
    const audits = await this.listAuditReferences(new Set(lineageRows.map((row) => row.id)));
    return lineageRows.map((relation) => ({
      direction,
      endpoint: direction === 'source'
        ? { type: relation.sourceType, id: relation.sourceId }
        : { type: relation.targetType, id: relation.targetId },
      relation,
      auditReferences: audits.get(relation.id) ?? [],
    }));
  }

  private async listAuditReferences(
    relationIds: ReadonlySet<EntityId>,
  ): Promise<Map<EntityId, RelationChangeAuditReference[]>> {
    const references = new Map<EntityId, RelationChangeAuditReference[]>();
    if (relationIds.size === 0) return references;

    const pageSize = 100;
    for (let offset = 0;; offset += pageSize) {
      const records = await this.ports!.records.list({
        status: 'all', recordType: PROVENANCE_RECORD_TYPE, limit: pageSize, offset,
      });
      for (const record of records) {
        const audit = relationChangeAuditReference(record);
        if (audit === null || !relationIds.has(audit.relationId)) continue;
        const relationAudits = references.get(audit.relationId) ?? [];
        relationAudits.push({
          recordId: record.id, action: audit.action, occurredAt: audit.occurredAt, actor: record.actor,
        });
        references.set(audit.relationId, relationAudits);
      }
      if (records.length < pageSize) return references;
    }
  }
}

/**
 * A reusable breadth-first traversal guard for future deep lineage views.
 * V1 immediate-neighbor reads use depth 1, but the visited set still makes
 * cyclic legacy data bounded and duplicate-safe instead of trusting graph
 * integrity in persisted historical rows.
 */
export async function traverseLineageEndpoints(
  start: LineageEndpoint,
  options: { maxDepth: number; maxVisited: number },
  next: (endpoint: LineageEndpoint) => Promise<readonly LineageEndpoint[]>,
): Promise<LineageEndpoint[]> {
  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 0) {
    throw new LineageQueryValidationError('Lineage traversal maxDepth must be a non-negative integer');
  }
  if (!Number.isInteger(options.maxVisited) || options.maxVisited < 1) {
    throw new LineageQueryValidationError('Lineage traversal maxVisited must be a positive integer');
  }
  assertEndpoint(start);
  const seen = new Set([endpointKey(start)]);
  const result: LineageEndpoint[] = [];
  let frontier = [start];
  for (let depth = 0; depth < options.maxDepth && frontier.length > 0; depth += 1) {
    const following: LineageEndpoint[] = [];
    for (const endpoint of frontier) {
      for (const neighbor of await next(endpoint)) {
        assertEndpoint(neighbor);
        const key = endpointKey(neighbor);
        if (seen.has(key)) continue;
        if (seen.size >= options.maxVisited) return result;
        seen.add(key);
        result.push(neighbor);
        following.push(neighbor);
      }
    }
    frontier = following;
  }
  return result;
}

function isLineageRelation(relation: Relation): boolean {
  return LINEAGE_RELATION_TYPES.includes(relation.relationType as LineageRelationType);
}

function assertEndpoint(endpoint: LineageEndpoint): void {
  if (!isCoreEntityType(endpoint.type)) {
    throw new LineageQueryValidationError('Lineage endpoint type must be a core entity type');
  }
  if (endpoint.id.trim().length === 0) {
    throw new LineageQueryValidationError('Lineage endpoint id must not be blank');
  }
}

function assertQuery(query: ImmediateLineageQuery): void {
  if (query.relationType !== undefined && !LINEAGE_RELATION_TYPES.includes(query.relationType)) {
    throw new LineageQueryValidationError('Lineage relationType must be a lineage relation type');
  }
  if (query.status !== undefined && query.status !== 'active' && query.status !== 'ended') {
    throw new LineageQueryValidationError('Lineage status must be active or ended');
  }
  if (query.at !== undefined) assertTimestamp('at', query.at);
  if (query.overlaps !== undefined) {
    assertTimestamp('overlaps.start', query.overlaps.start);
    assertTimestamp('overlaps.end', query.overlaps.end);
    if (Date.parse(query.overlaps.start) >= Date.parse(query.overlaps.end)) {
      throw new LineageQueryValidationError('Lineage overlaps must have start before end');
    }
  }
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1)) {
    throw new LineageQueryValidationError('Lineage limit must be a positive integer');
  }
  if (query.offset !== undefined && (!Number.isInteger(query.offset) || query.offset < 0)) {
    throw new LineageQueryValidationError('Lineage offset must be a non-negative integer');
  }
}

function assertTimestamp(name: string, value: IsoTimestamp): void {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new LineageQueryValidationError(`Lineage ${name} must be a valid ISO 8601 timestamp`);
  }
}

function endpointKey(endpoint: LineageEndpoint): string {
  return `${endpoint.type}:${endpoint.id}`;
}

function relationChangeAuditReference(record: { payload: unknown }): {
  relationId: EntityId;
  action: RelationChangeAction;
  occurredAt: IsoTimestamp;
} | null {
  const payload = record.payload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const values = payload as Record<string, unknown>;
  if (
    typeof values.relationId !== 'string' || values.relationId.trim().length === 0 ||
    typeof values.action !== 'string' ||
    !RELATION_CHANGE_ACTIONS.includes(values.action as RelationChangeAction) ||
    typeof values.occurredAt !== 'string' || values.occurredAt.trim().length === 0 ||
    Number.isNaN(Date.parse(values.occurredAt))
  ) return null;
  return {
    relationId: values.relationId,
    action: values.action as RelationChangeAction,
    occurredAt: values.occurredAt,
  };
}
