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

/** Input for a complete entity timeline. */
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

/**
 * Cursor paging input. Choose exactly one traversal form: `first` with an
 * optional `after`, or `last` with an optional `before`. Page sizes are
 * deliberately capped so callers cannot turn a history read into an
 * unbounded projection request.
 */
export interface EntityTimelinePageQuery extends EntityTimelineQuery {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface EntityTimelinePageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  /** Pass to `first`/`after` to continue toward later timeline events. */
  nextCursor: string | null;
  /** Pass to `last`/`before` to continue toward earlier timeline events. */
  previousCursor: string | null;
}

export interface EntityTimelinePage {
  events: TimelineEvent[];
  pageInfo: EntityTimelinePageInfo;
}

/** Invalid serialized cursors are distinct from ordinary filter errors. */
export class EntityTimelineCursorError extends EntityTimelineQueryValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'EntityTimelineCursorError';
  }
}

/** Maximum events returned by one cursor page. */
export const ENTITY_TIMELINE_MAX_PAGE_SIZE = 100;

const CURSOR_VERSION = 1;
type CursorDirection = 'forward' | 'backward';

interface TimelineCursor {
  version: number;
  direction: CursorDirection;
  entity: TimelineEntityReference;
  scope: string;
  key: { occurredAt: IsoTimestamp; recordedAt: IsoTimestamp; recordId: EntityId };
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

  /**
   * Return one deterministic keyset page. Filters are composed before the
   * cursor boundary, so an event cannot move into a page merely because the
   * caller narrowed its query. This intentionally makes no snapshot promise:
   * an event inserted after a previously returned key can appear on a later
   * page; one inserted before it cannot. Records are append-only, therefore
   * a successful traversal has neither duplicates nor omissions for the set
   * visible at each boundary.
   */
  async listPage(
    entity: { type: string; id: EntityId },
    query: EntityTimelinePageQuery,
  ): Promise<EntityTimelinePage> {
    const resolved = await resolveTimelineEntity(this.ports.entities, entity);
    assertQuery(query);
    const traversal = assertPageQuery(query);
    const scope = fingerprintScope(resolved, query);
    const cursor = traversal.cursor === undefined
      ? undefined
      : decodeCursor(traversal.cursor, traversal.direction, resolved, scope);
    const events = (await this.list(resolved, query));
    const boundary = cursor === undefined ? undefined : cursor.key;

    if (traversal.direction === 'forward') {
      const start = boundary === undefined ? 0 : upperBound(events, boundary);
      const page = events.slice(start, start + traversal.size);
      const hasPreviousPage = start > 0;
      const hasNextPage = start + page.length < events.length;
      return {
        events: page,
        pageInfo: pageInfo(page, resolved, scope, hasPreviousPage, hasNextPage),
      };
    }

    const end = boundary === undefined ? events.length : lowerBound(events, boundary);
    const start = Math.max(0, end - traversal.size);
    const page = events.slice(start, end);
    const hasPreviousPage = start > 0;
    const hasNextPage = end < events.length;
    return {
      events: page,
      pageInfo: pageInfo(page, resolved, scope, hasPreviousPage, hasNextPage),
    };
  }

  /** Readable alias for callers that name their application operation. */
  async listTimelinePage(
    entity: { type: string; id: EntityId },
    query: EntityTimelinePageQuery,
  ): Promise<EntityTimelinePage> {
    return this.listPage(entity, query);
  }

  private async listAllRecords(
    status: 'active' | 'archived' | 'all',
    occurredAt: RecordTimeRange | undefined,
  ) {
    const records = [] as Awaited<ReturnType<RecordHistoryRepository['list']>>;
    const limit = 100;
    let after: { recordedAt: IsoTimestamp; occurredAt: IsoTimestamp; id: EntityId } | undefined;
    for (;;) {
      const page = await this.ports.records.list({ status, occurredAt, limit, after });
      records.push(...page);
      if (page.length < limit) return records;
      const final = page[page.length - 1];
      after = { recordedAt: final.recordedAt, occurredAt: final.occurredAt, id: final.id };
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

function assertPageQuery(query: EntityTimelinePageQuery): {
  direction: CursorDirection;
  size: number;
  cursor: string | undefined;
} {
  const forward = query.first !== undefined;
  const backward = query.last !== undefined;
  if (forward === backward) {
    throw new EntityTimelineQueryValidationError('Entity timeline page requires exactly one of first or last');
  }
  if (query.after !== undefined && !forward) {
    throw new EntityTimelineQueryValidationError('Entity timeline after cursor requires first');
  }
  if (query.before !== undefined && !backward) {
    throw new EntityTimelineQueryValidationError('Entity timeline before cursor requires last');
  }
  if (query.after !== undefined && query.before !== undefined) {
    throw new EntityTimelineQueryValidationError('Entity timeline page cannot combine after and before cursors');
  }
  const size = query.first ?? query.last!;
  if (!Number.isInteger(size) || size < 1 || size > ENTITY_TIMELINE_MAX_PAGE_SIZE) {
    throw new EntityTimelineQueryValidationError(
      `Entity timeline page size must be an integer from 1 through ${ENTITY_TIMELINE_MAX_PAGE_SIZE}`,
    );
  }
  return forward
    ? { direction: 'forward', size, cursor: query.after }
    : { direction: 'backward', size, cursor: query.before };
}

function pageInfo(
  events: readonly TimelineEvent[],
  entity: TimelineEntityReference,
  scope: string,
  hasPreviousPage: boolean,
  hasNextPage: boolean,
): EntityTimelinePageInfo {
  return {
    hasNextPage,
    hasPreviousPage,
    nextCursor: hasNextPage && events.length > 0
      ? encodeCursor('forward', events[events.length - 1], entity, scope)
      : null,
    previousCursor: hasPreviousPage && events.length > 0
      ? encodeCursor('backward', events[0], entity, scope)
      : null,
  };
}

function upperBound(events: readonly TimelineEvent[], key: TimelineCursor['key']): number {
  const index = events.findIndex((event) => compareKey(event, key) > 0);
  return index === -1 ? events.length : index;
}

function lowerBound(events: readonly TimelineEvent[], key: TimelineCursor['key']): number {
  const index = events.findIndex((event) => compareKey(event, key) >= 0);
  return index === -1 ? events.length : index;
}

function compareKey(event: TimelineEvent, key: TimelineCursor['key']): number {
  return event.occurredAt.localeCompare(key.occurredAt) ||
    event.recordedAt.localeCompare(key.recordedAt) ||
    event.recordId.localeCompare(key.recordId);
}

function encodeCursor(
  direction: CursorDirection,
  event: TimelineEvent,
  entity: TimelineEntityReference,
  scope: string,
): string {
  return base64UrlEncode(JSON.stringify({
    version: CURSOR_VERSION,
    direction,
    entity,
    scope,
    key: { occurredAt: event.occurredAt, recordedAt: event.recordedAt, recordId: event.recordId },
  } satisfies TimelineCursor));
}

function decodeCursor(
  value: string,
  expectedDirection: CursorDirection,
  entity: TimelineEntityReference,
  scope: string,
): TimelineCursor {
  let cursor: TimelineCursor;
  try {
    cursor = JSON.parse(base64UrlDecode(value)) as TimelineCursor;
  } catch {
    throw new EntityTimelineCursorError('Entity timeline cursor is malformed');
  }
  if (cursor === null || typeof cursor !== 'object') {
    throw new EntityTimelineCursorError('Entity timeline cursor is malformed');
  }
  if (cursor.version !== CURSOR_VERSION) {
    throw new EntityTimelineCursorError(`Entity timeline cursor version ${JSON.stringify(cursor.version)} is unsupported`);
  }
  if (cursor.direction !== expectedDirection) {
    throw new EntityTimelineCursorError('Entity timeline cursor direction is incompatible with this traversal');
  }
  if (cursor.entity?.type !== entity.type || cursor.entity?.id !== entity.id) {
    throw new EntityTimelineCursorError('Entity timeline cursor belongs to a different entity');
  }
  if (cursor.scope !== scope) {
    throw new EntityTimelineCursorError('Entity timeline cursor does not match this filter or archive scope');
  }
  if (!validCursorKey(cursor.key)) {
    throw new EntityTimelineCursorError('Entity timeline cursor key is malformed');
  }
  return cursor;
}

function validCursorKey(key: TimelineCursor['key'] | undefined): key is TimelineCursor['key'] {
  return key !== undefined && typeof key.occurredAt === 'string' && typeof key.recordedAt === 'string' &&
    typeof key.recordId === 'string' && key.occurredAt.length > 0 && key.recordedAt.length > 0 && key.recordId.length > 0;
}

function fingerprintScope(entity: TimelineEntityReference, query: EntityTimelineQuery): string {
  const scope = JSON.stringify({
    entity,
    status: query.status ?? 'active',
    recordType: query.recordType ?? null,
    recordTypes: query.recordTypes === undefined ? null : [...query.recordTypes].sort(),
    category: query.category ?? null,
    categories: query.categories === undefined ? null : [...query.categories].sort(),
    occurredAt: query.occurredAt ?? null,
    order: ['occurredAt', 'recordedAt', 'recordId'],
  });
  let hash = 2166136261;
  for (let index = 0; index < scope.length; index += 1) {
    hash ^= scope.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function base64UrlEncode(value: string): string {
  return encodeURIComponent(value);
}

function base64UrlDecode(value: string): string {
  return decodeURIComponent(value);
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
