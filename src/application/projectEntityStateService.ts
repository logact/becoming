import { isCoreEntityType } from '../domain/entityTypes';
import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import { createProjectEntityState } from '../domain/projectEntityState';
import type { ProjectEntityState } from '../domain/projectEntityState';
import { SqliteEntityLabelRepository } from '../persistence/entityLabelRepository';
import { SqliteLabelRepository } from '../persistence/labelRepository';
import {
  ProjectEntityStateCurrentConflictError,
  SqliteProjectEntityStateRepository,
} from '../persistence/projectEntityStateRepository';
import { SqliteProjectStateRepository } from '../persistence/projectStateRepository';
import type { SqliteDatabase } from '../persistence/database';
import { withTransaction } from '../persistence/transactions';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';

/** A requested entity type lies outside the eight runtime-supported concepts. */
export class ProjectEntityStateUnsupportedEntityTypeError extends Error {
  constructor(entityType: string) {
    super(`Project entity state does not support entity type ${JSON.stringify(entityType)}`);
    this.name = 'ProjectEntityStateUnsupportedEntityTypeError';
  }
}

export class ProjectEntityStateProjectNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Project ${id} not found`);
    this.name = 'ProjectEntityStateProjectNotFoundError';
  }
}

export class ProjectEntityStateProjectArchivedError extends Error {
  constructor(id: EntityId) {
    super(`Project ${id} is archived`);
    this.name = 'ProjectEntityStateProjectArchivedError';
  }
}

export class ProjectEntityStateEntityNotFoundError extends Error {
  constructor(type: CoreEntityType, id: EntityId) {
    super(`${type} ${id} not found`);
    this.name = 'ProjectEntityStateEntityNotFoundError';
  }
}

export class ProjectEntityStateEntityArchivedError extends Error {
  constructor(type: CoreEntityType, id: EntityId) {
    super(`${type} ${id} is archived`);
    this.name = 'ProjectEntityStateEntityArchivedError';
  }
}

export class ProjectEntityStateLabelNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Label ${id} not found`);
    this.name = 'ProjectEntityStateLabelNotFoundError';
  }
}

export class ProjectEntityStateLabelArchivedError extends Error {
  constructor(id: EntityId) {
    super(`Label ${id} is archived`);
    this.name = 'ProjectEntityStateLabelArchivedError';
  }
}

export class ProjectEntityStateLabelAssignmentRequiredError extends Error {
  constructor(type: CoreEntityType, entityId: EntityId, labelId: EntityId) {
    super(`Label ${labelId} is not actively assigned to ${type} ${entityId}`);
    this.name = 'ProjectEntityStateLabelAssignmentRequiredError';
  }
}

export class ProjectEntityStateInitialStateMissingError extends Error {
  constructor(projectId: EntityId, type: CoreEntityType, labelId: EntityId) {
    super(`Project machine ${projectId}/${type}/${labelId} has no active initial state`);
    this.name = 'ProjectEntityStateInitialStateMissingError';
  }
}

export class ProjectEntityStateInitialStateAmbiguousError extends Error {
  constructor(projectId: EntityId, type: CoreEntityType, labelId: EntityId) {
    super(`Project machine ${projectId}/${type}/${labelId} has multiple active initial states`);
    this.name = 'ProjectEntityStateInitialStateAmbiguousError';
  }
}

export interface InitializeProjectEntityStateCommand {
  projectId: EntityId;
  entityType: string;
  entityId: EntityId;
  labelId: EntityId;
  enteredAt?: IsoTimestamp;
}

export interface ProjectEntityStateServicePorts {
  db: SqliteDatabase;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Initializes one runtime state period after validating every logical
 * reference. Transitions and automatic initialization are deliberately out
 * of scope; this service only creates a first period.
 */
export class ProjectEntityStateService {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: ProjectEntityStateServicePorts) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async initialize(
    command: InitializeProjectEntityStateCommand,
  ): Promise<ProjectEntityState> {
    if (!isCoreEntityType(command.entityType)) {
      throw new ProjectEntityStateUnsupportedEntityTypeError(command.entityType);
    }
    const entityType = command.entityType;
    return withTransaction(this.ports.db, async (db) => {
      await this.requireActiveProject(db, command.projectId);
      await this.requireActiveEntity(db, entityType, command.entityId);

      const labels = new SqliteLabelRepository(db);
      const label = await labels.getById(command.labelId);
      if (label === null) {
        throw new ProjectEntityStateLabelNotFoundError(command.labelId);
      }
      if (label.archivedAt !== null) {
        throw new ProjectEntityStateLabelArchivedError(command.labelId);
      }

      const assignments = new SqliteEntityLabelRepository(db);
      if (
        (await assignments.findActive(entityType, command.entityId, command.labelId)) ===
        null
      ) {
        throw new ProjectEntityStateLabelAssignmentRequiredError(
          entityType,
          command.entityId,
          command.labelId,
        );
      }

      const states = new SqliteProjectStateRepository(db);
      const initial = (await states.listActiveForMachine({
        projectId: command.projectId,
        entityType,
        labelId: command.labelId,
      })).filter((state) => state.isInitial);
      if (initial.length === 0) {
        throw new ProjectEntityStateInitialStateMissingError(
          command.projectId,
          entityType,
          command.labelId,
        );
      }
      if (initial.length > 1) {
        throw new ProjectEntityStateInitialStateAmbiguousError(
          command.projectId,
          entityType,
          command.labelId,
        );
      }

      const periods = new SqliteProjectEntityStateRepository(db);
      const period = createProjectEntityState(
        {
          ...command,
          entityType,
          projectStateId: initial[0].id,
        },
        { id: this.ids.newId(), now: command.enteredAt ?? this.clock.now() },
      );
      await periods.add(period);
      return period;
    });
  }

  /** Return the one current period for a context, if it has been initialized. */
  async getCurrentState(
    projectId: EntityId,
    entityType: CoreEntityType,
    entityId: EntityId,
    labelId: EntityId,
  ): Promise<ProjectEntityState | null> {
    return new SqliteProjectEntityStateRepository(this.ports.db).findCurrent({
      projectId,
      entityType,
      entityId,
      labelId,
    });
  }

  /** Return the complete append-preserved period history in chronological order. */
  async getStateHistory(
    projectId: EntityId,
    entityType: CoreEntityType,
    entityId: EntityId,
    labelId: EntityId,
  ): Promise<ProjectEntityState[]> {
    return new SqliteProjectEntityStateRepository(this.ports.db).listHistory({
      projectId,
      entityType,
      entityId,
      labelId,
    });
  }

  private async requireActiveProject(db: SqliteDatabase, id: EntityId): Promise<void> {
    const project = await db.getFirstAsync<{ archived_at: IsoTimestamp | null }>(
      'SELECT archived_at FROM projects WHERE id = ?',
      [id],
    );
    if (project === null) throw new ProjectEntityStateProjectNotFoundError(id);
    if (project.archived_at !== null) throw new ProjectEntityStateProjectArchivedError(id);
  }

  private async requireActiveEntity(
    db: SqliteDatabase,
    type: CoreEntityType,
    id: EntityId,
  ): Promise<void> {
    // A closed registry is intentional: it validates logical references with
    // independent core tables and never introduces a shared entities table.
    const table: Record<CoreEntityType, string> = {
      task: 'tasks',
      goal: 'goals',
      project: 'projects',
      idea: 'ideas',
      philosophy: 'philosophies',
      workflow: 'workflows',
      resource: 'resources',
      record: 'records',
    };
    const entity = await db.getFirstAsync<{ archived_at: IsoTimestamp | null }>(
      `SELECT archived_at FROM ${table[type]} WHERE id = ?`,
      [id],
    );
    if (entity === null) throw new ProjectEntityStateEntityNotFoundError(type, id);
    if (entity.archived_at !== null) {
      throw new ProjectEntityStateEntityArchivedError(type, id);
    }
  }
}

export { ProjectEntityStateCurrentConflictError };
