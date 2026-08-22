import type { IdeaRepository } from '../../domain/idea/repository/IdeaRepository';
import { Note } from '../../domain/note/Note';
import type { NoteRepository } from '../../domain/note/repository/NoteRepository';
import { Record } from '../../domain/record/Record';
import type { RecordRepository } from '../../domain/record/repository/RecordRepository';
import { Relation } from '../../domain/relation/Relation';
import type { RelationRepository } from '../../domain/relation/repository/RelationRepository';
import { DomainError } from '../../domain/shared/errors';
import type {
  IdeaId,
  NoteId,
  RecordId,
  RelationId,
} from '../../domain/shared/ids';
import type { TransactionRunner } from '../shared/TransactionRunner';
import { NOTE_RECORD_KIND } from './noteRecordKinds';

export interface ExtractNoteFromIdeaCommand {
  ideaId: IdeaId;
  noteId: NoteId;
  content: string;
  derivedRelationId: RelationId;
  recordId: RecordId;
  ideaRecordRelationId: RelationId;
  noteRecordRelationId: RelationId;
  now: Date;
}

/** Atomically extracts a labeled Note from an existing, non-archived Idea. */
export class ExtractNoteFromIdeaService {
  constructor(
    private readonly ideas: IdeaRepository,
    private readonly notes: NoteRepository,
    private readonly records: RecordRepository,
    private readonly relations: RelationRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  extract(command: ExtractNoteFromIdeaCommand): Promise<void> {
    return this.transactionRunner.run(async () => {
      const idea = await this.ideas.findById(command.ideaId);
      if (idea === null) throw new DomainError(`Unknown idea: ${command.ideaId}`);
      if (idea.archived) throw new DomainError(`Cannot derive from archived idea: ${command.ideaId}`);

      const note = Note.create({
        id: command.noteId,
        content: command.content,
        now: command.now,
      });
      for (const labelId of idea.labelIds) note.addLabel(labelId);

      await this.notes.save(note);
      await this.relations.save(Relation.derivedFromIdea({
        id: command.derivedRelationId,
        sourceType: 'note',
        sourceId: command.noteId,
        ideaId: command.ideaId,
        now: command.now,
      }));

      if (idea.status !== 'handled') {
        idea.handle(command.now);
        await this.ideas.save(idea);
      }

      await this.records.append(Record.create({
        id: command.recordId,
        kind: NOTE_RECORD_KIND.derivedFromIdea,
        detail: `Extracted Note “${note.content}” from Idea`,
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
        id: command.noteRecordRelationId,
        sourceType: 'record',
        sourceId: command.recordId,
        targetType: 'note',
        targetId: command.noteId,
        kind: 'logs',
        now: command.now,
      }));
    });
  }
}
