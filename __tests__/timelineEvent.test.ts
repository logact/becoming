import {
  adaptRecordToTimelineEvent,
  compareTimelineEvents,
  deduplicateTimelineEvents,
  includeTimelineEvent,
  timelineEventConcernsEntity,
} from '../src/domain/timelineEvent';
import { resolveTimelineEntity, TimelineEntityNotFoundError } from '../src/application/timelineEntityResolver';
import { createRecord } from '../src/domain/record';

const occurredAt = '2026-08-13T08:00:00.000Z';
const recordedAt = '2026-08-13T08:01:00.000Z';
const record = (id: string, recordType: string, payload?: unknown) => createRecord(
  { description: `${recordType} event`, recordType, occurredAt, recordedAt, actor: 'agent:test', payload },
  { id, now: recordedAt, supportedRecordTypes: ['action', 'mutation', 'state_transition', 'correction', 'mystery'] },
);

describe('unified timeline event contract', () => {
  it('adapts a core mutation with its affected entity and category payload', () => {
    const event = adaptRecordToTimelineEvent(record('record-1', 'mutation', {
      entityType: 'goal', entityId: 'goal-1', action: 'update', actor: 'agent:test', occurredAt,
      before: { title: 'before' }, after: { title: 'after' },
    }));
    expect(event.category).toBe('mutation');
    expect(event.affectedEntity).toEqual({ type: 'goal', id: 'goal-1' });
    expect(event.payload).toMatchObject({ kind: 'mutation', action: 'update' });
  });

  it('maps relation and lineage provenance before generic mutation provenance', () => {
    const relation = adaptRecordToTimelineEvent(record('record-2', 'mutation', {
      action: 'relation_created', relationId: 'rel-1', sourceType: 'task', sourceId: 'task-1',
      relationType: 'belongs_to', targetType: 'project', targetId: 'project-1', metadata: null,
      actor: 'agent:test', occurredAt, created_at: occurredAt,
    }));
    const lineage = adaptRecordToTimelineEvent(record('record-3', 'mutation', {
      action: 'relation_created', relationId: 'rel-2', sourceType: 'idea', sourceId: 'idea-1',
      relationType: 'origin_of', targetType: 'goal', targetId: 'goal-1', metadata: null,
      actor: 'agent:test', occurredAt, created_at: occurredAt,
    }));
    expect(relation.category).toBe('relation');
    expect(lineage.category).toBe('lineage');
    expect(timelineEventConcernsEntity(relation, { type: 'task', id: 'task-1' })).toBe(true);
    expect(timelineEventConcernsEntity(relation, { type: 'project', id: 'project-1' })).toBe(true);
  });

  it('maps lifecycle and correction Records with their navigable identities', () => {
    const lifecycle = adaptRecordToTimelineEvent(record('record-4', 'state_transition', {
      schemaVersion: 1, projectId: 'project-1', entityType: 'task', entityId: 'task-1', labelId: 'label-1',
      fromProjectStateId: 'state-1', toProjectStateId: 'state-2', projectTransitionId: 'transition-1',
      actor: 'agent:test', occurredAt, snapshot: {}, evaluation: {},
    }));
    const correction = adaptRecordToTimelineEvent(record('record-5', 'correction', {
      targetRecordId: 'record-1', changes: { description: { before: 'a', after: 'b' } },
    }));
    expect(lifecycle.category).toBe('lifecycle');
    expect(timelineEventConcernsEntity(lifecycle, { type: 'project', id: 'project-1' })).toBe(true);
    expect(correction.category).toBe('correction');
    expect(correction.affectedEntity).toEqual({ type: 'record', id: 'record-1' });
  });

  it('preserves malformed and unknown categories as inspectable occurrence fallback', () => {
    const malformed = adaptRecordToTimelineEvent(record('record-6', 'mutation', { action: 'update' }));
    const unknown = adaptRecordToTimelineEvent(record('record-7', 'mystery', { source: 'import' }));
    expect(malformed.payload).toMatchObject({ kind: 'occurrence', fallbackReason: 'malformed_payload' });
    expect(unknown.payload).toMatchObject({ kind: 'occurrence', fallbackReason: 'unknown_record_type' });
  });

  it('includes direct, affected, and either endpoint paths while deduplicating Record IDs', () => {
    const event = adaptRecordToTimelineEvent(record('record-8', 'mutation', {
      action: 'relation_created', relationId: 'rel-3', sourceType: 'goal', sourceId: 'goal-1',
      relationType: 'belongs_to', targetType: 'project', targetId: 'project-1', metadata: null,
      actor: 'agent:test', occurredAt, created_at: occurredAt,
    }));
    const duplicate = { ...event, summary: 'duplicate projection' };
    expect(timelineEventConcernsEntity(event, { type: 'record', id: 'record-8' })).toBe(true);
    expect(deduplicateTimelineEvents([duplicate, event])).toHaveLength(1);
  });

  it('uses occurredAt, recordedAt, then immutable Record ID for total order and explicit archives', () => {
    const a = adaptRecordToTimelineEvent(record('a', 'action'));
    const b = adaptRecordToTimelineEvent(record('b', 'action'));
    const archived = { ...a, archivedAt: '2026-08-13T09:00:00.000Z' };
    expect(compareTimelineEvents(a, b)).toBeLessThan(0);
    expect(deduplicateTimelineEvents([b, a]).map(({ recordId }) => recordId)).toEqual(['a', 'b']);
    expect(includeTimelineEvent(archived, 'active')).toBe(false);
    expect(includeTimelineEvent(archived, 'archived')).toBe(true);
    expect(includeTimelineEvent(archived, 'all')).toBe(true);
  });

  it('resolves every supported type only through the logical core lookup', async () => {
    const seen: string[] = [];
    const lookup = { exists: async (type: string, id: string) => { seen.push(`${type}:${id}`); return type !== 'idea'; } };
    for (const type of ['task', 'goal', 'project', 'philosophy', 'workflow', 'resource', 'record']) {
      await expect(resolveTimelineEntity(lookup, { type, id: `${type}-1` })).resolves.toEqual({ type, id: `${type}-1` });
    }
    await expect(resolveTimelineEntity(lookup, { type: 'idea', id: 'idea-1' })).rejects.toBeInstanceOf(TimelineEntityNotFoundError);
    await expect(resolveTimelineEntity(lookup, { type: 'nope', id: 'x' })).rejects.toThrow(/core entity type/);
    expect(seen).toContain('record:record-1');
  });
});
