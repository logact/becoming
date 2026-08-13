import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  archiveLabel,
  createLabel,
  updateLabel,
} from '../domain/label';
import type { Label, LabelChanges } from '../domain/label';
import {
  createEntityLabelAssignment,
  endEntityLabelAssignment,
} from '../domain/entityLabel';
import type { EntityLabelAssignment } from '../domain/entityLabel';
import type { FieldSelectionPolicy } from '../domain/mutationProvenance';
import { MutationProvenanceService } from './mutationProvenanceService';
import {
  LabelArchivedError,
  LabelAssignmentNotFoundError,
  LabelNotFoundError,
} from './labelAssignmentService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';
import type { RecordRepository } from '../persistence/recordRepository';
import type {
  LabelListOptions,
  LabelRepository,
} from '../persistence/labelRepository';
import type {
  EntityLabelListOptions,
  EntityLabelRepository,
} from '../persistence/entityLabelRepository';

/** A temporal classification together with its still-resolvable definition. */
export interface ResolvedLabelAssignment {
  assignment: EntityLabelAssignment;
  label: Label;
}

export interface CreateLabelCommand {
  actor: string;
  name: string;
  description?: string;
  occurredAt?: IsoTimestamp;
}

export interface AssignLabelWithProvenanceCommand {
  actor: string;
  entityType: string;
  entityId: EntityId;
  labelId: EntityId;
  assignedAt?: IsoTimestamp;
}

export interface LabelServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  labels: (context: TContext) => LabelRepository;
  assignments: (context: TContext) => EntityLabelRepository;
  records: (context: TContext) => RecordRepository;
  /** Read repositories are intentionally separate from transaction factories. */
  readLabels: LabelRepository;
  readAssignments: EntityLabelRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

const LABEL_POLICY: FieldSelectionPolicy = {
  allowlist: ['name', 'description', 'createdAt', 'updatedAt', 'archivedAt'],
  redacted: [],
};

const ASSIGNMENT_POLICY: FieldSelectionPolicy = {
  allowlist: ['entityType', 'entityId', 'labelId', 'createdAt', 'endedAt'],
  redacted: [],
};

/**
 * Label definition, classification query, and assignment boundary.
 *
 * Labels classify independently: none of these methods read or write a
 * Workflow, Project State, or state-transition repository. A lifecycle
 * machine can therefore be configured only by its explicit owning feature;
 * attaching a Label never discovers, creates, or selects one.
 *
 * Definition mutations and assignment start/end each append one `mutation`
 * Record in the same unit of work. Supporting aggregates use the shared
 * provenance transport through explicit field policies, while the core-only
 * default remains unchanged for every other caller.
 */
export class LabelService<TContext> {
  private readonly labels: (context: TContext) => LabelRepository;
  private readonly assignments: (context: TContext) => EntityLabelRepository;
  private readonly readLabels: LabelRepository;
  private readonly readAssignments: EntityLabelRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly provenance: MutationProvenanceService<TContext>;

  constructor(ports: LabelServicePorts<TContext>) {
    this.labels = ports.labels;
    this.assignments = ports.assignments;
    this.readLabels = ports.readLabels;
    this.readAssignments = ports.readAssignments;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.provenance = new MutationProvenanceService({
      unitOfWork: ports.unitOfWork,
      records: ports.records,
      clock: this.clock,
      ids: this.ids,
      additionalFieldPolicies: {
        label: LABEL_POLICY,
        entity_label: ASSIGNMENT_POLICY,
      },
    });
  }

  async createLabel(command: CreateLabelCommand): Promise<Label> {
    const label = createLabel({ name: command.name, description: command.description });
    return this.provenance.mutateWithProvenance({
      entityType: 'label', entityId: label.id, action: 'create',
      actor: command.actor, occurredAt: command.occurredAt, after: snapshot(label),
      mutate: async (context) => {
        await this.labels(context).add(label);
        return label;
      },
    });
  }

  async updateLabel(
    id: EntityId, changes: LabelChanges, actor: string, occurredAt?: IsoTimestamp,
  ): Promise<Label> {
    const before = await this.requireLabel(id);
    const after = updateLabel(before, changes, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'label', entityId: id, action: 'update', actor, occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.labels(context).save(after);
        return after;
      },
    });
  }

  async archiveLabel(id: EntityId, actor: string, occurredAt?: IsoTimestamp): Promise<Label> {
    const before = await this.requireLabel(id);
    const after = archiveLabel(before, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'label', entityId: id, action: 'archive', actor, occurredAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.labels(context).save(after);
        return after;
      },
    });
  }

  async assignLabel(command: AssignLabelWithProvenanceCommand): Promise<EntityLabelAssignment> {
    const label = await this.requireLabel(command.labelId);
    if (label.archivedAt !== null) throw new LabelArchivedError(label.id);
    const assignment = createEntityLabelAssignment({
      entityType: command.entityType, entityId: command.entityId, labelId: command.labelId,
    }, { id: this.ids.newId(), now: command.assignedAt ?? this.clock.now() });
    return this.provenance.mutateWithProvenance({
      entityType: 'entity_label', entityId: assignment.id, action: 'create',
      actor: command.actor, occurredAt: command.assignedAt, after: snapshot(assignment),
      mutate: async (context) => {
        const currentLabel = await this.labels(context).getById(command.labelId);
        if (currentLabel === null) throw new LabelNotFoundError(command.labelId);
        if (currentLabel.archivedAt !== null) throw new LabelArchivedError(command.labelId);
        await this.assignments(context).add(assignment);
        return assignment;
      },
    });
  }

  async endLabelAssignment(
    id: EntityId, actor: string, endedAt?: IsoTimestamp,
  ): Promise<EntityLabelAssignment> {
    const before = await this.requireAssignment(id);
    const after = endEntityLabelAssignment(before, endedAt ?? this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'entity_label', entityId: id, action: 'update', actor, occurredAt: endedAt,
      before: snapshot(before), after: snapshot(after),
      mutate: async (context) => {
        await this.assignments(context).save(after);
        return after;
      },
    });
  }

  async listActiveDefinitions(options?: LabelListOptions): Promise<Label[]> {
    return this.readLabels.list(options);
  }

  async listDefinitionHistory(options?: LabelListOptions): Promise<Label[]> {
    return this.readLabels.list({ ...options, includeArchived: true });
  }

  async listActiveLabelsForEntity(
    entityType: CoreEntityType, entityId: EntityId, options?: EntityLabelListOptions,
  ): Promise<ResolvedLabelAssignment[]> {
    return this.resolve(this.readAssignments.findActiveForEntity(entityType, entityId, options));
  }

  async listAssignmentHistoryForEntity(
    entityType: CoreEntityType, entityId: EntityId, options?: EntityLabelListOptions,
  ): Promise<ResolvedLabelAssignment[]> {
    return this.resolve(this.readAssignments.listForEntity(entityType, entityId, options));
  }

  async listActiveEntitiesForLabel(
    labelId: EntityId, options?: EntityLabelListOptions,
  ): Promise<EntityLabelAssignment[]> {
    return this.readAssignments.findActiveForLabel(labelId, options);
  }

  async listEntityHistoryForLabel(
    labelId: EntityId, options?: EntityLabelListOptions,
  ): Promise<EntityLabelAssignment[]> {
    return this.readAssignments.listForLabel(labelId, options);
  }

  private async resolve(assignments: Promise<EntityLabelAssignment[]>): Promise<ResolvedLabelAssignment[]> {
    const result: ResolvedLabelAssignment[] = [];
    for (const assignment of await assignments) {
      const label = await this.readLabels.getById(assignment.labelId);
      if (label === null) throw new LabelNotFoundError(assignment.labelId);
      result.push({ assignment, label });
    }
    return result;
  }

  private async requireLabel(id: EntityId): Promise<Label> {
    const label = await this.readLabels.getById(id);
    if (label === null) throw new LabelNotFoundError(id);
    return label;
  }

  private async requireAssignment(id: EntityId): Promise<EntityLabelAssignment> {
    const assignment = await this.readAssignments.getById(id);
    if (assignment === null) throw new LabelAssignmentNotFoundError(id);
    return assignment;
  }
}

function snapshot(value: Label | EntityLabelAssignment): { [field: string]: unknown } {
  return { ...value };
}
