import { Goal } from '../../domain/goal/Goal';
import type { GoalRepository } from '../../domain/goal/repository/GoalRepository';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type {
  GoalId,
  IdeaId,
  RecordId,
  RelationId,
} from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { IDEA_RECORD_KIND } from './ideaRecordKinds';

export interface CreateGoalFromIdeaCommand {
  ideaId: IdeaId;
  goalId: GoalId;
  title: string;
  description?: string;
  startAt?: Date;
  due?: Date;
  derivedRelationId: RelationId;
  recordId: RecordId;
  ideaRecordRelationId: RelationId;
  goalRecordRelationId: RelationId;
  now: Date;
}

/** Atomically derives a top-level Goal from an existing, non-archived Idea. */
export class CreateGoalFromIdeaService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly goals: GoalRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  create(command: CreateGoalFromIdeaCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const idea = await this.ideas.findById(command.ideaId);
      if (idea === null) throw new DomainError(`Unknown idea: ${command.ideaId}`);
      if (idea.archived) throw new DomainError(`Cannot derive from archived idea: ${command.ideaId}`);
      if (command.title.trim().length === 0) {
        throw new DomainError('Goal title must not be empty');
      }

      const goal = Goal.create({
        id: command.goalId,
        title: command.title,
        description: command.description ?? idea.content,
        ...(command.startAt === undefined ? {} : { startAt: command.startAt }),
        ...(command.due === undefined ? {} : { due: command.due }),
        now: command.now,
      });
      for (const labelId of idea.labelIds) goal.addLabel(labelId);

      await this.goals.save(goal);
      await this.relations.save(Relation.derivedFromIdea({
        id: command.derivedRelationId,
        sourceType: 'goal',
        sourceId: command.goalId,
        ideaId: command.ideaId,
        now: command.now,
      }));

      if (idea.status !== 'handled') {
        idea.handle(command.now);
        await this.ideas.save(idea);
      }

      await this.records.append(Record.create({
        id: command.recordId,
        kind: IDEA_RECORD_KIND.derivedGoal,
        detail: `Created Goal “${goal.title}” from Idea`,
        occurredAt: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.ideaRecordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'idea',
        targetId: command.ideaId,
        kind: 'logs',
        now: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.goalRecordRelationId,
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
