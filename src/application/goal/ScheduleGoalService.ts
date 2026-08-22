import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type { GoalId, RecordId, RelationId } from '../../domain/shared/ids';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { TransactionRunner } from '../shared/TransactionRunner';

export const GOAL_SCHEDULE_RECORD_KIND = 'goalScheduleChanged';

export interface ScheduleGoalCommand {
  goalId: GoalId;
  startAt?: Date;
  due?: Date;
  recordId: RecordId;
  relationId: RelationId;
  now: Date;
}

/** Atomically replaces a Goal's optional schedule and records the change. */
export class ScheduleGoalService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  schedule(command: ScheduleGoalCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const goal = await this.goals.findById(command.goalId);
      if (goal === null) throw new DomainError(`Unknown goal: ${command.goalId}`);
      if (goal.archived) throw new DomainError(`Cannot schedule archived goal: ${command.goalId}`);

      goal.setSchedule(command.startAt, command.due, command.now);
      await this.goals.save(goal);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: GOAL_SCHEDULE_RECORD_KIND,
        detail: `Changed schedule for “${goal.title}”`,
        occurredAt: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.relationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'goal',
        targetId: command.goalId,
        kind: 'logs',
        now: command.now,
      }));
    });
  }
}
