/**
 * Creates a UI-originated entity id: the current time in base36 plus a
 * random base36 suffix. Good enough for locally created entries; the
 * repository layer stays the source of truth on collisions.
 */
export function createId(): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${time}-${random}`;
}
