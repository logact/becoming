import type { CoreEntityLookup } from './coreEntityLookup';
import {
  assertTimelineEntityReference,
} from '../domain/timelineEvent';
import type { TimelineEntityReference } from '../domain/timelineEvent';

/** A timeline resolver intentionally delegates to the eight-table logical lookup port. */
export class TimelineEntityNotFoundError extends Error {
  constructor(readonly entity: TimelineEntityReference) {
    super(`Timeline entity ${entity.type} ${entity.id} not found`);
    this.name = 'TimelineEntityNotFoundError';
  }
}

/**
 * Validate and resolve a consumer reference without adding a polymorphic
 * `entities` table or database foreign keys. The supplied CoreEntityLookup
 * owns the explicit fixed mapping from each valid core type to its table.
 */
export async function resolveTimelineEntity(
  entities: CoreEntityLookup,
  entity: { type: string; id: string },
): Promise<TimelineEntityReference> {
  assertTimelineEntityReference(entity);
  if (!await entities.exists(entity.type, entity.id)) {
    throw new TimelineEntityNotFoundError(entity);
  }
  return entity;
}
