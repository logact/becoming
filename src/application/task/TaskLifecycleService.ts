import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type { RecordId, RelationId, TaskId } from '../../domain/shared/ids';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import type { Task } from '../../domain/task/Task';

export const TASK_RECORD_KIND = {
  created: 'taskCreated',
  started: 'taskStarted',
  paused: 'taskPaused',
  resumed: 'taskResumed',
  completed: 'taskCompleted',
  failed: 'taskFailed',
  reopened: 'taskReopened',
} as const;

interface LifecycleCommand {
  taskId: TaskId;
  recordId: RecordId;
  relationId: RelationId;
  note?: string;
  now: Date;
}

type LifecycleAction = Exclude<keyof typeof TASK_RECORD_KIND, 'created'>;

const DEFAULT_ACTION_TEXT: { [K in LifecycleAction]: string } = {
  started: 'Started', paused: 'Paused', resumed: 'Resumed',
  completed: 'Completed', failed: 'Failed', reopened: 'Reopened',
};

/** Commands for Task lifecycle transitions and their immutable records. */
export class TaskLifecycleService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
  ) {}

  start(command: LifecycleCommand): Promise<void> { return this.apply('started', command, (task) => task.start(command.now)); }
  pause(command: LifecycleCommand): Promise<void> { return this.apply('paused', command, (task) => task.pause(command.now)); }
  resume(command: LifecycleCommand): Promise<void> { return this.apply('resumed', command, (task) => task.resume(command.now)); }
  complete(command: LifecycleCommand): Promise<void> { return this.apply('completed', command, (task) => task.complete(command.now)); }
  fail(command: LifecycleCommand): Promise<void> { return this.apply('failed', command, (task) => task.fail(command.now)); }
  reopen(command: LifecycleCommand): Promise<void> { return this.apply('reopened', command, (task) => task.reopen(command.now)); }

  private async apply(
    action: LifecycleAction,
    command: LifecycleCommand,
    transition: (task: Task) => void,
  ): Promise<void> {
    const task = await this.tasks.findById(command.taskId);
    if (task === null) throw new DomainError(`Unknown task: ${command.taskId}`);
    transition(task);
    await this.tasks.save(task);
    await this.records.append(Record.create({
      id: command.recordId,
      kind: TASK_RECORD_KIND[action],
      detail: command.note ?? `${DEFAULT_ACTION_TEXT[action]} “${task.title}”`,
      occurredAt: command.now,
    }));
    await this.relations.save(Relation.create({
      id: command.relationId,
      sourceType: 'record',
      sourceId: command.recordId,
      targetType: 'task',
      targetId: command.taskId,
      kind: 'logs',
      now: command.now,
    }));
  }
}
