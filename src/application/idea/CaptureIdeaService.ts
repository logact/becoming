import { Idea } from '../../domain/idea/Idea';
import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import type { IdeaId, RecordId, RelationId } from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { IDEA_RECORD_KIND } from './ideaRecordKinds';

export interface CaptureIdeaCommand {
  ideaId: IdeaId;
  content: string;
  recordId: RecordId;
  recordRelationId: RelationId;
  now: Date;
}

/** Atomically captures an Idea and its first immutable activity record. */
export class CaptureIdeaService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async capture(command: CaptureIdeaCommand): Promise<void> {
    const idea = Idea.create({ id: command.ideaId, content: command.content, now: command.now });
    await this.transactionRunner.run(async () => {
      await this.ideas.save(idea);
      await this.records.append(Record.create({
        id: command.recordId,
        kind: IDEA_RECORD_KIND.captured,
        detail: `Captured “${idea.content}”`,
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
