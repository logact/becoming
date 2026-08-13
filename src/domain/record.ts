import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';
import { assertJsonValue } from './json';
import type { JsonValue } from './json';

// The structured-JSON contract is shared with other aggregates (e.g. Relation
// metadata); it lives in ./json and is re-exported here for convenience.
export { assertJsonValue } from './json';
export type { JsonValue } from './json';

/**
 * The Record aggregate: something that actually happened.
 *
 * A Record is an independent core entity stored in its own `records` table
 * and owns only the intrinsic description of one occurrence: what happened
 * (description, optional title), how it is classified (record type), when it
 * happened (`occurredAt`), when it was entered (`recordedAt`), who or what
 * reported it (optional actor), and an optional structured JSON payload.
 * Relationships to Tasks, Goals, Projects, Resources, etc. are NOT intrinsic
 * fields; they are modeled through `relations` by later tasks.
 *
 * Invariants enforced here:
 * - `description` and `recordType` must not be blank.
 * - `recordType` must be supported by the record-type policy in effect.
 * - `occurredAt` and `recordedAt` are independent, required ISO 8601
 *   timestamps; neither defaults from the other.
 * - `title` and `actor`, when present, must not be blank.
 * - `payload`, when present, must be a structured JSON value that serializes
 *   without loss (no functions, undefined, BigInt, non-finite numbers, or
 *   circular references).
 *
 * Corrections are separate, appended Records. Archiving retains this row and
 * is deliberately idempotent: retrying an archive returns the first archived
 * version unchanged, so a transient caller can safely retry without moving
 * the historical archive time.
 */

/**
 * The default supported record types (see `Table-definetion.txt`). The policy
 * is explicit and extensible: validation accepts an override list so new
 * types can be adopted deliberately instead of silently.
 *
 * `mutation` is adopted by the atomic core-mutation provenance contract (see
 * `src/domain/mutationProvenance.ts`): one Record of this type carries the
 * provenance payload of each audited core-entity mutation.
 */
export const RECORD_TYPES = [
  'action',
  'observation',
  'progress',
  'failure',
  'discovery',
  'state_transition',
  'resource_usage',
  'external_event',
  'correction',
  'mutation',
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export function isRecordType(value: string): value is RecordType {
  return (RECORD_TYPES as readonly string[]).includes(value);
}

export interface Record {
  id: EntityId;
  title: string | null;
  description: string;
  recordType: string;
  occurredAt: IsoTimestamp;
  recordedAt: IsoTimestamp;
  actor: string | null;
  payload: JsonValue | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/**
 * Input for creating a new Record. `occurredAt` and `recordedAt` are both
 * required and independent: when the thing happened is not necessarily when
 * it was entered.
 */
export interface NewRecord {
  description: string;
  recordType: string;
  occurredAt: IsoTimestamp;
  recordedAt: IsoTimestamp;
  title?: string;
  actor?: string;
  payload?: unknown;
}

/** Optional dependencies, primarily for deterministic tests and services. */
export interface RecordFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
  supportedRecordTypes?: readonly string[];
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Record ${field} must not be blank`);
  }
  return value;
}

function requireTimestamp(field: string, value: IsoTimestamp): IsoTimestamp {
  if (value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    throw new Error(
      `Record ${field} must be a valid ISO 8601 timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requireSupportedRecordType(
  recordType: string,
  supportedRecordTypes: readonly string[],
): string {
  requireNonBlank('recordType', recordType);
  if (!supportedRecordTypes.includes(recordType)) {
    throw new Error(
      `Unsupported record type ${JSON.stringify(recordType)}; supported types: ${supportedRecordTypes.join(', ')}`,
    );
  }
  return recordType;
}

/**
 * Validate the invariants every Record must satisfy. The record-type policy
 * defaults to `RECORD_TYPES` and can be extended with additional types.
 */
export function validateRecord(
  record: Record,
  supportedRecordTypes: readonly string[] = RECORD_TYPES,
): void {
  requireNonBlank('description', record.description);
  requireSupportedRecordType(record.recordType, supportedRecordTypes);
  requireTimestamp('occurredAt', record.occurredAt);
  requireTimestamp('recordedAt', record.recordedAt);
  if (record.title !== null && record.title.trim().length === 0) {
    throw new Error('Record title must not be blank when present');
  }
  if (record.actor !== null && record.actor.trim().length === 0) {
    throw new Error('Record actor must not be blank when present');
  }
  if (record.payload !== null) {
    assertJsonValue(record.payload);
  }
}

/**
 * Create a new Record with a fresh id and current audit timestamps. All
 * validation runs before the aggregate exists, so invalid input can never
 * reach persistence.
 */
export function createRecord(
  input: NewRecord,
  deps: RecordFactoryDeps = {},
): Record {
  const supportedRecordTypes = deps.supportedRecordTypes ?? RECORD_TYPES;
  const now = deps.now ?? nowIso();
  const record: Record = {
    id: deps.id ?? newId(),
    title: input.title ?? null,
    description: requireNonBlank('description', input.description),
    recordType: requireSupportedRecordType(
      input.recordType,
      supportedRecordTypes,
    ),
    occurredAt: requireTimestamp('occurredAt', input.occurredAt),
    recordedAt: requireTimestamp('recordedAt', input.recordedAt),
    actor: input.actor ?? null,
    payload:
      input.payload === undefined ? null : assertJsonValue(input.payload),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateRecord(record, supportedRecordTypes);
  return record;
}

/**
 * Archive a Record without erasing the occurrence it captured.
 *
 * This is an idempotent operation. The first archive timestamp wins and a
 * repeated request returns the same archived aggregate unchanged.
 */
export function archiveRecord(
  record: Record,
  archivedAt: IsoTimestamp = nowIso(),
): Record {
  if (record.archivedAt !== null) {
    return record;
  }
  requireTimestamp('archivedAt', archivedAt);
  const archived: Record = {
    ...record,
    archivedAt,
    updatedAt: archivedAt,
  };
  validateRecord(archived);
  return archived;
}
