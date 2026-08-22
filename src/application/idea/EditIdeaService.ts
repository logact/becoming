import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type { IdeaId, RecordId, RelationId } from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { IDEA_RECORD_KIND } from './ideaRecordKinds';

export interface EditIdeaCommand {
  ideaId: IdeaId;
  content: string;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
}

/** Atomically changes Idea content and logs an immutable edit record. */
export class EditIdeaService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  edit(command: EditIdeaCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const idea = await this.ideas.findById(command.ideaId);
      if (idea === null) throw new DomainError(`Unknown idea: ${command.ideaId}`);

      const nextContent = command.content.trim();
      if (nextContent === idea.content) return;
      idea.edit(command.content, command.now);
      await this.ideas.save(idea);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: IDEA_RECORD_KIND.edited,
        detail: `Edited idea to “${idea.content}”`,
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
