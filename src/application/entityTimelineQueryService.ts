import type { CoreEntityLookup } from './coreEntityLookup';
import { resolveTimelineEntity } from './timelineEntityResolver';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import { RECORD_TYPES } from '../domain/record';
import type { RecordTimeRange, RecordHistoryRepository } from '../persistence/recordRepository';
import {
  adaptRecordToTimelineEvent,
  deduplicateTimelineEvents,
  includeTimelineEvent,
  timelineEventConcernsEntity,
} from '../domain/timelineEvent';
import type {
  TimelineEntityReference,
  TimelineEvent,
  TimelineEventCategory,
} from '../domain/timelineEvent';

/** Filter and composition errors are intentionally distinct from missing entities. */
export class EntityTimelineQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityTimelineQueryValidationError';
  }
}

/**
 * Input for a complete entity timeline. There is deliberately no pagination
 * here: cursor traversal is the follow-up concern in #87.
 */
export interface EntityTimelineQuery {
  /** Active records are the ordinary view; history callers explicitly opt in. */
  status?: 'active' | 'archived' | 'all';
  /** Retain only source Record types. Every supplied type is ORed. */
  recordTypes?: readonly string[];
  /** Singular convenience form; it composes with `recordTypes` when both exist. */
  recordType?: string;
  /** Retain only adapted event categories. Every supplied category is ORed. */
  categories?: readonly TimelineEventCategory[];
  /** Singular convenience form; it composes with `categories` when both exist. */
  category?: TimelineEventCategory;
  /** Inclusive occurrence-time interval, combined with the other filters. */
  occurredAt?: RecordTimeRange;
}

export interface EntityTimelineQueryServicePorts {
  /** Logical validation over all eight independent core tables. */
  entities: CoreEntityLookup;
  records: RecordHistoryRepository;
}

/**
 * Composes one entity's historical event stream from the append-only Records
 * table. A Record can be discovered by several semantic paths (mutation
 * identity, relation endpoint, lineage, lifecycle project context, or a
 * correction target), so adaptation precedes an immutable Record-ID de-dupe.
 *
 * The record repository has no payload index by design. We therefore scan it
 * in bounded pages, not one lookup per candidate/event; this keeps the read
 * path complete and eliminates N+1 behaviour while preserving the independent
 * aggregate tables and no-FK persistence model.
 */
export class EntityTimelineQueryService {
  constructor(private readonly ports: EntityTimelineQueryServicePorts) {}

  async list(
    entity: { type: string; id: EntityId },
    query: EntityTimelineQuery = {},
  ): Promise<TimelineEvent[]> {
    const resolved = await resolveTimelineEntity(this.ports.entities, entity);
    assertQuery(query);

    const candidates = await this.listAllRecords(query.status ?? 'active', query.occurredAt);
    return deduplicateTimelineEvents(
      candidates
        .map(adaptRecordToTimelineEvent)
        .filter((event) => this.matches(event, resolved, query)),
    );
  }

  /** Readable alias for callers that name their application operation. */
  async listTimeline(
    entity: { type: string; id: EntityId },
    query: EntityTimelineQuery = {},
  ): Promise<TimelineEvent[]> {
    return this.list(entity, query);
  }

  private async listAllRecords(
    status: 'active' | 'archived' | 'all',
    occurredAt: RecordTimeRange | undefined,
  ) {
    const records = [] as Awaited<ReturnType<RecordHistoryRepository['list']>>;
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const page = await this.ports.records.list({ status, occurredAt, limit, offset });
      records.push(...page);
      if (page.length < limit) return records;
    }
  }

  private matches(
    event: TimelineEvent,
    entity: TimelineEntityReference,
    query: EntityTimelineQuery,
  ): boolean {
    return includeTimelineEvent(event, query.status ?? 'active') &&
      timelineEventConcernsEntity(event, entity) &&
      matchesOneOf(event.recordType, query.recordType, query.recordTypes) &&
      matchesOneOf(event.category, query.category, query.categories) &&
      inRange(event.occurredAt, query.occurredAt);
  }
}

function assertQuery(query: EntityTimelineQuery): void {
  if (query.status !== undefined && !['active', 'archived', 'all'].includes(query.status)) {
    throw new EntityTimelineQueryValidationError('Entity timeline status must be active, archived, or all');
  }
  assertStringSet('recordTypes', query.recordTypes, RECORD_TYPES);
  assertStringSet('categories', query.categories, [
    'mutation', 'relation', 'lineage', 'lifecycle', 'correction', 'occurrence',
  ]);
  assertString('recordType', query.recordType, RECORD_TYPES);
  assertString('category', query.category, [
    'mutation', 'relation', 'lineage', 'lifecycle', 'correction', 'occurrence',
  ]);
  assertRange(query.occurredAt);
}

function assertString(name: string, value: string | undefined, supported: readonly string[]): void {
  if (value === undefined) return;
  if (!supported.includes(value)) {
    throw new EntityTimelineQueryValidationError(
      `Unsupported entity timeline ${name} ${JSON.stringify(value)}`,
    );
  }
}

function assertStringSet(
  name: string,
  values: readonly string[] | undefined,
  supported: readonly string[],
): void {
  if (values === undefined) return;
  if (values.length === 0) {
    throw new EntityTimelineQueryValidationError(`Entity timeline ${name} must not be empty`);
  }
  for (const value of values) {
    if (!supported.includes(value)) {
      throw new EntityTimelineQueryValidationError(
        `Unsupported entity timeline ${name.slice(0, -1)} ${JSON.stringify(value)}`,
      );
    }
  }
}

function assertRange(range: RecordTimeRange | undefined): void {
  if (range === undefined) return;
  if (range.start !== undefined) assertTimestamp('occurredAt.start', range.start);
  if (range.end !== undefined) assertTimestamp('occurredAt.end', range.end);
  if (range.start !== undefined && range.end !== undefined && range.start > range.end) {
    throw new EntityTimelineQueryValidationError('Entity timeline occurredAt.start must not be after end');
  }
}

function assertTimestamp(name: string, value: IsoTimestamp): void {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new EntityTimelineQueryValidationError(`Entity timeline ${name} must be a valid ISO 8601 timestamp`);
  }
}

function inRange(value: IsoTimestamp, range: RecordTimeRange | undefined): boolean {
  return (range?.start === undefined || value >= range.start) &&
    (range?.end === undefined || value <= range.end);
}

function matchesOneOf<T extends string>(
  value: T,
  singular: T | undefined,
  plural: readonly T[] | undefined,
): boolean {
  return (singular === undefined || singular === value) &&
    (plural === undefined || plural.includes(value));
}
