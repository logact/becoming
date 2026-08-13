import type { EntityId, IsoTimestamp } from '../domain/ids';
import { archiveRecord, createRecord } from '../domain/record';
import type { Record } from '../domain/record';
import {
  buildRecordCorrectionPayload,
} from '../domain/recordCorrection';
import type { RecordCorrectionChanges } from '../domain/recordCorrection';
import { createRelation } from '../domain/relation';
import type { Relation } from '../domain/relation';
import type { RelationRepository } from '../persistence/relationRepository';
import type { RecordHistoryRepository } from '../persistence/recordRepository';
import type { RecordRepository } from '../persistence/recordRepository';
import { MutationProvenanceService } from './mutationProvenanceService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

/** Metadata that makes a general semantic Relation specifically a correction link. */
export const RECORD_CORRECTION_RELATION_METADATA = Object.freeze({
  semantic: 'record_correction',
});

export class RecordHistoryNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Record ${id} not found`);
    this.name = 'RecordHistoryNotFoundError';
  }
}

export class RecordCorrectionPersistenceError extends Error {
  readonly cause?: unknown;
  constructor(action: 'record' | 'relation', cause: unknown) {
    super(`Record correction ${action} write failed and was rolled back`);
    this.name = 'RecordCorrectionPersistenceError';
    this.cause = cause;
  }
}

export interface CorrectRecordCommand {
  targetRecordId: EntityId;
  actor: string;
  changes: RecordCorrectionChanges;
  occurredAt?: IsoTimestamp;
}

export interface ArchiveRecordCommand {
  recordId: EntityId;
  /** Identifies the archive request's actor for append-only provenance. */
  actor?: string;
  occurredAt?: IsoTimestamp;
  archivedAt?: IsoTimestamp;
}

export interface RecordHistoryServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  records: (context: TContext) => RecordHistoryRepository;
  /** Optional non-transactional read path for archival preconditions. */
  readRecords?: RecordHistoryRepository;
  relations: (context: TContext) => RelationRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Application boundary for append-only Record corrections and archival.
 *
 * A correction creates an independent `records` row and a `related_to`
 * semantic Relation from that correction to the original. Both writes happen
 * inside one unit of work. There is no delete operation. Archive is
 * idempotent: the first `archived_at` is retained on retries.
 */
export class RecordHistoryService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly provenance: MutationProvenanceService<TContext>;

  constructor(private readonly ports: RecordHistoryServicePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.provenance = new MutationProvenanceService({
      unitOfWork: ports.unitOfWork,
      records: (context) => ports.records(context) as RecordRepository,
      clock: this.clock,
      ids: this.ids,
    });
  }

  async correct(command: CorrectRecordCommand): Promise<{ correction: Record; relation: Relation }> {
    if (command.actor.trim().length === 0) {
      throw new Error('Record correction actor must not be blank');
    }
    return this.ports.unitOfWork.run(async (context) => {
      const records = this.ports.records(context);
      const target = await records.getById(command.targetRecordId);
      if (target === null) {
        throw new RecordHistoryNotFoundError(command.targetRecordId);
      }
      const eventTime = command.occurredAt ?? this.clock.now();
      const correction = createRecord(
        {
          description: `Correction for Record ${target.id}`,
          recordType: 'correction',
          occurredAt: eventTime,
          recordedAt: this.clock.now(),
          actor: command.actor,
          payload: buildRecordCorrectionPayload(target, command.changes),
        },
        { id: this.ids.newId(), now: this.clock.now() },
      );
      try {
        await records.add(correction);
      } catch (error) {
        throw new RecordCorrectionPersistenceError('record', error);
      }
      const relation = createRelation(
        {
          sourceType: 'record',
          sourceId: correction.id,
          relationType: 'related_to',
          targetType: 'record',
          targetId: target.id,
          metadata: RECORD_CORRECTION_RELATION_METADATA,
        },
        { id: this.ids.newId(), now: eventTime },
      );
      try {
        await this.ports.relations(context).add(relation);
      } catch (error) {
        throw new RecordCorrectionPersistenceError('relation', error);
      }
      return { correction, relation };
    });
  }

  async archive(command: ArchiveRecordCommand): Promise<Record> {
    const target = await this.readRecord(command.recordId);
    if (target === null) throw new RecordHistoryNotFoundError(command.recordId);
    const archived = archiveRecord(target, command.archivedAt ?? this.clock.now());
    // Retrying a successful archive is explicitly idempotent and does not
    // append another success Record.
    if (archived === target) return target;
    return this.provenance.mutateWithProvenance({
      entityType: 'record', entityId: command.recordId, action: 'archive',
      actor: command.actor ?? 'system', occurredAt: command.occurredAt,
      before: snapshot(target), after: snapshot(archived),
      mutate: async (context) => {
        const records = this.ports.records(context);
        await records.save(archived);
        return archived;
      },
    });
  }

  private async readRecord(id: EntityId): Promise<Record | null> {
    if (this.ports.readRecords !== undefined) return this.ports.readRecords.getById(id);
    return this.ports.unitOfWork.run((context) => this.ports.records(context).getById(id));
  }

  /**
   * Return the original occurrence followed by its correction Records. The
   * caller must make the archive-visibility decision explicitly; callers
   * authorized to inspect history pass `includeArchived: true`.
   */
  async getHistory(
    recordId: EntityId,
    options: { includeArchived: boolean },
  ): Promise<Record[]> {
    return this.ports.unitOfWork.run(async (context) => {
      const records = this.ports.records(context);
      const original = await records.getById(recordId);
      if (original === null) {
        throw new RecordHistoryNotFoundError(recordId);
      }
      const relations = await this.ports.relations(context).listByTarget('record', recordId);
      const corrections: Record[] = [];
      for (const relation of relations) {
        if (
          relation.sourceType !== 'record' ||
          relation.relationType !== 'related_to' ||
          relation.metadata === null ||
          typeof relation.metadata !== 'object' ||
          Array.isArray(relation.metadata) ||
          relation.metadata.semantic !== 'record_correction'
        ) {
          continue;
        }
        const correction = await records.getById(relation.sourceId);
        if (correction !== null && correction.recordType === 'correction') {
          corrections.push(correction);
        }
      }
      const history = [original, ...corrections];
      return options.includeArchived
        ? history
        : history.filter((record) => record.archivedAt === null);
    });
  }
}

function snapshot(record: Record): { [field: string]: unknown } {
  return { ...record };
}
