import type { EntityId, IsoTimestamp } from '../domain/ids';
import { Quantity } from '../domain/quantity';
import type { Record as OccurrenceRecord } from '../domain/record';
import type { RecordTimeRange } from '../persistence/recordRepository';
import type { RecordHistoryRepository } from '../persistence/recordRepository';
import type { Relation } from '../domain/relation';
import {
  RESOURCE_USAGE_CORRECTION_RELATION_TYPE,
  RESOURCE_USAGE_PROJECT_RELATION_TYPE,
  RESOURCE_USAGE_RESOURCE_RELATION_TYPE,
  RESOURCE_USAGE_TASK_RELATION_TYPE,
  resourceUsagePayload,
} from '../domain/resourceUsage';
import type { Project } from '../domain/project';
import type { Resource } from '../domain/resource';
import type { Task } from '../domain/task';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { ResourceRepository } from '../persistence/resourceRepository';
import type { TaskRepository } from '../persistence/taskRepository';

/** The immutable Record and semantic links behind one usage occurrence. */
export interface ResourceUsageOccurrenceView {
  recordId: EntityId;
  record: OccurrenceRecord;
  amount: Quantity;
  projectId: EntityId;
  project: Project;
  resourceId: EntityId;
  resource: Resource;
  taskId: EntityId | null;
  task: Task | null;
  projectRelationId: EntityId;
  projectRelation: Relation;
  resourceRelationId: EntityId;
  resourceRelation: Relation;
  taskRelationId: EntityId | null;
  taskRelation: Relation | null;
  correctionRelationId: EntityId | null;
  correctionRelation: Relation | null;
}

/** One original occurrence plus every retained reversal and its exact net amount. */
export interface ResourceUsageHistoryItem {
  original: ResourceUsageOccurrenceView;
  corrections: ResourceUsageOccurrenceView[];
  /** Original amount less the retained correction trail; this is not a balance summary. */
  effectiveAmount: Quantity;
}

export interface ResourceUsageHistoryQuery {
  projectId?: EntityId;
  /** When omitted, Project totals retain both project-only and Task-attributed history. */
  taskId?: EntityId;
  resourceId?: EntityId;
  /** Both occurrence-time bounds are inclusive. */
  occurredAt?: RecordTimeRange;
  /** Offset pagination is applied after semantic filtering in the stable occurrence order. */
  limit?: number;
  offset?: number;
}

export class ResourceUsageHistoryIntegrityError extends Error {
  constructor(readonly recordId: EntityId, detail: string) {
    super(`Resource usage history integrity error for Record ${recordId}: ${detail}`);
    this.name = 'ResourceUsageHistoryIntegrityError';
  }
}

export interface ResourceUsageQueryServicePorts {
  records: RecordHistoryRepository;
  relations: RelationRepository;
  projects: ProjectRepository;
  resources: ResourceRepository;
  tasks: TaskRepository;
}

/**
 * Read-side projection for append-only consumption history. It deliberately
 * does not calculate a Project/Task balance or mutate Records/Relations.
 */
export class ResourceUsageQueryService {
  constructor(private readonly ports: ResourceUsageQueryServicePorts) {}

  async listHistory(query: ResourceUsageHistoryQuery = {}): Promise<ResourceUsageHistoryItem[]> {
    assertQuery(query);
    const records = await this.listAllRecords();
    const occurrences = await Promise.all(records
      .filter((record) => record.recordType === 'resource_usage' || record.recordType === 'correction')
      .map(async (record) => this.toOccurrence(record)));
    const originals = occurrences.filter((entry) => entry.record.recordType === 'resource_usage');
    const corrections = occurrences.filter((entry) => entry.record.recordType === 'correction');
    const byOriginalId = new Map(originals.map((entry) => [entry.recordId, entry]));
    const correctionsByOriginal = new Map<EntityId, ResourceUsageOccurrenceView[]>();

    for (const correction of corrections) {
      const targetId = correction.correctionRelation?.targetId;
      if (targetId === undefined) throw new ResourceUsageHistoryIntegrityError(correction.recordId, 'correction has no target relation');
      const original = byOriginalId.get(targetId);
      if (original === undefined) {
        throw new ResourceUsageHistoryIntegrityError(correction.recordId, `correction target ${targetId} is not a resource usage Record`);
      }
      if (correction.amount.unit !== original.amount.unit || correction.projectId !== original.projectId ||
        correction.resourceId !== original.resourceId || correction.taskId !== original.taskId) {
        throw new ResourceUsageHistoryIntegrityError(correction.recordId, 'correction does not preserve its original Project, Resource, Task, and unit');
      }
      const trail = correctionsByOriginal.get(targetId) ?? [];
      trail.push(correction);
      correctionsByOriginal.set(targetId, trail);
    }

    const filtered = originals
      .filter((entry) => query.projectId === undefined || entry.projectId === query.projectId)
      .filter((entry) => query.taskId === undefined || entry.taskId === query.taskId)
      .filter((entry) => query.resourceId === undefined || entry.resourceId === query.resourceId)
      .filter((entry) => inRange(entry.record.occurredAt, query.occurredAt))
      .sort(compareOccurrences)
      .map((original) => {
        const trail = (correctionsByOriginal.get(original.recordId) ?? []).sort(compareOccurrences);
        if (trail.length > 1) throw new ResourceUsageHistoryIntegrityError(original.recordId, 'original has more than one correction');
        const effectiveAmount = trail.reduce((amount, correction) => amount.subtract(correction.amount), original.amount);
        if (effectiveAmount.isNegative()) throw new ResourceUsageHistoryIntegrityError(original.recordId, 'correction trail exceeds the original amount');
        return { original, corrections: trail, effectiveAmount };
      });
    return filtered.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 100));
  }

  private async toOccurrence(record: OccurrenceRecord): Promise<ResourceUsageOccurrenceView> {
    let payload: ReturnType<typeof resourceUsagePayload>;
    try { payload = resourceUsagePayload(record.payload); } catch (error) {
      throw new ResourceUsageHistoryIntegrityError(record.id, error instanceof Error ? error.message : 'invalid payload');
    }
    const expectedType = payload.correctsRecordId === undefined ? 'resource_usage' : 'correction';
    if (record.recordType !== expectedType) {
      throw new ResourceUsageHistoryIntegrityError(record.id, `record type ${record.recordType} does not match usage payload`);
    }
    const relations = await this.listAllRelations(record.id);
    const projectRelation = oneRelation(record.id, relations, RESOURCE_USAGE_PROJECT_RELATION_TYPE, 'project', payload.projectId, 'Project');
    const resourceRelation = oneRelation(record.id, relations, RESOURCE_USAGE_RESOURCE_RELATION_TYPE, 'resource', payload.resourceId, 'Resource');
    const taskRelation = payload.taskId === undefined ? noRelation(record.id, relations, RESOURCE_USAGE_TASK_RELATION_TYPE, 'task', 'Task')
      : oneRelation(record.id, relations, RESOURCE_USAGE_TASK_RELATION_TYPE, 'task', payload.taskId, 'Task');
    const correctionRelation = payload.correctsRecordId === undefined ? noRelation(record.id, relations, RESOURCE_USAGE_CORRECTION_RELATION_TYPE, 'record', 'correction')
      : oneRelation(record.id, relations, RESOURCE_USAGE_CORRECTION_RELATION_TYPE, 'record', payload.correctsRecordId, 'correction');
    const [project, resource, task] = await Promise.all([
      this.ports.projects.getById(payload.projectId), this.ports.resources.getById(payload.resourceId),
      payload.taskId === undefined ? Promise.resolve(null) : this.ports.tasks.getById(payload.taskId),
    ]);
    if (project === null) throw new ResourceUsageHistoryIntegrityError(record.id, `Project ${payload.projectId} is missing`);
    if (resource === null) throw new ResourceUsageHistoryIntegrityError(record.id, `Resource ${payload.resourceId} is missing`);
    if (payload.taskId !== undefined && task === null) throw new ResourceUsageHistoryIntegrityError(record.id, `Task ${payload.taskId} is missing`);
    if (resource.unit === null || resource.unit !== payload.unit) {
      throw new ResourceUsageHistoryIntegrityError(record.id, `Resource ${payload.resourceId} unit ${JSON.stringify(resource.unit)} is incompatible with usage unit ${JSON.stringify(payload.unit)}`);
    }
    return {
      recordId: record.id, record, amount: Quantity.of(payload.amount, payload.unit),
      projectId: payload.projectId, project, resourceId: payload.resourceId, resource,
      taskId: payload.taskId ?? null, task, projectRelationId: projectRelation.id, projectRelation,
      resourceRelationId: resourceRelation.id, resourceRelation,
      taskRelationId: taskRelation?.id ?? null, taskRelation, correctionRelationId: correctionRelation?.id ?? null, correctionRelation,
    };
  }

  private async listAllRecords(): Promise<OccurrenceRecord[]> {
    const all: OccurrenceRecord[] = [];
    for (let offset = 0;; offset += 100) {
      const page = await this.ports.records.list({ status: 'all', limit: 100, offset });
      all.push(...page);
      if (page.length < 100) return all;
    }
  }

  private async listAllRelations(recordId: EntityId): Promise<Relation[]> {
    const all: Relation[] = [];
    for (let offset = 0;; offset += 100) {
      const page = await this.ports.relations.listHistory({ source: { type: 'record', id: recordId }, limit: 100, offset });
      all.push(...page);
      if (page.length < 100) return all;
    }
  }
}

function oneRelation(recordId: EntityId, relations: Relation[], relationType: string, targetType: Relation['targetType'], targetId: EntityId, label: string): Relation {
  const candidates = relations.filter((relation) => relation.relationType === relationType && relation.targetType === targetType);
  if (candidates.length !== 1 || candidates[0]?.targetId !== targetId || candidates[0]?.endedAt !== null) {
    throw new ResourceUsageHistoryIntegrityError(recordId, `${label} relation must be one active ${relationType} link to ${targetType} ${targetId}`);
  }
  return candidates[0];
}

function noRelation(recordId: EntityId, relations: Relation[], relationType: string, targetType: Relation['targetType'], label: string): null {
  if (relations.some((relation) => relation.relationType === relationType && relation.targetType === targetType)) {
    throw new ResourceUsageHistoryIntegrityError(recordId, `project-only usage must not have a ${label} relation`);
  }
  return null;
}

function compareOccurrences(left: ResourceUsageOccurrenceView, right: ResourceUsageOccurrenceView): number {
  const occurred = left.record.occurredAt.localeCompare(right.record.occurredAt);
  if (occurred !== 0) return occurred;
  const recorded = left.record.recordedAt.localeCompare(right.record.recordedAt);
  return recorded === 0 ? left.recordId.localeCompare(right.recordId) : recorded;
}

function inRange(value: IsoTimestamp, range: RecordTimeRange | undefined): boolean {
  return (range?.start === undefined || value >= range.start) &&
    (range?.end === undefined || value <= range.end);
}

function assertQuery(query: ResourceUsageHistoryQuery): void {
  for (const [name, value] of Object.entries({ projectId: query.projectId, taskId: query.taskId, resourceId: query.resourceId })) {
    if (value !== undefined && value.trim().length === 0) throw new Error(`Resource usage query ${name} must not be blank`);
  }
  if (query.occurredAt !== undefined) {
    for (const [name, value] of Object.entries(query.occurredAt)) {
      if (value !== undefined && (value.trim().length === 0 || Number.isNaN(Date.parse(value)))) throw new Error(`Resource usage query occurredAt.${name} must be a valid ISO 8601 timestamp`);
    }
    if (query.occurredAt.start !== undefined && query.occurredAt.end !== undefined && Date.parse(query.occurredAt.start) > Date.parse(query.occurredAt.end)) throw new Error('Resource usage query occurredAt start must not be after end');
  }
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Resource usage query limit must be a positive integer');
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Resource usage query offset must be a non-negative integer');
}
