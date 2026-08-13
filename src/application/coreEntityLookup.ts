import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId } from '../domain/ids';

/**
 * Logical resolver for the eight independent core aggregate tables.  It is
 * deliberately a port: labels and relations validate references here rather
 * than introducing a shared entity table or database foreign keys.
 */
export interface CoreEntityLookup {
  exists(entityType: CoreEntityType, id: EntityId): Promise<boolean>;
}
