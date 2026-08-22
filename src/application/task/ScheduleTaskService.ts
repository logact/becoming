import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type { RecordId, RelationId, TaskId } from '../../domain/shared/ids';
import type { TaskRepository } from '../../domain/task/repository/TaskRepository';
import type { TransactionRunner } from '../shared/TransactionRunner';

export const TASK_SCHEDULE_RECORD_KIND = 'taskScheduleChanged';

export interface ScheduleTaskCommand {
  taskId: TaskId;
  startAt?: Date;
  due?: Date;
  recordId: RecordId;
  relationId: RelationId;
  now: Date;
}

/** Atomically replaces a Task's optional schedule and records the change. */
export class ScheduleTaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  schedule(command: ScheduleTaskCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const task = await this.tasks.findById(command.taskId);
      if (task === null) throw new DomainError(`Unknown task: ${command.taskId}`);
      if (task.archived) throw new DomainError(`Cannot schedule archived task: ${command.taskId}`);

      task.setSchedule(command.startAt, command.due, command.now);
      await this.tasks.save(task);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: TASK_SCHEDULE_RECORD_KIND,
        detail: `Changed schedule for “${task.title}”`,
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
    });
  }
}
