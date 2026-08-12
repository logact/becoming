/**
 * The shared structured-JSON contract for optional payloads and metadata
 * stored as TEXT columns (Record payloads, Relation metadata, ...).
 *
 * A `JsonValue` is exactly what survives a JSON.stringify/JSON.parse round
 * trip. Validation rejects anything that would serialize with loss:
 * functions, undefined, symbols, BigInt, non-finite numbers, class
 * instances, and circular references.
 */

/** A JSON value that survives a JSON.stringify/JSON.parse round trip. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Validate that a value is a structured JSON value that serializes without
 * loss. `path` names the field in error messages (e.g. "payload",
 * "metadata", or a nested path like "metadata.constraint").
 */
export function assertJsonValue(
  value: unknown,
  path = 'payload',
  seen: ReadonlySet<object> = new Set(),
): JsonValue {
  if (value === null) {
    return null;
  }
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error(`${path} must be a finite number`);
      }
      return value;
    case 'object': {
      if (seen.has(value)) {
        throw new Error(`${path} must not contain circular references`);
      }
      const seenWithValue = new Set(seen).add(value);
      if (Array.isArray(value)) {
        return value.map((item, index) =>
          assertJsonValue(item, `${path}[${index}]`, seenWithValue),
        );
      }
      if (Object.getPrototypeOf(value) !== Object.prototype) {
        throw new Error(
          `${path} must be a plain JSON object, array, or primitive`,
        );
      }
      const entries = Object.entries(value as { [key: string]: unknown }).map(
        ([key, item]) => [
          key,
          assertJsonValue(item, `${path}.${key}`, seenWithValue),
        ],
      );
      return Object.fromEntries(entries);
    }
    default:
      throw new Error(`${path} must be JSON-serializable, got ${typeof value}`);
  }
}
