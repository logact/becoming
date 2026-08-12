/**
 * The eight core concepts of the V1 domain. Each is an independent aggregate
 * stored in its own table; there is no shared `entities` table.
 */
export const CORE_ENTITY_TYPES = [
  'task',
  'goal',
  'project',
  'idea',
  'philosophy',
  'workflow',
  'resource',
  'record',
] as const;

export type CoreEntityType = (typeof CORE_ENTITY_TYPES)[number];

export function isCoreEntityType(value: string): value is CoreEntityType {
  return (CORE_ENTITY_TYPES as readonly string[]).includes(value);
}
