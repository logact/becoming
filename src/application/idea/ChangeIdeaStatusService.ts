import type { IdeaStatus } from '../../domain/idea/Idea';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type { IdeaId, RecordId, RelationId } from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { IDEA_RECORD_KIND } from './ideaRecordKinds';

export interface ChangeIdeaStatusCommand {
  ideaId: IdeaId;
  status: IdeaStatus;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
}

/** Atomically changes an Idea's workflow status and records the transition. */
export class ChangeIdeaStatusService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  change(command: ChangeIdeaStatusCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const idea = await this.ideas.findById(command.ideaId);
      if (idea === null) throw new DomainError(`Unknown idea: ${command.ideaId}`);

      const previous = idea.status;
      if (previous === command.status) return;
      idea.changeStatus(command.status, command.now);
      await this.ideas.save(idea);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: IDEA_RECORD_KIND.statusChanged,
        detail: `${previous} → ${command.status}`,
        occurredAt: command.now,
      }));
      await this.relations.save(Relation.create({
        id: command.recordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'idea',
        targetId: command.ideaId,
        kind: 'logs',
        now: command.now,
      }));
    });
  }
}
