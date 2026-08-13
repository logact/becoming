import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  archiveResource,
  createResource,
  updateResource,
} from '../domain/resource';
import type { NewResource, Resource, ResourceChanges } from '../domain/resource';
import {
  hasMaterialUpdate,
  resolveFieldPolicy,
} from '../domain/mutationProvenance';
import type { EntitySnapshot } from '../domain/mutationProvenance';
import type { RecordRepository } from '../persistence/recordRepository';
import type {
  ResourceFilter,
  ResourceRepository,
} from '../persistence/resourceRepository';
import { MutationProvenanceService } from './mutationProvenanceService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

/** Thrown when an application command names no Resource in the catalog. */
export class ResourceNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Resource ${id} not found`);
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Query boundary for quantity-owning features. Budget, allocation, and usage
 * models deliberately remain outside this task; their future repositories
 * implement this small port to protect their existing quantities from an
 * incompatible catalog-definition edit.
 */
export interface ResourceQuantityReferenceGuard {
  hasLinkedQuantities(resourceId: EntityId): Promise<boolean>;
}

/** Thrown instead of silently reinterpreting a linked amount. */
export class ResourceSemanticsChangeBlockedError extends Error {
  constructor(id: EntityId) {
    super(
      `Resource ${id} has linked quantities; its type, unit, or behavior cannot change without a migration`,
    );
    this.name = 'ResourceSemanticsChangeBlockedError';
  }
}

export interface CreateResourceCommand extends NewResource {
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface UpdateResourceCommand {
  id: EntityId;
  changes: ResourceChanges;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface ArchiveResourceCommand {
  id: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
}

/** Framework-neutral ports required by the resource catalog use cases. */
export interface ResourceServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  resources: (context: TContext) => ResourceRepository;
  records: (context: TContext) => RecordRepository;
  /** Read path used for queries and to construct before/after snapshots. */
  readResources: ResourceRepository;
  /** Optional until later quantity-owning features exist. */
  quantityReferences?: (context: TContext) => ResourceQuantityReferenceGuard;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Application lifecycle for catalog Resources. Commands are plain objects,
 * queries return domain values, and all mutation dependencies are ports, so
 * this service can sit behind a CLI, HTTP API, or native UI unchanged.
 */
export class ResourceService<TContext> {
  private readonly resources: (context: TContext) => ResourceRepository;
  private readonly readResources: ResourceRepository;
  private readonly quantityReferences?: (context: TContext) => ResourceQuantityReferenceGuard;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly provenance: MutationProvenanceService<TContext>;

  constructor(ports: ResourceServicePorts<TContext>) {
    this.resources = ports.resources;
    this.readResources = ports.readResources;
    this.quantityReferences = ports.quantityReferences;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.provenance = new MutationProvenanceService({
      unitOfWork: ports.unitOfWork,
      records: ports.records,
      clock: this.clock,
      ids: this.ids,
    });
  }

  async createResource(command: CreateResourceCommand): Promise<Resource> {
    const resource = createResource(command, {
      id: this.ids.newId(), now: this.clock.now(),
    });
    return this.provenance.mutateWithProvenance({
      entityType: 'resource', entityId: resource.id, action: 'create',
      actor: command.actor, occurredAt: command.occurredAt, after: snapshot(resource),
      mutate: async (context) => {
        await this.resources(context).add(resource);
        return resource;
      },
    });
  }

  async getResource(id: EntityId): Promise<Resource | null> {
    return this.readResources.getById(id);
  }

  async listResources(filter?: ResourceFilter): Promise<Resource[]> {
    return this.readResources.list(filter);
  }

  async updateResource(command: UpdateResourceCommand): Promise<Resource> {
    const before = await this.requireResource(command.id);
    const after = updateResource(before, command.changes, this.clock.now());
    if (!hasMaterialUpdate(snapshot(before), snapshot(after), resolveFieldPolicy('resource'))) {
      return before;
    }
    const changesSemantics = hasSemanticChange(before, after);
    return this.provenance.mutateWithProvenance({
      entityType: 'resource', entityId: command.id, action: 'update',
      actor: command.actor, occurredAt: command.occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        if (changesSemantics && this.quantityReferences !== undefined &&
          await this.quantityReferences(context).hasLinkedQuantities(command.id)) {
          throw new ResourceSemanticsChangeBlockedError(command.id);
        }
        await this.resources(context).save(after);
        return after;
      },
    });
  }

  /**
   * Archive without deleting history. Repeating the command returns the
   * existing archived aggregate and emits no second provenance mutation.
   */
  async archiveResource(command: ArchiveResourceCommand): Promise<Resource> {
    const before = await this.requireResource(command.id);
    if (before.archivedAt !== null) return before;
    const after = archiveResource(before, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'resource', entityId: command.id, action: 'archive',
      actor: command.actor, occurredAt: command.occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.resources(context).save(after);
        return after;
      },
    });
  }

  private async requireResource(id: EntityId): Promise<Resource> {
    const resource = await this.readResources.getById(id);
    if (resource === null) throw new ResourceNotFoundError(id);
    return resource;
  }
}

function hasSemanticChange(before: Resource, after: Resource): boolean {
  return before.resourceType !== after.resourceType ||
    before.unit !== after.unit || before.behavior !== after.behavior;
}

function snapshot(resource: Resource): EntitySnapshot {
  return {
    ...resource,
    capacity: resource.capacity === null ? null : resource.capacity.toString(),
  };
}
