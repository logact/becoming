import type { EntityId, IsoTimestamp } from './ids';
import { assertJsonValue } from './json';
import type { JsonValue } from './json';
import type { Record as OccurrenceRecord } from './record';

/** Fields whose captured occurrence values may be corrected by an appended Record. */
export const CORRECTABLE_RECORD_FIELDS = [
  'title',
  'description',
  'occurredAt',
  'payload',
] as const;

export type CorrectableRecordField = (typeof CORRECTABLE_RECORD_FIELDS)[number];

export interface RecordCorrectionChanges {
  title?: string | null;
  description?: string;
  occurredAt?: IsoTimestamp;
  payload?: unknown;
}

export interface RecordCorrectionPayload {
  targetRecordId: EntityId;
  changes: { [field in CorrectableRecordField]?: { before: JsonValue | null; after: JsonValue | null } };
}

const SENSITIVE_KEY = /(?:password|passphrase|secret|token|authorization|api[_-]?key|credential|private[_-]?key)/i;

/**
 * Return only the fields that were actually corrected. Payload keys which
 * look like credentials are omitted recursively from both sides: correction
 * history is inspectable but must not duplicate secrets from an occurrence.
 */
export function buildRecordCorrectionPayload(
  target: OccurrenceRecord,
  changes: RecordCorrectionChanges,
): RecordCorrectionPayload {
  const unknown = Object.keys(changes).filter(
    (field) => !(CORRECTABLE_RECORD_FIELDS as readonly string[]).includes(field),
  );
  if (unknown.length > 0) {
    throw new Error(`Record correction includes unsupported fields: ${unknown.join(', ')}`);
  }
  const entries: RecordCorrectionPayload['changes'] = {};
  if (changes.title !== undefined) {
    if (changes.title !== null && changes.title.trim().length === 0) {
      throw new Error('Record correction title must not be blank when present');
    }
    entries.title = { before: target.title, after: changes.title };
  }
  if (changes.description !== undefined) {
    if (changes.description.trim().length === 0) {
      throw new Error('Record correction description must not be blank');
    }
    entries.description = { before: target.description, after: changes.description };
  }
  if (changes.occurredAt !== undefined) {
    if (changes.occurredAt.trim().length === 0 || Number.isNaN(Date.parse(changes.occurredAt))) {
      throw new Error('Record correction occurredAt must be a valid ISO 8601 timestamp');
    }
    entries.occurredAt = { before: target.occurredAt, after: changes.occurredAt };
  }
  if (changes.payload !== undefined) {
    entries.payload = {
      before: redactSensitiveValues(target.payload),
      after: redactSensitiveValues(assertJsonValue(changes.payload)),
    };
  }
  if (Object.keys(entries).length === 0) {
    throw new Error('Record correction must change at least one allowed field');
  }
  return { targetRecordId: target.id, changes: entries };
}

function redactSensitiveValues(value: JsonValue | null): JsonValue | null {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, child]) => [key, redactSensitiveValues(child)]),
  );
}
