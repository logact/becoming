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
import type { SqliteDatabase } from '../persistence/database';
import type { UnitOfWork } from './unitOfWork';
import type { Clock, IdGenerator } from './recordService';
import { systemClock, uuidGenerator } from './recordService';
import type { ProjectLookup } from './projectStateService';
import type { ResolveWorkflowApplicabilityQuery, ResolvedWorkflowApplicability } from './workflowApplicabilityService';

/** The read capability needed from the applicability feature (#43). */
export interface WorkflowApplicabilityResolver {
  resolve(query: ResolveWorkflowApplicabilityQuery): Promise<ResolvedWorkflowApplicability>;
}

export interface InitializeProjectMachinesCommand extends ResolveWorkflowApplicabilityQuery {
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

/** A template transition cannot be copied unless both endpoints are in its machine snapshot. */
export class WorkflowMachineInitializationTopologyError extends Error {
  constructor(readonly transition: WorkflowStateTransition) {
    super(`Workflow transition ${transition.id} has endpoints outside its active machine snapshot`);
    this.name = 'WorkflowMachineInitializationTopologyError';
  }
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
  clock?: Clock;
  ids?: IdGenerator;
  /** Test-only fault hook; any error triggers complete transaction rollback. */
  afterStateCopy?: (state: ProjectState) => Promise<void> | void;
  /** Test-only fault hook; any error triggers complete transaction rollback. */
  afterTransitionCopy?: (transition: ProjectStateTransition) => Promise<void> | void;
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
    if (project.archivedAt !== null) throw new Error(`Project ${command.projectId} is archived and cannot initialize machines`);

    return this.ports.unitOfWork.run(async (context) => {
      const templates = await this.ports.workflowStates.listActiveForWorkflow(selected.workflowId);
      const grouped = groupByMachine(templates);
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
      return { workflowId: selected.workflowId, workflowVersion: selected.version, idempotent, machines };
    });
  }

  private async requireTargetMachine(machine: ProjectStateMachine): Promise<void> {
    const label = await this.ports.labels.getById(machine.labelId);
    if (label === null) throw new Error(`Label ${machine.labelId} not found`);
    if (label.archivedAt !== null) throw new Error(`Label ${machine.labelId} is archived and cannot initialize a Project machine`);
  }
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
