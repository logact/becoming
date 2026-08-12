/**
 * Identifiers and timestamps are plain strings so the domain layer stays
 * free of framework and platform dependencies.
 *
 * - Entity ids are RFC 4122 UUIDs, stored as TEXT primary keys.
 * - Timestamps are ISO 8601 UTC strings (e.g. 2026-08-12T11:39:02.314Z),
 *   stored as TEXT DATETIME columns.
 */
export type EntityId = string;
export type IsoTimestamp = string;

export function newId(): EntityId {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  // RFC 4122 version 4 fallback for runtimes without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
}

export function nowIso(): IsoTimestamp {
  return new Date().toISOString();
}
