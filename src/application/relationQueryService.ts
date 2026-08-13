import type { EntityId } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import { isCoreEntityType } from '../domain/entityTypes';
import type { Relation } from '../domain/relation';
import type {
  RelationListQuery,
  RelationQuery,
  RelationRepository,
} from '../persistence/relationRepository';

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
 * Read-side facade for relation traversal inputs. The underlying repository
 * supplies composable filters and deterministic `created_at, id` pagination;
 * this facade optionally resolves logical endpoints and reports corruption or
 * dangling references explicitly instead of silently omitting relation rows.
 */
export class RelationQueryService<TEndpoint = unknown> {
  constructor(
    private readonly relations: RelationRepository,
    private readonly endpoints?: RelationEndpointResolver<TEndpoint>,
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
}
