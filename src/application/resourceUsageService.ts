import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  createResourceUsageRecord,
  createResourceUsageReversal,
  resourceUsagePayload,
  validateActiveResourceUsageReferences,
  validateResourceUsageEntry,
} from '../domain/resourceUsage';
import { Decimal } from '../domain/decimal';
import type { ResourceUsageEntry } from '../domain/resourceUsage';
import { PROJECT_BUDGET_RELATION_TYPE, projectBudgetMetadata } from '../domain/projectBudget';
import { TASK_PROJECT_MEMBERSHIP_RELATION_TYPE } from './taskAllocationService';
import { TASK_ALLOCATION_RELATION_TYPE, taskAllocationMetadata } from '../domain/taskAllocation';
import type { JsonValue } from '../domain/json';
import type { Relation } from '../domain/relation';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { RecordHistoryRepository } from '../persistence/recordRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { ResourceRepository } from '../persistence/resourceRepository';
import type { TaskRepository } from '../persistence/taskRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';

export class ResourceUsageNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Resource usage Record ${id} not found`);
    this.name = 'ResourceUsageNotFoundError';
  }
}

export class ResourceUsageIdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Resource usage idempotency key ${JSON.stringify(key)} was already used for a different command`);
    this.name = 'ResourceUsageIdempotencyConflictError';
  }
}

export interface RecordResourceUsageCommand {
  description: string;
  actor: string;
  projectId: EntityId;
  resourceId: EntityId;
  amount: string;
  unit: string;
  occurredAt: IsoTimestamp;
  taskId?: EntityId;
  title?: string;
  executionContext?: JsonValue;
  plannedContext?: { projectBudgetContext?: string; taskAllocationContext?: string };
  /** Required durable request identity; retrying it returns the original write. */
  idempotencyKey: string;
}

export interface CorrectResourceUsageCommand {
  targetRecordId: EntityId;
  description: string;
  actor: string;
  occurredAt: IsoTimestamp;
  /** Omit to reverse the full original amount. */
  amount?: string;
  title?: string;
  executionContext?: JsonValue;
  idempotencyKey: string;
}

export interface ResourceUsageResult {
  recordId: EntityId;
  projectRelationId: EntityId;
  resourceRelationId: EntityId;
  taskRelationId: EntityId | null;
  correctionRelationId: EntityId | null;
  idempotent: boolean;
}

export interface ResourceUsageServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  projects: (context: TContext) => ProjectRepository;
  resources: (context: TContext) => ResourceRepository;
  tasks: (context: TContext) => TaskRepository;
  records: (context: TContext) => RecordHistoryRepository;
  relations: (context: TContext) => RelationRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Command boundary for actual consumption. It only appends occurrence Records
 * and their semantic links. Planned budget/allocation relations are inspected
 * for named contexts but are never created, ended, or otherwise mutated here.
 */
export class ResourceUsageService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: ResourceUsageServicePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async record(command: RecordResourceUsageCommand): Promise<ResourceUsageResult> {
    requireKey(command.idempotencyKey);
    return this.ports.unitOfWork.run(async (context) => {
      const existing = await this.findByKey(context, command.idempotencyKey);
      if (existing !== null) {
        const payload = resourceUsagePayload(existing.payload);
        if (existing.recordType !== 'resource_usage' || !sameUsageCommand(payload, command)) {
          throw new ResourceUsageIdempotencyConflictError(command.idempotencyKey);
        }
        return this.resultForExisting(context, existing.id, true);
      }
      const now = this.clock.now();
      const entry = createResourceUsageRecord({ ...command, recordedAt: now }, this.deps(now));
      await this.validate(context, entry);
      await this.append(context, entry);
      return result(entry, false);
    });
  }

  async correct(command: CorrectResourceUsageCommand): Promise<ResourceUsageResult> {
    requireKey(command.idempotencyKey);
    return this.ports.unitOfWork.run(async (context) => {
      const existing = await this.findByKey(context, command.idempotencyKey);
      if (existing !== null) {
        const payload = resourceUsagePayload(existing.payload);
        if (existing.recordType !== 'correction' || payload.correctsRecordId !== command.targetRecordId ||
          (command.amount !== undefined && payload.amount !== canonical(command.amount))) {
          throw new ResourceUsageIdempotencyConflictError(command.idempotencyKey);
        }
        return this.resultForExisting(context, existing.id, true);
      }
      const target = await this.readEntry(context, command.targetRecordId);
      if (target.record.recordType !== 'resource_usage') throw new ResourceUsageNotFoundError(command.targetRecordId);
      const now = this.clock.now();
      const entry = createResourceUsageReversal({ ...command, corrects: target, recordedAt: now }, this.deps(now));
      await this.validate(context, entry);
      await this.ensureNotCorrected(context, target.record.id);
      await this.append(context, entry);
      return result(entry, false);
    });
  }

  private deps(now: IsoTimestamp) {
    return {
      record: { id: this.ids.newId(), now },
      projectRelation: { id: this.ids.newId(), now }, resourceRelation: { id: this.ids.newId(), now },
      taskRelation: { id: this.ids.newId(), now }, correctionRelation: { id: this.ids.newId(), now },
    };
  }

  private async validate(context: TContext, entry: ResourceUsageEntry): Promise<void> {
    const resource = await this.ports.resources(context).getById(resourceUsagePayload(entry.record.payload).resourceId);
    if (resource === null || resource.archivedAt !== null) {
      // Keep shape validation local; the lookup below emits the uniform logical
      // reference error without pretending a missing resource has a unit.
      validateResourceUsageEntry(entry);
      await validateActiveResourceUsageReferences(entry, undefined, this.lookup(context));
      return;
    }
    await validateActiveResourceUsageReferences(entry, resource, this.lookup(context));
  }

  private lookup(context: TContext) {
    return {
      isProjectActive: async (id: EntityId) => (await this.ports.projects(context).getById(id))?.archivedAt === null,
      isResourceActive: async (id: EntityId) => (await this.ports.resources(context).getById(id))?.archivedAt === null,
      isTaskActive: async (id: EntityId) => (await this.ports.tasks(context).getById(id))?.archivedAt === null,
      hasActiveTaskProjectMembership: async (taskId: EntityId, projectId: EntityId) =>
        (await this.ports.relations(context).findActiveByIdentity('task', taskId, TASK_PROJECT_MEMBERSHIP_RELATION_TYPE, 'project', projectId)) !== null,
      hasActiveProjectBudget: async (projectId: EntityId, resourceId: EntityId, projectContext: string) =>
        this.hasBudget(context, projectId, resourceId, projectContext),
      hasActiveTaskAllocation: async (taskId: EntityId, projectId: EntityId, resourceId: EntityId, projectContext: string) =>
        this.hasAllocation(context, taskId, projectId, resourceId, projectContext),
    };
  }

  private async hasBudget(context: TContext, projectId: EntityId, resourceId: EntityId, projectContext: string): Promise<boolean> {
    const relations = await this.ports.relations(context).listCurrent({ source: { type: 'project', id: projectId }, target: { type: 'resource', id: resourceId }, relationType: PROJECT_BUDGET_RELATION_TYPE, limit: 100 });
    return relations.some((relation) => { try { return projectBudgetMetadata(relation.metadata).projectContext === projectContext; } catch { return false; } });
  }

  private async hasAllocation(context: TContext, taskId: EntityId, projectId: EntityId, resourceId: EntityId, projectContext: string): Promise<boolean> {
    const relations = await this.ports.relations(context).listCurrent({ source: { type: 'task', id: taskId }, target: { type: 'resource', id: resourceId }, relationType: TASK_ALLOCATION_RELATION_TYPE, limit: 100 });
    return relations.some((relation) => { try { const metadata = taskAllocationMetadata(relation.metadata); return metadata.fundingProjectId === projectId && metadata.projectContext === projectContext; } catch { return false; } });
  }

  private async append(context: TContext, entry: ResourceUsageEntry): Promise<void> {
    await this.ports.records(context).add(entry.record);
    const relations = this.ports.relations(context);
    await relations.add(entry.projectRelation);
    await relations.add(entry.resourceRelation);
    if (entry.taskRelation !== null) await relations.add(entry.taskRelation);
    if (entry.correctionRelation !== null) await relations.add(entry.correctionRelation);
  }

  private async findByKey(context: TContext, key: string) {
    const records = this.ports.records(context);
    for (let offset = 0; ; offset += 100) {
      const page = await records.list({ status: 'all', limit: 100, offset });
      const found = page.find((record) => {
        try { return resourceUsagePayload(record.payload).idempotencyKey === key; } catch { return false; }
      });
      if (found !== undefined) return found;
      if (page.length < 100) return null;
    }
  }

  private async readEntry(context: TContext, recordId: EntityId): Promise<ResourceUsageEntry> {
    const record = await this.ports.records(context).getById(recordId);
    if (record === null) throw new ResourceUsageNotFoundError(recordId);
    const payload = resourceUsagePayload(record.payload);
    const relations = this.ports.relations(context);
    const projectRelation = await requiredRelation(relations, recordId, 'belongs_to', 'project', payload.projectId);
    const resourceRelation = await requiredRelation(relations, recordId, 'consumes', 'resource', payload.resourceId);
    const taskRelation = payload.taskId === undefined ? null : await requiredRelation(relations, recordId, 'belongs_to', 'task', payload.taskId);
    const correctionRelation = payload.correctsRecordId === undefined ? null : await requiredRelation(relations, recordId, 'related_to', 'record', payload.correctsRecordId);
    return { record, projectRelation, resourceRelation, taskRelation, correctionRelation };
  }

  private async ensureNotCorrected(context: TContext, recordId: EntityId): Promise<void> {
    const links = await this.ports.relations(context).listCurrent({ target: { type: 'record', id: recordId }, relationType: 'related_to', limit: 100 });
    if (links.some((link) => link.sourceType === 'record' && link.metadata !== null && typeof link.metadata === 'object' && !Array.isArray(link.metadata) && link.metadata.kind === 'resource_usage_correction')) {
      throw new Error(`Resource usage Record ${recordId} already has a correction`);
    }
  }

  private async resultForExisting(context: TContext, recordId: EntityId, idempotent: boolean): Promise<ResourceUsageResult> {
    return result(await this.readEntry(context, recordId), idempotent);
  }
}

async function requiredRelation(repository: RelationRepository, sourceId: EntityId, relationType: string, targetType: 'project' | 'resource' | 'task' | 'record', targetId: EntityId): Promise<Relation> {
  const relation = await repository.findActiveByIdentity('record', sourceId, relationType, targetType, targetId);
  if (relation === null) throw new ResourceUsageNotFoundError(sourceId);
  return relation;
}

function result(entry: ResourceUsageEntry, idempotent: boolean): ResourceUsageResult {
  return { recordId: entry.record.id, projectRelationId: entry.projectRelation.id, resourceRelationId: entry.resourceRelation.id, taskRelationId: entry.taskRelation?.id ?? null, correctionRelationId: entry.correctionRelation?.id ?? null, idempotent };
}

function requireKey(key: string): void {
  if (key.trim().length === 0) throw new Error('Resource usage idempotencyKey must not be blank');
}

function canonical(amount: string): string {
  return Decimal.parse(amount).toString();
}

function sameUsageCommand(payload: ReturnType<typeof resourceUsagePayload>, command: RecordResourceUsageCommand): boolean {
  return payload.projectId === command.projectId && payload.resourceId === command.resourceId && payload.taskId === command.taskId && payload.amount === canonical(command.amount) && payload.unit === command.unit;
}
