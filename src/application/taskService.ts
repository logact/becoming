import type { EntityId, IsoTimestamp } from '../domain/ids';
import { archiveTask, createTask, updateTask } from '../domain/task';
import type { NewTask, Task, TaskChanges } from '../domain/task';
import { MutationProvenanceService } from './mutationProvenanceService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';
import type { RecordRepository } from '../persistence/recordRepository';
import type { TaskListOptions, TaskRepository } from '../persistence/taskRepository';

export class TaskNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Task ${id} not found`);
    this.name = 'TaskNotFoundError';
  }
}

export interface CreateTaskCommand extends NewTask {
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface TaskServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  tasks: (context: TContext) => TaskRepository;
  records: (context: TContext) => RecordRepository;
  readTasks: TaskRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Application boundary for intrinsic Task mutations and queries. It has no
 * dependency on project membership, workflow, state, relations, or resources.
 */
export class TaskService<TContext> {
  private readonly tasks: (context: TContext) => TaskRepository;
  private readonly readTasks: TaskRepository;
  private readonly clock: Clock;
  private readonly provenance: MutationProvenanceService<TContext>;

  constructor(ports: TaskServicePorts<TContext>) {
    this.tasks = ports.tasks;
    this.readTasks = ports.readTasks;
    this.clock = ports.clock ?? systemClock;
    this.provenance = new MutationProvenanceService({
      unitOfWork: ports.unitOfWork,
      records: ports.records,
      clock: this.clock,
      ids: ports.ids ?? uuidGenerator,
    });
  }

  async createTask(command: CreateTaskCommand): Promise<Task> {
    const task = createTask(command);
    return this.provenance.mutateWithProvenance({
      entityType: 'task', entityId: task.id, action: 'create',
      actor: command.actor, occurredAt: command.occurredAt, after: snapshot(task),
      mutate: async (context) => {
        await this.tasks(context).add(task);
        return task;
      },
    });
  }

  async updateTask(
    id: EntityId, changes: TaskChanges, actor: string, occurredAt?: IsoTimestamp,
  ): Promise<Task> {
    const before = await this.requireTask(id);
    const after = updateTask(before, changes, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'task', entityId: id, action: 'update', actor, occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.tasks(context).save(after);
        return after;
      },
    });
  }

  async archiveTask(id: EntityId, actor: string, occurredAt?: IsoTimestamp): Promise<Task> {
    const before = await this.requireTask(id);
    const after = archiveTask(before, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'task', entityId: id, action: 'archive', actor, occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.tasks(context).save(after);
        return after;
      },
    });
  }

  async getTask(id: EntityId): Promise<Task | null> {
    return this.readTasks.getById(id);
  }

  async listActive(options?: TaskListOptions): Promise<Task[]> {
    return this.readTasks.list(options);
  }

  async listHistory(options?: TaskListOptions): Promise<Task[]> {
    return this.readTasks.list({ ...options, includeArchived: true });
  }

  private async requireTask(id: EntityId): Promise<Task> {
    const task = await this.readTasks.getById(id);
    if (task === null) throw new TaskNotFoundError(id);
    return task;
  }
}

function snapshot(task: Task): { [field: string]: unknown } {
  return { ...task };
}
