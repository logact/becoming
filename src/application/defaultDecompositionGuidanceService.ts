import type { DecompositionEndpointType } from '../domain/decompositionPolicy';
import { createLabel } from '../domain/label';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { FieldSelectionPolicy } from '../domain/mutationProvenance';
import { createRelation } from '../domain/relation';
import { createWorkflow, publishWorkflow } from '../domain/workflow';
import { createWorkflowState } from '../domain/workflowState';
import type { LabelRepository } from '../persistence/labelRepository';
import type { RelationRepository } from '../persistence/relationRepository';
import type { RecordRepository } from '../persistence/recordRepository';
import type { WorkflowRepository } from '../persistence/workflowRepository';
import type { WorkflowStateRepository } from '../persistence/workflowStateRepository';
import type { RelationProvenancePort } from './relationService';
import { MutationProvenanceService } from './mutationProvenanceService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import { WORKFLOW_APPLICABILITY_RELATION_TYPE } from './workflowApplicabilityService';

/** Built-in context used by the Project Structure UI. */
export const DEFAULT_DECOMPOSITION_MANAGEMENT_LABEL_ID = 'management';

const DEFAULT_LABEL_NAME = 'Management';
const DEFAULT_WORKFLOW_ID = 'system-decomposition-workflow-v1';
const DEFAULT_WORKFLOW_TITLE = 'Default decomposition workflow';

const LABEL_POLICY: FieldSelectionPolicy = {
  allowlist: ['name', 'description', 'createdAt', 'updatedAt', 'archivedAt'],
  redacted: [],
};

const WORKFLOW_STATE_POLICY: FieldSelectionPolicy = {
  allowlist: [
    'workflowId', 'entityType', 'labelId', 'title', 'description', 'category',
    'sortOrder', 'isInitial', 'isTerminal', 'entryCriteria', 'exitCriteria',
    'createdAt', 'updatedAt', 'archivedAt',
  ],
  redacted: [],
};

export interface DefaultDecompositionGuidancePorts<TContext> {
  labels: (context: TContext) => LabelRepository;
  workflows: (context: TContext) => WorkflowRepository;
  states: (context: TContext) => WorkflowStateRepository;
  relations: (context: TContext) => RelationRepository;
  records: (context: TContext) => RecordRepository;
  provenance: RelationProvenancePort<TContext>;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Lazily installs the built-in decomposition guidance needed by Structure.
 * User-configured applicability wins: defaults are added only for a missing
 * Project/entity-type selection. Callers run this inside their own write unit
 * of work so initialization and the requested Structure mutation are atomic.
 */
export class DefaultDecompositionGuidanceService<TContext> {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: DefaultDecompositionGuidancePorts<TContext>) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async ensure(
    context: TContext,
    projectId: EntityId,
    requestedLabelId: EntityId,
    actor: string,
    occurredAt?: IsoTimestamp,
  ): Promise<EntityId> {
    // Explicit non-default labels remain explicit configuration and retain
    // the normal workflow-applicability rejection behavior when incomplete.
    if (requestedLabelId !== DEFAULT_DECOMPOSITION_MANAGEMENT_LABEL_ID) {
      return requestedLabelId;
    }

    const at = occurredAt ?? this.clock.now();
    const labelId = await this.ensureLabel(context, actor, at);
    const missingTypes = await this.missingApplicabilityTypes(context, projectId, labelId);
    if (missingTypes.length === 0) return labelId;

    const workflowId = await this.ensureWorkflow(context, actor, at);
    await this.ensureMachines(context, workflowId, labelId, actor, at);
    for (const entityType of missingTypes) {
      await this.addApplicability(context, projectId, workflowId, labelId, entityType, actor, at);
    }
    return labelId;
  }

  private async ensureLabel(
    context: TContext,
    actor: string,
    at: IsoTimestamp,
  ): Promise<EntityId> {
    const labels = this.ports.labels(context);
    const byId = await labels.getById(DEFAULT_DECOMPOSITION_MANAGEMENT_LABEL_ID);
    if (byId?.archivedAt === null) return byId.id;
    const byName = await labels.findActiveByName(DEFAULT_LABEL_NAME);
    if (byName !== null) return byName.id;

    const generated = createLabel({
      name: DEFAULT_LABEL_NAME,
      description: 'Built-in workflow context for Project Structure decomposition.',
    });
    const label = {
      ...generated,
      id: byId === null ? DEFAULT_DECOMPOSITION_MANAGEMENT_LABEL_ID : this.ids.newId(),
      createdAt: at,
      updatedAt: at,
    };
    await this.provenance(context).mutateWithProvenance({
      entityType: 'label',
      entityId: label.id,
      action: 'create',
      actor,
      occurredAt: at,
      after: { ...label },
      mutate: async () => {
        await labels.add(label);
        return label;
      },
    });
    return label.id;
  }

  private async ensureWorkflow(
    context: TContext,
    actor: string,
    at: IsoTimestamp,
  ): Promise<EntityId> {
    const workflows = this.ports.workflows(context);
    const byId = await workflows.getById(DEFAULT_WORKFLOW_ID);
    if (byId?.archivedAt === null) return byId.id;

    const generated = createWorkflow({
      title: DEFAULT_WORKFLOW_TITLE,
      workflowType: 'execution',
      purpose: 'decompose',
      description: 'Built-in guidance for Goal and Task decomposition.',
    });
    const draft = {
      ...generated,
      id: byId === null ? DEFAULT_WORKFLOW_ID : this.ids.newId(),
      createdAt: at,
      updatedAt: at,
    };
    const workflow = publishWorkflow(draft, at);
    await this.provenance(context).mutateWithProvenance({
      entityType: 'workflow',
      entityId: workflow.id,
      action: 'create',
      actor,
      occurredAt: at,
      after: { ...workflow },
      mutate: async () => {
        await workflows.add(workflow);
        return workflow;
      },
    });
    return workflow.id;
  }

  private async ensureMachines(
    context: TContext,
    workflowId: EntityId,
    labelId: EntityId,
    actor: string,
    at: IsoTimestamp,
  ): Promise<void> {
    const states = this.ports.states(context);
    for (const entityType of ['goal', 'task'] as const) {
      const current = await states.listActiveForMachine({ workflowId, entityType, labelId });
      if (current.length > 0) continue;
      const state = createWorkflowState({
        workflowId,
        entityType,
        labelId,
        title: 'Ready',
        description: 'Ready to be decomposed in this Project Structure.',
        isInitial: true,
        sortOrder: 0,
      }, { id: this.ids.newId(), now: at });
      await this.provenance(context).mutateWithProvenance({
        entityType: 'workflow_state',
        entityId: state.id,
        action: 'create',
        actor,
        occurredAt: at,
        after: { ...state },
        mutate: async () => {
          await states.add(state);
          return state;
        },
      });
    }
  }

  private async missingApplicabilityTypes(
    context: TContext,
    projectId: EntityId,
    labelId: EntityId,
  ): Promise<DecompositionEndpointType[]> {
    const current = await this.ports.relations(context).listCurrent({
      source: { type: 'project', id: projectId },
      relationType: WORKFLOW_APPLICABILITY_RELATION_TYPE,
    });
    return (['goal', 'task'] as const).filter((entityType) =>
      !current.some((relation) => {
        const metadata = relation.metadata;
        return metadata !== null && !Array.isArray(metadata) && typeof metadata === 'object' &&
          metadata.entityType === entityType && metadata.purpose === 'decompose' &&
          metadata.labelId === labelId;
      }),
    );
  }

  private async addApplicability(
    context: TContext,
    projectId: EntityId,
    workflowId: EntityId,
    labelId: EntityId,
    entityType: DecompositionEndpointType,
    actor: string,
    at: IsoTimestamp,
  ): Promise<void> {
    const relation = createRelation({
      sourceType: 'project',
      sourceId: projectId,
      relationType: WORKFLOW_APPLICABILITY_RELATION_TYPE,
      targetType: 'workflow',
      targetId: workflowId,
      metadata: { entityType, purpose: 'decompose', labelId, workflowVersion: 1 },
    }, { id: this.ids.newId(), now: at });
    await this.ports.relations(context).add(relation);
    await this.ports.provenance.append(context, {
      kind: 'created',
      relation,
      actor,
      occurredAt: at,
    });
  }

  /** Provenance service that reuses, rather than nests, the caller's transaction. */
  private provenance(context: TContext): MutationProvenanceService<TContext> {
    return new MutationProvenanceService<TContext>({
      unitOfWork: { run: (work) => work(context) },
      records: this.ports.records,
      clock: this.clock,
      ids: this.ids,
      additionalFieldPolicies: {
        label: LABEL_POLICY,
        workflow_state: WORKFLOW_STATE_POLICY,
      },
    });
  }
}
