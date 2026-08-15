import {
  buildMilestoneChangePayload,
  milestoneChangePayloadToJson,
} from '../domain/milestoneProvenance';
import type {
  MilestoneChangeAction,
  MilestoneChangeFieldMap,
} from '../domain/milestoneProvenance';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import { PROVENANCE_RECORD_TYPE } from '../domain/mutationProvenance';
import { createRecord } from '../domain/record';
import type { RecordRepository } from '../persistence/recordRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';

/** One audited Milestone change, supplied by the owning mutation service. */
export interface MilestoneMutationNotice {
  action: MilestoneChangeAction;
  milestoneId: EntityId;
  pursuitRelationId: EntityId;
  projectId: EntityId;
  rootGoalId: EntityId;
  goalIds?: readonly EntityId[];
  actor: string;
  occurredAt: IsoTimestamp;
  before?: MilestoneChangeFieldMap | null;
  after?: MilestoneChangeFieldMap | null;
}

/**
 * Required atomic audit seam for Milestone mutations. `append` receives the
 * already-open unit-of-work context, so a Milestone/assignment write and its
 * audit Record commit or roll back together.
 */
export interface MilestoneProvenancePort<TContext> {
  append(context: TContext, notice: MilestoneMutationNotice): Promise<void>;
}

/**
 * Concrete Record-backed implementation of the MilestoneService provenance
 * seam, mirroring `RecordRelationProvenancePort`.
 */
export class RecordMilestoneProvenancePort<TContext>
  implements MilestoneProvenancePort<TContext>
{
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(
    private readonly ports: {
      records: (context: TContext) => RecordRepository;
      clock?: Clock;
      ids?: IdGenerator;
    },
  ) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async append(
    context: TContext,
    notice: MilestoneMutationNotice,
  ): Promise<void> {
    const payload = buildMilestoneChangePayload(notice);
    const recordedAt = this.clock.now();
    await this.ports.records(context).add(
      createRecord(
        {
          description: `${payload.action} ${payload.milestoneId}`,
          recordType: PROVENANCE_RECORD_TYPE,
          occurredAt: payload.occurredAt,
          recordedAt,
          actor: payload.actor,
          payload: milestoneChangePayloadToJson(payload),
        },
        { id: this.ids.newId(), now: recordedAt },
      ),
    );
  }
}
