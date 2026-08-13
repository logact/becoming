import { buildRelationChangePayload, relationChangePayloadToJson } from '../domain/relationProvenance';
import { PROVENANCE_RECORD_TYPE } from '../domain/mutationProvenance';
import { createRecord } from '../domain/record';
import type { RecordRepository } from '../persistence/recordRepository';
import type { Clock, IdGenerator } from './recordService';
import { systemClock, uuidGenerator } from './recordService';
import type { DecompositionMutationNotice, DecompositionProvenancePort } from './decompositionService';

/** Record-backed audit including the guidance version used to approve a create. */
export class RecordDecompositionProvenancePort<TContext> implements DecompositionProvenancePort<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  constructor(private readonly ports: { records: (context: TContext) => RecordRepository; clock?: Clock; ids?: IdGenerator }) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }
  async append(context: TContext, notice: DecompositionMutationNotice): Promise<void> {
    const action = notice.kind === 'created' ? 'relation_created' : 'relation_ended';
    const relation = relationChangePayloadToJson(buildRelationChangePayload({ action, relation: notice.relation, actor: notice.actor, occurredAt: notice.occurredAt }, {
      allowlist: ['schema_version', 'project_id'], redacted: [],
    })) as Record<string, import('../domain/json').JsonValue>;
    const recordedAt = this.clock.now();
    await this.ports.records(context).add(createRecord({
      description: `${action} ${notice.relation.id}`,
      recordType: PROVENANCE_RECORD_TYPE, occurredAt: notice.occurredAt, recordedAt, actor: notice.actor,
      payload: { ...relation, decomposition: { projectId: notice.projectId, parent: { type: notice.relation.sourceType, id: notice.relation.sourceId }, child: { type: notice.relation.targetType, id: notice.relation.targetId }, workflow: notice.workflow === null ? null : { workflowId: notice.workflow.workflowId, version: notice.workflow.version } } },
    }, { id: this.ids.newId(), now: recordedAt }));
  }
}
