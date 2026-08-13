import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import { archiveProjectStateTransition, createProjectStateTransition, updateProjectStateTransition } from '../domain/projectStateTransition';
import type { ProjectStateTransition, ProjectStateTransitionChanges, ProjectStateTransitionMachine } from '../domain/projectStateTransition';
import type { ProjectStateRepository } from '../persistence/projectStateRepository';
import { ProjectStateTransitionDuplicateError } from '../persistence/projectStateTransitionRepository';
import type { ProjectStateTransitionRepository } from '../persistence/projectStateTransitionRepository';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';

export class ProjectStateTransitionEndpointNotFoundError extends Error {
  constructor(endpoint: 'source' | 'destination', id: EntityId) { super(`ProjectStateTransition ${endpoint} state ${id} not found`); this.name = 'ProjectStateTransitionEndpointNotFoundError'; }
}
export class ProjectStateTransitionEndpointArchivedError extends Error {
  constructor(endpoint: 'source' | 'destination', id: EntityId) { super(`ProjectStateTransition ${endpoint} state ${id} is archived`); this.name = 'ProjectStateTransitionEndpointArchivedError'; }
}
export class ProjectStateTransitionMachineMismatchError extends Error {
  constructor(sourceId: EntityId, destinationId: EntityId) { super(`ProjectStateTransition endpoints ${sourceId} and ${destinationId} must belong to the same Project state machine`); this.name = 'ProjectStateTransitionMachineMismatchError'; }
}
export class ProjectStateTransitionNotFoundError extends Error {
  constructor(id: EntityId) { super(`ProjectStateTransition ${id} not found`); this.name = 'ProjectStateTransitionNotFoundError'; }
}
export { ProjectStateTransitionDuplicateError };

export interface DefineProjectStateTransitionCommand {
  fromStateId: EntityId; toStateId: EntityId; title?: string | null; description?: string | null;
  condition?: string | null; action?: string | null; requiresExitCriteria?: boolean;
  sourceWorkflowTransitionId?: EntityId; definedAt?: IsoTimestamp;
}
export interface ProjectStateTransitionServicePorts { states: ProjectStateRepository; transitions: ProjectStateTransitionRepository; clock?: Clock; ids?: IdGenerator; }

/**
 * Owns Project transition definition. Both active endpoint states must have an
 * exactly equal projectId/entityType/labelId triple. Source workflow ids are
 * provenance-only, so changing a Workflow or creating a new Workflow version
 * cannot affect these independently stored Project transitions.
 */
export class ProjectStateTransitionService {
  private readonly clock: Clock; private readonly ids: IdGenerator;
  constructor(private readonly ports: ProjectStateTransitionServicePorts) { this.clock = ports.clock ?? systemClock; this.ids = ports.ids ?? uuidGenerator; }

  async defineTransition(command: DefineProjectStateTransitionCommand): Promise<ProjectStateTransition> {
    const source = await this.requireActiveEndpoint('source', command.fromStateId);
    const destination = await this.requireActiveEndpoint('destination', command.toStateId);
    if (!sameMachine(source, destination)) throw new ProjectStateTransitionMachineMismatchError(source.id, destination.id);
    const transition = createProjectStateTransition({ projectId: source.projectId, entityType: source.entityType, labelId: source.labelId,
      fromStateId: source.id, toStateId: destination.id, title: command.title, description: command.description,
      condition: command.condition, action: command.action, requiresExitCriteria: command.requiresExitCriteria,
      sourceWorkflowTransitionId: command.sourceWorkflowTransitionId },
    { id: this.ids.newId(), now: command.definedAt ?? this.clock.now() });
    await this.ports.transitions.add(transition);
    return transition;
  }
  async getTransition(id: EntityId): Promise<ProjectStateTransition | null> { return this.ports.transitions.getById(id); }
  async updateTransition(id: EntityId, changes: ProjectStateTransitionChanges, updatedAt?: IsoTimestamp): Promise<ProjectStateTransition> {
    const updated = updateProjectStateTransition(await this.requireTransition(id), changes, updatedAt ?? this.clock.now());
    await this.ports.transitions.save(updated); return updated;
  }
  async archiveTransition(id: EntityId, archivedAt?: IsoTimestamp): Promise<ProjectStateTransition> {
    const archived = archiveProjectStateTransition(await this.requireTransition(id), archivedAt ?? this.clock.now());
    await this.ports.transitions.save(archived); return archived;
  }
  async listActiveTransitions(projectId: EntityId, entityType: CoreEntityType, labelId: EntityId): Promise<ProjectStateTransition[]> { return this.ports.transitions.listActiveForMachine({ projectId, entityType, labelId }); }
  async listMachineHistory(projectId: EntityId, entityType: CoreEntityType, labelId: EntityId): Promise<ProjectStateTransition[]> { return this.ports.transitions.listForMachine({ projectId, entityType, labelId }); }
  async listActiveOutgoing(stateId: EntityId): Promise<ProjectStateTransition[]> { const state = await this.requireState(stateId); return this.ports.transitions.listActiveOutgoingForState(machineOf(state), stateId); }
  async listOutgoingHistory(stateId: EntityId): Promise<ProjectStateTransition[]> { const state = await this.requireState(stateId); return this.ports.transitions.listOutgoingForState(machineOf(state), stateId); }
  async listActiveIncoming(stateId: EntityId): Promise<ProjectStateTransition[]> { const state = await this.requireState(stateId); return this.ports.transitions.listActiveIncomingForState(machineOf(state), stateId); }
  async listIncomingHistory(stateId: EntityId): Promise<ProjectStateTransition[]> { const state = await this.requireState(stateId); return this.ports.transitions.listIncomingForState(machineOf(state), stateId); }

  private async requireActiveEndpoint(endpoint: 'source' | 'destination', id: EntityId) {
    const state = await this.requireState(id, endpoint);
    if (state.archivedAt !== null) throw new ProjectStateTransitionEndpointArchivedError(endpoint, id);
    return state;
  }
  private async requireState(id: EntityId, endpoint?: 'source' | 'destination') {
    const state = await this.ports.states.getById(id);
    if (state === null) throw new ProjectStateTransitionEndpointNotFoundError(endpoint ?? 'source', id);
    return state;
  }
  private async requireTransition(id: EntityId) { const transition = await this.ports.transitions.getById(id); if (transition === null) throw new ProjectStateTransitionNotFoundError(id); return transition; }
}

function machineOf(state: { projectId: EntityId; entityType: CoreEntityType; labelId: EntityId }): ProjectStateTransitionMachine { return { projectId: state.projectId, entityType: state.entityType, labelId: state.labelId }; }
function sameMachine(a: { projectId: EntityId; entityType: CoreEntityType; labelId: EntityId }, b: { projectId: EntityId; entityType: CoreEntityType; labelId: EntityId }): boolean { return a.projectId === b.projectId && a.entityType === b.entityType && a.labelId === b.labelId; }
