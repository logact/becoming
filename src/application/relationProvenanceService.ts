import {
  buildRelationChangePayload,
  relationChangePayloadToJson,
} from '../domain/relationProvenance';
import type { RelationMetadataSelectionPolicy } from '../domain/relationProvenance';
import { PROVENANCE_RECORD_TYPE } from '../domain/mutationProvenance';
import { createRecord } from '../domain/record';
import type { RecordRepository } from '../persistence/recordRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { RelationMutationNotice, RelationProvenancePort } from './relationService';

/**
 * Concrete Record-backed implementation of the RelationService provenance
 * seam.  `append` receives the already-open unit-of-work context, therefore
 * a relation write and its audit Record commit or roll back together.
 */
export class RecordRelationProvenancePort<TContext>
  implements RelationProvenancePort<TContext>
{
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(
    private readonly ports: {
      records: (context: TContext) => RecordRepository;
      clock?: Clock;
      ids?: IdGenerator;
      metadataPolicy?: RelationMetadataSelectionPolicy;
    },
  ) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async append(context: TContext, notice: RelationMutationNotice): Promise<void> {
    const action = notice.kind === 'created' ? 'relation_created' : 'relation_ended';
    const payload = buildRelationChangePayload(
      {
        action,
        relation: notice.relation,
        actor: notice.actor,
        occurredAt: notice.occurredAt,
      },
      this.ports.metadataPolicy,
    );
    const recordedAt = this.clock.now();
    await this.ports.records(context).add(
      createRecord(
        {
          description: `${payload.action} ${payload.relationId}`,
          recordType: PROVENANCE_RECORD_TYPE,
          occurredAt: payload.occurredAt,
          recordedAt,
          actor: payload.actor,
          payload: relationChangePayloadToJson(payload),
        },
        { id: this.ids.newId(), now: recordedAt },
      ),
    );
  }
}
