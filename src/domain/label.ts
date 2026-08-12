import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * The Label aggregate: a supporting classification concept that can be
 * attached to any of the eight core entity types via `entity_labels`.
 *
 * A Label is stored in its own `labels` table and owns only its intrinsic
 * definition: identity, name, and description. Whether a Label also defines
 * a state-machine variant is decided by Workflow/Project configuration, not
 * by this aggregate.
 *
 * Archival is the only lifecycle transition on the definition itself:
 * `archived_at` IS NULL means active. Archived Labels stay stored so
 * historical references (entity_labels, state machines, state history)
 * remain resolvable by id.
 */
export interface Label {
  id: EntityId;
  name: string;
  description: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/** Input for defining a new Label. */
export interface NewLabel {
  name: string;
  description?: string;
}

/** Validate the invariants every Label must satisfy. */
export function validateLabel(label: Label): void {
  if (label.name.trim().length === 0) {
    throw new Error('Label name must not be blank');
  }
}

/**
 * Define a new Label with a fresh id and current timestamps. `description`
 * normalizes to null when omitted, matching the TEXT column.
 */
export function createLabel(input: NewLabel): Label {
  const now = nowIso();
  const label: Label = {
    id: newId(),
    name: input.name,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateLabel(label);
  return label;
}

/**
 * Archive a Label definition. Returns a new aggregate; the input is not
 * mutated. Archiving an already archived Label is rejected as an invalid
 * state change.
 */
export function archiveLabel(
  label: Label,
  archivedAt: IsoTimestamp = nowIso(),
): Label {
  if (label.archivedAt !== null) {
    throw new Error(`Label ${label.id} is already archived`);
  }
  return { ...label, archivedAt, updatedAt: archivedAt };
}
