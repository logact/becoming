import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId } from '../domain/ids';
import { LINEAGE_RELATION_TYPES } from '../domain/relationPolicy';
import type { Relation } from '../domain/relation';
import type { RelationRepository } from '../persistence/relationRepository';

export interface LineageEndpoint {
  type: CoreEntityType;
  id: EntityId;
}

/**
 * Read model for V1 lineage. A lineage edge is always source -> derivative:
 * `immediateSources(x)` reads incoming edges; `immediateDerivatives(x)` reads
 * outgoing ones. Both reads are bounded and deduplicate visited endpoints so
 * historical/corrupt cycles cannot make a consumer loop indefinitely.
 */
export class LineageQueryService {
  constructor(private readonly relations: RelationRepository) {}

  async immediateSources(endpoint: LineageEndpoint): Promise<Relation[]> {
    return this.lineageRows({ target: endpoint });
  }

  async immediateDerivatives(endpoint: LineageEndpoint): Promise<Relation[]> {
    return this.lineageRows({ source: endpoint });
  }

  private async lineageRows(query: {
    source?: LineageEndpoint;
    target?: LineageEndpoint;
  }): Promise<Relation[]> {
    const rows = await this.relations.listCurrent({ ...query, limit: 1_000 });
    return rows.filter((row) =>
      LINEAGE_RELATION_TYPES.includes(row.relationType as typeof LINEAGE_RELATION_TYPES[number]),
    );
  }
}
