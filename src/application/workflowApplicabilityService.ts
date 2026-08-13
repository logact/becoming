import { isCoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { JsonValue } from '../domain/json';
import type { Relation } from '../domain/relation';
import type { LabelRepository } from '../persistence/labelRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { WorkflowRepository } from '../persistence/workflowRepository';
import type { WorkflowStateRepository } from '../persistence/workflowStateRepository';
import type { CoreEntityLookup } from './coreEntityLookup';
import { RelationEndpointNotFoundError, RelationService } from './relationService';

/** Semantic Relation type for a Project-scoped reusable Workflow selection. */
export const WORKFLOW_APPLICABILITY_RELATION_TYPE = 'workflow_applies_to';

/** Consumers supported by Project-machine initialization in this release. */
export const WORKFLOW_CONSUMER_TYPES = ['project', 'goal', 'task'] as const;
export type WorkflowConsumerType = (typeof WORKFLOW_CONSUMER_TYPES)[number];

/** Metadata owned by a workflow-applicability Relation. */
export interface WorkflowApplicabilityMetadata {
  entityType: WorkflowConsumerType;
  purpose: string;
  labelId: EntityId;
  /** Frozen selection of the target Workflow definition version. */
  workflowVersion: number;
}

export interface CreateWorkflowApplicabilityCommand {
  projectId: EntityId;
  entityType: string;
  purpose: string;
  labelId: EntityId;
  workflowId: EntityId;
  actor: string;
  occurredAt?: IsoTimestamp;
}

export interface ResolveWorkflowApplicabilityQuery {
  projectId: EntityId;
  entityType: string;
  purpose: string;
  labelId: EntityId;
  /** Exact definition version; omit to select the latest compatible version. */
  version?: number;
}

export class WorkflowApplicabilityProjectNotFoundError extends Error {
  constructor(id: EntityId) { super(`Project ${id} not found for workflow applicability`); this.name = 'WorkflowApplicabilityProjectNotFoundError'; }
}
export class WorkflowApplicabilityLabelNotFoundError extends Error {
  constructor(id: EntityId) { super(`Label ${id} not found for workflow applicability`); this.name = 'WorkflowApplicabilityLabelNotFoundError'; }
}
export class WorkflowApplicabilityLabelArchivedError extends Error {
  constructor(id: EntityId) { super(`Label ${id} is archived and cannot initialize a workflow`); this.name = 'WorkflowApplicabilityLabelArchivedError'; }
}
export class WorkflowApplicabilityMissingError extends Error {
  constructor(query: ResolveWorkflowApplicabilityQuery) { super(`No active workflow applicability for ${describe(query)}`); this.name = 'WorkflowApplicabilityMissingError'; }
}
export class WorkflowApplicabilityArchivedError extends Error {
  constructor(readonly relations: readonly Relation[]) { super(`Applicable workflow definition is archived (${relations.map((r) => r.targetId).join(', ')})`); this.name = 'WorkflowApplicabilityArchivedError'; }
}
export class WorkflowApplicabilityIncompatibleError extends Error {
  constructor(readonly relations: readonly Relation[], reason: string) { super(`Applicable workflow is incompatible: ${reason}`); this.name = 'WorkflowApplicabilityIncompatibleError'; }
}
export class WorkflowApplicabilityAmbiguousError extends Error {
  constructor(readonly relations: readonly Relation[]) { super(`Several equally selected workflow definitions apply: ${relations.map((r) => r.targetId).join(', ')}`); this.name = 'WorkflowApplicabilityAmbiguousError'; }
}

export interface ResolvedWorkflowApplicability {
  relation: Relation;
  workflowId: EntityId;
  version: number;
}

export interface WorkflowApplicabilityServicePorts<TContext> {
  relationService: RelationService<TContext>;
  relations: RelationRepository;
  workflows: WorkflowRepository;
  labels: LabelRepository;
  workflowStates: WorkflowStateRepository;
  entities: CoreEntityLookup;
}

/**
 * Commands and deterministic lookup for project-scoped Workflow selections.
 * New initialization sees only active Relations and active definitions;
 * `listHistory` explicitly retains ended relations for inspection.
 */
export class WorkflowApplicabilityService<TContext> {
  constructor(private readonly ports: WorkflowApplicabilityServicePorts<TContext>) {}

  async create(command: CreateWorkflowApplicabilityCommand): Promise<Relation> {
    const context = validateContext(command);
    await this.requireProject(command.projectId);
    await this.requireActiveLabel(command.labelId);
    const workflow = await this.ports.workflows.getById(command.workflowId);
    if (workflow === null) throw new RelationEndpointNotFoundError('target', 'workflow', command.workflowId);
    if (workflow.archivedAt !== null) throw new WorkflowApplicabilityArchivedError([]);
    if (workflow.purpose !== context.purpose) {
      throw new WorkflowApplicabilityIncompatibleError([], 'workflow purpose does not match the requested purpose');
    }
    await this.requireCompatibleMachine(workflow.id, context.entityType, context.labelId);
    return this.ports.relationService.createRelation({
      sourceType: 'project', sourceId: command.projectId,
      relationType: WORKFLOW_APPLICABILITY_RELATION_TYPE,
      targetType: 'workflow', targetId: workflow.id,
      metadata: { ...context, workflowVersion: workflow.version },
      actor: command.actor, occurredAt: command.occurredAt,
    });
  }

  async end(relationId: EntityId, actor: string, endedAt?: IsoTimestamp): Promise<Relation> {
    return this.ports.relationService.endRelation({ relationId, actor, endedAt });
  }

  async listHistory(projectId: EntityId): Promise<Relation[]> {
    return this.ports.relations.listHistory({ source: { type: 'project', id: projectId }, relationType: WORKFLOW_APPLICABILITY_RELATION_TYPE });
  }

  async resolve(query: ResolveWorkflowApplicabilityQuery): Promise<ResolvedWorkflowApplicability> {
    const context = validateContext(query);
    if (query.version !== undefined && (!Number.isInteger(query.version) || query.version < 1)) {
      throw new Error('Workflow applicability version must be a positive integer');
    }
    await this.requireProject(query.projectId);
    await this.requireActiveLabel(query.labelId);
    const matching = (await this.ports.relations.listCurrent({
      source: { type: 'project', id: query.projectId }, relationType: WORKFLOW_APPLICABILITY_RELATION_TYPE,
    })).filter((relation) => {
      const metadata = readMetadata(relation.metadata);
      return metadata !== null && metadata.entityType === context.entityType && metadata.purpose === context.purpose &&
        metadata.labelId === context.labelId && (query.version === undefined || metadata.workflowVersion === query.version);
    });
    if (matching.length === 0) throw new WorkflowApplicabilityMissingError(query);

    const active: Array<{ relation: Relation; version: number }> = [];
    const archived: Relation[] = [];
    const incompatible: Relation[] = [];
    for (const relation of matching) {
      const metadata = readMetadata(relation.metadata) as WorkflowApplicabilityMetadata;
      const workflow = await this.ports.workflows.getById(relation.targetId);
      if (workflow === null) incompatible.push(relation);
      else if (workflow.archivedAt !== null) archived.push(relation);
      else if (workflow.version !== metadata.workflowVersion || workflow.purpose !== context.purpose) incompatible.push(relation);
      else if (!(await this.hasCompatibleMachine(workflow.id, context.entityType, context.labelId))) incompatible.push(relation);
      else active.push({ relation, version: workflow.version });
    }
    if (active.length === 0) {
      if (archived.length > 0) throw new WorkflowApplicabilityArchivedError(archived);
      throw new WorkflowApplicabilityIncompatibleError(incompatible, 'definition, version, purpose, or state-machine context no longer matches');
    }
    const selectedVersion = query.version ?? Math.max(...active.map((candidate) => candidate.version));
    const selected = active.filter((candidate) => candidate.version === selectedVersion);
    if (selected.length !== 1) throw new WorkflowApplicabilityAmbiguousError(selected.map((candidate) => candidate.relation));
    return { relation: selected[0].relation, workflowId: selected[0].relation.targetId, version: selectedVersion };
  }

  private async requireProject(projectId: EntityId): Promise<void> {
    if (!(await this.ports.entities.exists('project', projectId))) throw new WorkflowApplicabilityProjectNotFoundError(projectId);
  }
  private async requireActiveLabel(labelId: EntityId): Promise<void> {
    const label = await this.ports.labels.getById(labelId);
    if (label === null) throw new WorkflowApplicabilityLabelNotFoundError(labelId);
    if (label.archivedAt !== null) throw new WorkflowApplicabilityLabelArchivedError(labelId);
  }
  private async requireCompatibleMachine(workflowId: EntityId, entityType: WorkflowConsumerType, labelId: EntityId): Promise<void> {
    if (!(await this.hasCompatibleMachine(workflowId, entityType, labelId))) {
      throw new WorkflowApplicabilityIncompatibleError([], `workflow ${workflowId} has no active ${entityType}/${labelId} state machine`);
    }
  }
  private async hasCompatibleMachine(workflowId: EntityId, entityType: WorkflowConsumerType, labelId: EntityId): Promise<boolean> {
    return (await this.ports.workflowStates.listActiveForMachine({ workflowId, entityType, labelId })).length > 0;
  }
}

function validateContext(input: Pick<CreateWorkflowApplicabilityCommand, 'entityType' | 'purpose' | 'labelId'>): Omit<WorkflowApplicabilityMetadata, 'workflowVersion'> {
  if (!isCoreEntityType(input.entityType) || !WORKFLOW_CONSUMER_TYPES.includes(input.entityType as WorkflowConsumerType)) {
    throw new Error(`Workflow applicability entityType must be one of: ${WORKFLOW_CONSUMER_TYPES.join(', ')}`);
  }
  if (input.purpose.trim().length === 0) throw new Error('Workflow applicability purpose must not be blank');
  if (input.labelId.trim().length === 0) throw new Error('Workflow applicability labelId must not be blank');
  return { entityType: input.entityType as WorkflowConsumerType, purpose: input.purpose, labelId: input.labelId };
}

function readMetadata(value: JsonValue | null): WorkflowApplicabilityMetadata | null {
  if (value === null || Array.isArray(value) || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (!WORKFLOW_CONSUMER_TYPES.includes(candidate.entityType as WorkflowConsumerType) || typeof candidate.purpose !== 'string' ||
      candidate.purpose.trim().length === 0 || typeof candidate.labelId !== 'string' || candidate.labelId.trim().length === 0 ||
      !Number.isInteger(candidate.workflowVersion) || (candidate.workflowVersion as number) < 1) return null;
  return candidate as unknown as WorkflowApplicabilityMetadata;
}

function describe(query: ResolveWorkflowApplicabilityQuery): string {
  return `${query.projectId}/${query.entityType}/${query.labelId}/${query.purpose}${query.version === undefined ? '' : `/v${query.version}`}`;
}
