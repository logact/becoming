import type { EntityId, IsoTimestamp } from '../domain/ids';
import type { CoreEntityType } from '../domain/entityTypes';
import { createProjectState } from '../domain/projectState';
import type { ProjectState, ProjectStateMachine } from '../domain/projectState';
import { createProjectStateTransition } from '../domain/projectStateTransition';
import type { ProjectStateTransition } from '../domain/projectStateTransition';
import type { WorkflowState } from '../domain/workflowState';
import type { WorkflowStateTransition } from '../domain/workflowStateTransition';
import type { LabelRepository } from '../persistence/labelRepository';
import type { ProjectStateRepository } from '../persistence/projectStateRepository';
import type { ProjectStateTransitionRepository } from '../persistence/projectStateTransitionRepository';
import type { WorkflowStateRepository } from '../persistence/workflowStateRepository';
import type { WorkflowStateTransitionRepository } from '../persistence/workflowStateTransitionRepository';
import type { RecordHistoryRepository } from '../persistence/recordRepository';
import type { SqliteDatabase } from '../persistence/database';
import type { UnitOfWork } from './unitOfWork';
import type { Clock, IdGenerator } from './recordService';
import { systemClock, uuidGenerator } from './recordService';
import { createRecord } from '../domain/record';
import type { ProjectLookup } from './projectStateService';
import type { ResolveWorkflowApplicabilityQuery, ResolvedWorkflowApplicability } from './workflowApplicabilityService';

/** The read capability needed from the applicability feature (#43). */
export interface WorkflowApplicabilityResolver {
  resolve(query: ResolveWorkflowApplicabilityQuery): Promise<ResolvedWorkflowApplicability>;
}

export interface InitializeProjectMachinesCommand extends ResolveWorkflowApplicabilityQuery {
  /** Actor recorded with the immutable initialization evidence. */
  actor?: string;
  initializedAt?: IsoTimestamp;
}

export interface InitializedProjectMachine {
  machine: ProjectStateMachine;
  states: ProjectState[];
  transitions: ProjectStateTransition[];
}

export interface InitializeProjectMachinesResult {
  workflowId: EntityId;
  workflowVersion: number;
  /** True when the stable source-provenance identity already existed intact. */
  idempotent: boolean;
  machines: InitializedProjectMachine[];
}

/** A target machine already contains a different or incomplete initialization. */
export class ProjectMachineInitializationConflictError extends Error {
  constructor(readonly machine: ProjectStateMachine, reason: string) {
    super(`Project machine initialization conflicts for ${machine.projectId}/${machine.entityType}/${machine.labelId}: ${reason}`);
    this.name = 'ProjectMachineInitializationConflictError';
  }
}

/** The Project exists for applicability but cannot own a new machine. */
export class ProjectMachineInitializationProjectArchivedError extends Error {
  constructor(readonly projectId: EntityId) {
    super(`Project ${projectId} is archived and cannot initialize machines`);
    this.name = 'ProjectMachineInitializationProjectArchivedError';
  }
}

/** A source workflow machine has no active state templates to materialize. */
export class WorkflowMachineInitializationInvalidTemplateError extends Error {
  constructor(readonly workflowId: EntityId, reason: string) {
    super(`Workflow ${workflowId} cannot initialize Project machines: ${reason}`);
    this.name = 'WorkflowMachineInitializationInvalidTemplateError';
  }
}

/** A template transition cannot be copied unless both endpoints are in its machine snapshot. */
export class WorkflowMachineInitializationTopologyError extends Error {
  constructor(readonly transition: WorkflowStateTransition) {
    super(`Workflow transition ${transition.id} has endpoints outside its active machine snapshot`);
    this.name = 'WorkflowMachineInitializationTopologyError';
  }
}

/** The durable occurrence type for one non-idempotent machine initialization. */
export const PROJECT_MACHINE_INITIALIZATION_RECORD_TYPE = 'mutation';

export interface ProjectMachineOrigin {
  machine: ProjectStateMachine;
  workflowId: EntityId;
  workflowVersion: number;
  relationId: EntityId;
  initializedAt: IsoTimestamp;
  stateSourceIds: EntityId[];
  transitionSourceIds: EntityId[];
  copiedStateIds: EntityId[];
  copiedTransitionIds: EntityId[];
}

export interface ProjectMachineInitializationServicePorts {
  applicability: WorkflowApplicabilityResolver;
  projects: ProjectLookup;
  labels: LabelRepository;
  workflowStates: WorkflowStateRepository;
  workflowTransitions: WorkflowStateTransitionRepository;
  unitOfWork: UnitOfWork<SqliteDatabase>;
  states: (context: SqliteDatabase) => ProjectStateRepository;
  transitions: (context: SqliteDatabase) => ProjectStateTransitionRepository;
  /** Append-only evidence of a completed initialization, in the copy transaction. */
  records: (context: SqliteDatabase) => RecordHistoryRepository;
  clock?: Clock;
  ids?: IdGenerator;
  /** Test-only fault hook; any error triggers complete transaction rollback. */
  afterStateCopy?: (state: ProjectState) => Promise<void> | void;
  /** Test-only fault hook; any error triggers complete transaction rollback. */
  afterTransitionCopy?: (transition: ProjectStateTransition) => Promise<void> | void;
  /** Test-only fault hook; proves provenance and copies share one rollback boundary. */
  afterProvenanceAppend?: () => Promise<void> | void;
}

/**
 * Materializes all active machines of a resolved Workflow as independent
 * Project definitions. The initialization identity is stable: for each
 * target machine it is its `projectId/entityType/labelId` plus the exact set
 * of active source state and transition provenance ids. A repeat with that
 * complete identity is a no-op; any partial or foreign contents conflict.
 *
 * Copies are deliberately not routed through the mutable Project-state or
 * transition services. Those services are for subsequent machine edits; this
 * boundary needs a single transaction spanning every machine in the selected
 * Workflow and has no runtime entity-state side effects.
 */
export class ProjectMachineInitializationService {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(private readonly ports: ProjectMachineInitializationServicePorts) {
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
  }

  async initialize(command: InitializeProjectMachinesCommand): Promise<InitializeProjectMachinesResult> {
    const selected = await this.ports.applicability.resolve(command);
    const project = await this.ports.projects.getById(command.projectId);
    if (project === null) throw new Error(`Project ${command.projectId} not found`);
    if (project.archivedAt !== null) throw new ProjectMachineInitializationProjectArchivedError(command.projectId);

    return this.ports.unitOfWork.run(async (context) => {
      const templates = await this.ports.workflowStates.listActiveForWorkflow(selected.workflowId);
      const grouped = groupByMachine(templates);
      if (grouped.size === 0) {
        throw new WorkflowMachineInitializationInvalidTemplateError(selected.workflowId, 'it has no active state-machine templates');
      }
      const states = this.ports.states(context);
      const transitions = this.ports.transitions(context);
      const at = command.initializedAt ?? this.clock.now();
      const machines: InitializedProjectMachine[] = [];
      let idempotent = true;

      for (const [sourceMachine, sourceStates] of grouped) {
        const machine: ProjectStateMachine = {
          projectId: command.projectId,
          entityType: sourceMachine.entityType,
          labelId: sourceMachine.labelId,
        };
        await this.requireTargetMachine(machine);
        const sourceTransitions = await this.ports.workflowTransitions.listActiveForMachine({
          workflowId: selected.workflowId,
          entityType: sourceMachine.entityType,
          labelId: sourceMachine.labelId,
        });
        assertTopology(sourceStates, sourceTransitions);

        const existing = await readExisting(machine, states, transitions);
        if (existing.states.length > 0 || existing.transitions.length > 0) {
          const existingMachine = requireExactExisting(machine, sourceStates, sourceTransitions, existing);
          machines.push(existingMachine);
          continue;
        }

        idempotent = false;
        const copiedBySource = new Map<EntityId, ProjectState>();
        for (const source of sourceStates) {
          const copied = createProjectState({
            projectId: machine.projectId, entityType: machine.entityType, labelId: machine.labelId,
            title: source.title, description: source.description ?? undefined, category: source.category ?? undefined,
            sortOrder: source.sortOrder ?? undefined, isInitial: source.isInitial, isTerminal: source.isTerminal,
            entryCriteria: source.entryCriteria ?? undefined, exitCriteria: source.exitCriteria ?? undefined,
            sourceWorkflowStateId: source.id,
          }, { id: this.ids.newId(), now: at });
          await states.add(copied);
          await this.ports.afterStateCopy?.(copied);
          copiedBySource.set(source.id, copied);
        }
        const copiedTransitions: ProjectStateTransition[] = [];
        for (const source of sourceTransitions) {
          const copied = createProjectStateTransition({
            projectId: machine.projectId, entityType: machine.entityType, labelId: machine.labelId,
            fromStateId: copiedBySource.get(source.fromStateId)!.id,
            toStateId: copiedBySource.get(source.toStateId)!.id,
            title: source.title, description: source.description, condition: source.condition, action: source.action,
            requiresExitCriteria: source.requiresExitCriteria, sourceWorkflowTransitionId: source.id,
          }, { id: this.ids.newId(), now: at });
          await transitions.add(copied);
          await this.ports.afterTransitionCopy?.(copied);
          copiedTransitions.push(copied);
        }
        machines.push({ machine, states: [...copiedBySource.values()], transitions: copiedTransitions });
      }
      const result = { workflowId: selected.workflowId, workflowVersion: selected.version, idempotent, machines };
      if (!idempotent) {
        await this.ports.records(context).add(createInitializationRecord({
          id: this.ids.newId(), at, actor: command.actor ?? 'system', selected, result,
        }));
        await this.ports.afterProvenanceAppend?.();
      }
      return result;
    });
  }

  private async requireTargetMachine(machine: ProjectStateMachine): Promise<void> {
    const label = await this.ports.labels.getById(machine.labelId);
    if (label === null) throw new Error(`Label ${machine.labelId} not found`);
    if (label.archivedAt !== null) throw new Error(`Label ${machine.labelId} is archived and cannot initialize a Project machine`);
  }

  /**
   * Reads copy-origin evidence from the independent Project machine. It never
   * resolves or writes a live template and therefore remains useful after the
   * source Workflow is archived.
   */
  async getMachineOrigin(machine: ProjectStateMachine): Promise<ProjectMachineOrigin | null> {
    const stateRepository = this.ports.states as unknown as (context: SqliteDatabase) => ProjectStateRepository;
    // The service's repositories are transaction factories; use a short read
    // transaction so this works for both SQLite adapters without a second port.
    return this.ports.unitOfWork.run(async (context) => {
      const states = await stateRepository(context).listForMachine(machine);
      const transitions = await this.ports.transitions(context).listForMachine(machine);
      const sourcedStates = states.filter((state) => state.sourceWorkflowStateId !== null);
      if (sourcedStates.length === 0) return null;
      const event = (await this.ports.records(context).list({ status: 'all', recordType: PROJECT_MACHINE_INITIALIZATION_RECORD_TYPE }))
        .reverse()
        .find((record) => {
          if (record.payload === null || Array.isArray(record.payload) || typeof record.payload !== 'object') return false;
          return record.payload.event === 'project_machine_initialized' && record.payload.projectId === machine.projectId;
        });
      if (event === undefined || event.payload === null) return null;
      const payload = event.payload as {
        workflowId?: unknown; workflowVersion?: unknown; applicabilityRelationId?: unknown;
        machines?: Array<{ machine?: ProjectStateMachine }>;
      };
      const evidence = payload.machines?.find((entry) => entry.machine?.entityType === machine.entityType && entry.machine?.labelId === machine.labelId);
      if (typeof payload.workflowId !== 'string' || !Number.isInteger(payload.workflowVersion) || evidence === undefined) return null;
      return {
        machine, workflowId: payload.workflowId, workflowVersion: payload.workflowVersion as number,
        relationId: typeof payload.applicabilityRelationId === 'string' ? payload.applicabilityRelationId : '',
        initializedAt: event.occurredAt,
        stateSourceIds: sourcedStates.map((state) => state.sourceWorkflowStateId!),
        transitionSourceIds: transitions.flatMap((transition) => transition.sourceWorkflowTransitionId === null ? [] : [transition.sourceWorkflowTransitionId]),
        copiedStateIds: sourcedStates.map((state) => state.id),
        copiedTransitionIds: transitions.filter((transition) => transition.sourceWorkflowTransitionId !== null).map((transition) => transition.id),
      };
    });
  }
}

function createInitializationRecord(input: {
  id: EntityId;
  at: IsoTimestamp;
  actor: string;
  selected: ResolvedWorkflowApplicability;
  result: InitializeProjectMachinesResult;
}) {
  return createRecord({
    title: 'Project workflow machines initialized',
    description: `Initialized Project machines from Workflow ${input.selected.workflowId} version ${input.selected.version}`,
    recordType: PROJECT_MACHINE_INITIALIZATION_RECORD_TYPE,
    occurredAt: input.at,
    recordedAt: input.at,
    actor: input.actor,
    payload: {
      event: 'project_machine_initialized', projectId: input.result.machines[0]?.machine.projectId ?? '',
      workflowId: input.selected.workflowId, workflowVersion: input.selected.version,
      applicabilityRelationId: input.selected.relation.id ?? null,
      machines: input.result.machines.map(({ machine, states, transitions }) => ({
        machine, sourceWorkflowStateIds: states.map((state) => state.sourceWorkflowStateId),
        sourceWorkflowTransitionIds: transitions.map((transition) => transition.sourceWorkflowTransitionId),
        copiedStateIds: states.map((state) => state.id), copiedTransitionIds: transitions.map((transition) => transition.id),
      })),
    },
  }, { id: input.id, now: input.at });
}


type SourceMachine = { entityType: CoreEntityType; labelId: EntityId };

function groupByMachine(states: WorkflowState[]): Map<SourceMachine, WorkflowState[]> {
  const groups = new Map<string, { machine: SourceMachine; states: WorkflowState[] }>();
  for (const state of states) {
    const key = `${state.entityType}\u0000${state.labelId}`;
    const group = groups.get(key) ?? { machine: { entityType: state.entityType, labelId: state.labelId }, states: [] };
    group.states.push(state);
    groups.set(key, group);
  }
  return new Map([...groups.values()].map((group) => [group.machine, group.states]));
}

function assertTopology(states: WorkflowState[], transitions: WorkflowStateTransition[]): void {
  const ids = new Set(states.map((state) => state.id));
  for (const transition of transitions) {
    if (!ids.has(transition.fromStateId) || !ids.has(transition.toStateId)) {
      throw new WorkflowMachineInitializationTopologyError(transition);
    }
  }
}

async function readExisting(
  machine: ProjectStateMachine,
  states: ProjectStateRepository,
  transitions: ProjectStateTransitionRepository,
): Promise<{ states: ProjectState[]; transitions: ProjectStateTransition[] }> {
  return {
    states: await states.listActiveForMachine(machine),
    transitions: await transitions.listActiveForMachine(machine),
  };
}

function requireExactExisting(
  machine: ProjectStateMachine,
  sources: WorkflowState[],
  sourceTransitions: WorkflowStateTransition[],
  existing: { states: ProjectState[]; transitions: ProjectStateTransition[] },
): InitializedProjectMachine {
  const statesBySource = new Map(existing.states.map((state) => [state.sourceWorkflowStateId, state]));
  if (statesBySource.size !== existing.states.length || statesBySource.size !== sources.length ||
      sources.some((source) => !statesBySource.has(source.id))) {
    throw new ProjectMachineInitializationConflictError(machine, 'active states do not match the stable source-provenance identity');
  }
  const transitionsBySource = new Map(existing.transitions.map((transition) => [transition.sourceWorkflowTransitionId, transition]));
  if (transitionsBySource.size !== existing.transitions.length || transitionsBySource.size !== sourceTransitions.length ||
      sourceTransitions.some((source) => !transitionsBySource.has(source.id))) {
    throw new ProjectMachineInitializationConflictError(machine, 'active transitions do not match the stable source-provenance identity');
  }
  for (const source of sourceTransitions) {
    const copied = transitionsBySource.get(source.id)!;
    if (copied.fromStateId !== statesBySource.get(source.fromStateId)!.id ||
        copied.toStateId !== statesBySource.get(source.toStateId)!.id) {
      throw new ProjectMachineInitializationConflictError(machine, 'copied transition endpoints do not match copied source states');
    }
  }
  return { machine, states: sources.map((source) => statesBySource.get(source.id)!), transitions: sourceTransitions.map((source) => transitionsBySource.get(source.id)!) };
}
