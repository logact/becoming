import { Decimal } from './decimal';
import { newId, nowIso } from './ids';
import type { EntityId, IsoTimestamp } from './ids';

/**
 * The Resource aggregate: something available that enables or constrains
 * action (time, money, attention, energy, tokens, compute, ...).
 *
 * A Resource is an independent core entity stored in its own `resources`
 * table and owns only its intrinsic catalog definition: identity, semantic
 * type, measurement unit, behavior, and optional capacity. Budgets,
 * allocations, constraints, and consumption are NOT intrinsic fields; they
 * are modeled through `relations` and `records` by later tasks.
 *
 * Catalog invariants enforced here:
 * - `title` and `resourceType` must not be blank.
 * - `unit`, when present, must not be blank.
 * - `capacity`, when present, is an exact `Decimal` (never a float) and must
 *   not be negative.
 * - A capacity without a unit is meaningless: `capacity` requires `unit`.
 *
 * Archival is the only lifecycle transition on the definition itself:
 * `archived_at` IS NULL means active. Archived Resources stay stored so
 * history that references them (allocations, consumption records) remains
 * resolvable by id.
 */
export interface Resource {
  id: EntityId;
  title: string;
  description: string | null;
  resourceType: string;
  unit: string | null;
  behavior: string | null;
  capacity: Decimal | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt: IsoTimestamp | null;
}

/**
 * Input for defining a new Resource. `capacity` is given as an exact
 * `Decimal` or its canonical string; passing a `number` is rejected at
 * compile time and at runtime, so binary floating point can never enter.
 */
export interface NewResource {
  title: string;
  resourceType: string;
  description?: string;
  unit?: string;
  behavior?: string;
  capacity?: Decimal | string;
}

/** Injectable values used when defining a Resource in an application service. */
export interface ResourceFactoryDeps {
  id?: EntityId;
  now?: IsoTimestamp;
}

/** The editable fields of an active Resource definition. */
export interface ResourceChanges {
  title?: string;
  /** Omit to retain the description; pass null to clear it. */
  description?: string | null;
  resourceType?: string;
  /** Omit to retain the unit; pass null only when capacity is also cleared. */
  unit?: string | null;
  /** Omit to retain the behavior; pass null to clear it. */
  behavior?: string | null;
  /** Omit to retain capacity; pass null to clear it. */
  capacity?: Decimal | string | null;
}

function requireNonBlank(field: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Resource ${field} must not be blank`);
  }
  return value;
}

function normalizeCapacity(
  capacity: Decimal | string | undefined,
): Decimal | null {
  if (capacity === undefined) {
    return null;
  }
  const decimal =
    typeof capacity === 'string' ? Decimal.parse(capacity) : capacity;
  // Canonicalize so the in-memory aggregate always matches the persisted
  // TEXT form: a round-trip is then a structural no-op (e.g. 12500.50 is
  // stored and reloaded as 12500.5).
  return Decimal.parse(decimal.toString());
}

/** Validate the catalog invariants every Resource must satisfy. */
export function validateResource(resource: Resource): void {
  requireNonBlank('title', resource.title);
  requireNonBlank('resourceType', resource.resourceType);
  if (resource.unit !== null && resource.unit.trim().length === 0) {
    throw new Error('Resource unit must not be blank when present');
  }
  if (resource.capacity !== null) {
    if (resource.unit === null) {
      throw new Error(`Resource ${resource.id} capacity requires a unit`);
    }
    if (resource.capacity.compare(Decimal.zero()) < 0) {
      throw new Error(
        `Resource ${resource.id} capacity must not be negative, got ${resource.capacity.toString()}`,
      );
    }
  }
}

/**
 * Define a new Resource with a fresh id and current timestamps. Optional
 * detail fields normalize to null when omitted, matching the TEXT columns.
 */
export function createResource(
  input: NewResource,
  deps: ResourceFactoryDeps = {},
): Resource {
  const now = deps.now ?? nowIso();
  const resource: Resource = {
    id: deps.id ?? newId(),
    title: requireNonBlank('title', input.title),
    description: input.description ?? null,
    resourceType: requireNonBlank('resourceType', input.resourceType),
    unit: input.unit ?? null,
    behavior: input.behavior ?? null,
    capacity: normalizeCapacity(input.capacity),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  validateResource(resource);
  return resource;
}

/**
 * Update an active Resource definition. The application layer is responsible
 * for first checking linked quantities before semantic fields change.
 */
export function updateResource(
  resource: Resource,
  changes: ResourceChanges,
  updatedAt: IsoTimestamp = nowIso(),
): Resource {
  if (resource.archivedAt !== null) {
    throw new Error(`Resource ${resource.id} is archived and cannot be updated`);
  }
  const updated: Resource = {
    ...resource,
    title: changes.title ?? resource.title,
    description:
      changes.description === undefined ? resource.description : changes.description,
    resourceType: changes.resourceType ?? resource.resourceType,
    unit: changes.unit === undefined ? resource.unit : changes.unit,
    behavior: changes.behavior === undefined ? resource.behavior : changes.behavior,
    capacity:
      changes.capacity === undefined
        ? resource.capacity
        : changes.capacity === null
          ? null
          : normalizeCapacity(changes.capacity),
    updatedAt,
  };
  validateResource(updated);
  return updated;
}

/**
 * Archive a Resource definition. Returns a new aggregate; the input is not
 * mutated. Archiving an already archived Resource is rejected as an invalid
 * state change.
 */
export function archiveResource(
  resource: Resource,
  archivedAt: IsoTimestamp = nowIso(),
): Resource {
  if (resource.archivedAt !== null) {
    throw new Error(`Resource ${resource.id} is already archived`);
  }
  return { ...resource, archivedAt, updatedAt: archivedAt };
}
