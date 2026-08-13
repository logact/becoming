import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import {
  createEntityLabelAssignment,
  endEntityLabelAssignment,
} from '../domain/entityLabel';
import type { EntityLabelAssignment } from '../domain/entityLabel';
import type { LabelRepository } from '../persistence/labelRepository';
import type { EntityLabelRepository } from '../persistence/entityLabelRepository';
import type { CoreEntityLookup } from './coreEntityLookup';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';

/**
 * Application boundary for managing temporal Label assignments on core
 * entities.
 *
 * The service depends only on framework-neutral ports — a `Clock`, an
 * `IdGenerator`, and the Label/EntityLabel persistence boundaries — so the
 * same assign/end behavior runs under any UI, HTTP, or serialization
 * framework (or none at all). All domain validation runs before persistence;
 * invalid commands throw domain errors and never reach the repository.
 *
 * Logical-reference integrity lives here because the `entity_labels` table
 * has no foreign keys:
 * - `labelId` must resolve to an existing Label via `LabelRepository`, and
 *   new assignments to an archived Label are rejected. Existing assignments
 *   to an archived Label stay resolvable; ending them remains allowed.
 * - `entityId` existence is validated by the application services that own
 *   each core aggregate; those boundaries arrive with their aggregates (see
 *   the Relation aggregate, which documents the same contract).
 * - At most one active assignment of the same Label to the same entity is
 *   enforced by the repository on every write.
 */

/** Thrown when the Label referenced by an assignment command does not exist. */
export class LabelNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Label ${id} not found`);
    this.name = 'LabelNotFoundError';
  }
}

/** Thrown when assigning a Label whose definition has been archived. */
export class LabelArchivedError extends Error {
  constructor(id: EntityId) {
    super(`Label ${id} is archived and cannot receive new assignments`);
    this.name = 'LabelArchivedError';
  }
}

/** Thrown when an assignment is requested by an id that does not exist. */
export class LabelAssignmentNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`EntityLabelAssignment ${id} not found`);
    this.name = 'LabelAssignmentNotFoundError';
  }
}

/** Thrown when a classification target has no row in its typed core table. */
export class LabelAssignmentEntityNotFoundError extends Error {
  constructor(entityType: CoreEntityType, id: EntityId) {
    super(`Label assignment entity ${entityType} ${id} not found`);
    this.name = 'LabelAssignmentEntityNotFoundError';
  }
}

/**
 * Command for assigning a Label to a core entity. `assignedAt` defaults to
 * the clock's current time (the moment the Label becomes active).
 */
export interface AssignLabelCommand {
  entityType: string;
  entityId: EntityId;
  labelId: EntityId;
  assignedAt?: IsoTimestamp;
}

export interface LabelAssignmentServicePorts {
  labels: LabelRepository;
  assignments: EntityLabelRepository;
  /** Optional only for legacy callers; new composition must supply it. */
  entities?: CoreEntityLookup;
  clock?: Clock;
  ids?: IdGenerator;
}

export class LabelAssignmentService {
  private readonly labels: LabelRepository;
  private readonly assignments: EntityLabelRepository;
  private readonly entities?: CoreEntityLookup;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(ports: LabelAssignmentServicePorts) {
    this.labels = ports.labels;
    this.assignments = ports.assignments;
    this.entities = ports.entities;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  /**
   * Assign a Label to a core entity, returning the stored assignment. Throws
   * `LabelNotFoundError` when the Label does not exist, `LabelArchivedError`
   * when it is archived, and a domain error when the entity already carries
   * an active assignment of the same Label.
   */
  async assignLabel(command: AssignLabelCommand): Promise<EntityLabelAssignment> {
    const entityType = command.entityType as CoreEntityType;
    // Construct first so malformed entity types/ids retain the domain error
    // contract, then validate the logical reference before any assignment row.
    const assignment = createEntityLabelAssignment(
      {
        entityType: command.entityType,
        entityId: command.entityId,
        labelId: command.labelId,
      },
      {
        id: this.ids.newId(),
        now: command.assignedAt ?? this.clock.now(),
      },
    );
    const label = await this.labels.getById(command.labelId);
    if (label === null) {
      throw new LabelNotFoundError(command.labelId);
    }
    if (label.archivedAt !== null) {
      throw new LabelArchivedError(command.labelId);
    }
    if (this.entities !== undefined && !(await this.entities.exists(entityType, command.entityId))) {
      throw new LabelAssignmentEntityNotFoundError(entityType, command.entityId);
    }
    await this.assignments.add(assignment);
    return assignment;
  }

  /**
   * End an active assignment: the Label stops applying to the entity.
   * Returns the ended assignment. Throws `LabelAssignmentNotFoundError` when
   * the id is unknown and a domain error when the assignment already ended.
   */
  async endLabelAssignment(
    assignmentId: EntityId,
    endedAt?: IsoTimestamp,
  ): Promise<EntityLabelAssignment> {
    const assignment = await this.assignments.getById(assignmentId);
    if (assignment === null) {
      throw new LabelAssignmentNotFoundError(assignmentId);
    }
    const ended = endEntityLabelAssignment(assignment, endedAt ?? this.clock.now());
    await this.assignments.save(ended);
    return ended;
  }

  /** Return every currently active Label assignment on the given entity. */
  async getActiveAssignments(
    entityType: CoreEntityType,
    entityId: EntityId,
  ): Promise<EntityLabelAssignment[]> {
    return this.assignments.findActiveForEntity(entityType, entityId);
  }

  /**
   * Return the full temporal assignment history of the given entity, active
   * and ended, so historical classifications stay inspectable.
   */
  async getAssignmentHistory(
    entityType: CoreEntityType,
    entityId: EntityId,
  ): Promise<EntityLabelAssignment[]> {
    return this.assignments.listForEntity(entityType, entityId);
  }
}
