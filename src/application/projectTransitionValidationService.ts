import { isCoreEntityType } from '../domain/entityTypes';
import type { CoreEntityType } from '../domain/entityTypes';
import type { EntityId } from '../domain/ids';
import type { ProjectEntityState } from '../domain/projectEntityState';
import type { ProjectState, ProjectStateMachine } from '../domain/projectState';
import type { ProjectStateTransition } from '../domain/projectStateTransition';
import type { ProjectEntityStateRepository } from '../persistence/projectEntityStateRepository';
import type { ProjectStateRepository } from '../persistence/projectStateRepository';
import type { ProjectStateTransitionRepository } from '../persistence/projectStateTransitionRepository';

/** A request to validate, but not perform, one Project state transition. */
export interface ValidateProjectTransitionRequest {
  projectId: EntityId;
  entityType: string;
  entityId: EntityId;
  labelId: EntityId;
  toProjectStateId: EntityId;
}

/** A caller-controlled, serializable explanation of an evaluator decision. */
export type ProjectTransitionEvidence = unknown;

export interface ProjectTransitionConditionEvaluationInput {
  request: Readonly<ValidateProjectTransitionRequest>;
  currentState: Readonly<ProjectEntityState>;
  transition: Readonly<ProjectStateTransition>;
  sourceState: Readonly<ProjectState>;
  destinationState: Readonly<ProjectState>;
  condition: string;
}

export interface ProjectTransitionExitCriteriaEvaluationInput {
  request: Readonly<ValidateProjectTransitionRequest>;
  currentState: Readonly<ProjectEntityState>;
  transition: Readonly<ProjectStateTransition>;
  sourceState: Readonly<ProjectState>;
  destinationState: Readonly<ProjectState>;
  /** Null remains meaningful: the evaluator owns the policy for absent criteria. */
  exitCriteria: string | null;
}

export interface ProjectTransitionEvaluationResult {
  passed: boolean;
  evidence?: ProjectTransitionEvidence;
}

export interface ProjectTransitionConditionEvaluator {
  evaluate(input: ProjectTransitionConditionEvaluationInput): Promise<ProjectTransitionEvaluationResult>;
}

export interface ProjectTransitionExitCriteriaEvaluator {
  evaluate(input: ProjectTransitionExitCriteriaEvaluationInput): Promise<ProjectTransitionEvaluationResult>;
}

export type ProjectTransitionRejectionReason =
  | 'unsupported_entity_type'
  | 'current_state_missing'
  | 'current_state_identity_mismatch'
  | 'source_state_missing'
  | 'source_state_archived'
  | 'source_state_identity_mismatch'
  | 'destination_state_missing'
  | 'destination_state_archived'
  | 'destination_state_identity_mismatch'
  | 'transition_missing'
  | 'transition_archived'
  | 'transition_ambiguous'
  | 'transition_identity_mismatch'
  | 'condition_evaluator_missing'
  | 'condition_false'
  | 'condition_evaluator_error'
  | 'exit_criteria_evaluator_missing'
  | 'exit_criteria_false'
  | 'exit_criteria_evaluator_error';

export interface ProjectTransitionAccepted {
  authorized: true;
  currentState: ProjectEntityState;
  transition: ProjectStateTransition;
  sourceState: ProjectState;
  destinationState: ProjectState;
  condition: ProjectTransitionEvaluationResult | null;
  exitCriteria: ProjectTransitionEvaluationResult | null;
}

export interface ProjectTransitionRejected {
  authorized: false;
  reason: ProjectTransitionRejectionReason;
  /** Evaluation evidence is preserved for callers that later record history. */
  evidence?: ProjectTransitionEvidence;
  /** Evaluator errors are reported without allowing a thrown error to mutate state. */
  error?: { name: string; message: string };
}

export type ProjectTransitionValidationResult =
  | ProjectTransitionAccepted
  | ProjectTransitionRejected;

export interface ProjectTransitionValidationServicePorts {
  entityStates: Pick<ProjectEntityStateRepository, 'findCurrent'>;
  states: Pick<ProjectStateRepository, 'getById'>;
  transitions: Pick<
    ProjectStateTransitionRepository,
    'listActiveOutgoingForState' | 'listOutgoingForState'
  >;
  conditionEvaluator?: ProjectTransitionConditionEvaluator;
  exitCriteriaEvaluator?: ProjectTransitionExitCriteriaEvaluator;
}

/**
 * Read-only authorization for Project transitions. Applying a successful
 * decision (ending and creating state periods) belongs to a later service so
 * every rejection leaves runtime state history untouched.
 */
export class ProjectTransitionValidationService {
  constructor(private readonly ports: ProjectTransitionValidationServicePorts) {}

  async validate(
    request: ValidateProjectTransitionRequest,
  ): Promise<ProjectTransitionValidationResult> {
    if (!isCoreEntityType(request.entityType)) return reject('unsupported_entity_type');
    const entityType = request.entityType;
    const context = { ...request, entityType };
    const currentState = await this.ports.entityStates.findCurrent(context);
    if (currentState === null) return reject('current_state_missing');
    const machine = machineOf(context);
    if (
      !sameMachine(currentState, machine) ||
      currentState.entityId !== request.entityId
    ) {
      return reject('current_state_identity_mismatch');
    }

    const sourceState = await this.ports.states.getById(currentState.projectStateId);
    if (sourceState === null) return reject('source_state_missing');
    if (sourceState.archivedAt !== null) return reject('source_state_archived');
    if (!sameMachine(sourceState, machine)) return reject('source_state_identity_mismatch');

    const destinationState = await this.ports.states.getById(request.toProjectStateId);
    if (destinationState === null) return reject('destination_state_missing');
    if (destinationState.archivedAt !== null) return reject('destination_state_archived');
    if (!sameMachine(destinationState, machine)) {
      return reject('destination_state_identity_mismatch');
    }

    const active = (await this.ports.transitions.listActiveOutgoingForState(
      machine,
      sourceState.id,
    )).filter((transition) => transition.toStateId === destinationState.id);
    if (active.length > 1) return reject('transition_ambiguous');
    if (active.length === 0) {
      const archived = (await this.ports.transitions.listOutgoingForState(
        machine,
        sourceState.id,
      )).filter(
        (transition) =>
          transition.toStateId === destinationState.id && transition.archivedAt !== null,
      );
      return reject(archived.length === 0 ? 'transition_missing' : 'transition_archived');
    }
    const transition = active[0];
    if (
      !sameMachine(transition, machine) ||
      transition.fromStateId !== sourceState.id ||
      transition.toStateId !== destinationState.id
    ) {
      return reject('transition_identity_mismatch');
    }

    let condition: ProjectTransitionEvaluationResult | null = null;
    if (transition.condition !== null) {
      if (this.ports.conditionEvaluator === undefined) return reject('condition_evaluator_missing');
      try {
        condition = await this.ports.conditionEvaluator.evaluate({
          request,
          currentState,
          transition,
          sourceState,
          destinationState,
          condition: transition.condition,
        });
      } catch (error) {
        return rejectEvaluatorError('condition_evaluator_error', error);
      }
      if (!condition.passed) return reject('condition_false', condition.evidence);
    }

    let exitCriteria: ProjectTransitionEvaluationResult | null = null;
    if (transition.requiresExitCriteria) {
      if (this.ports.exitCriteriaEvaluator === undefined) {
        return reject('exit_criteria_evaluator_missing');
      }
      try {
        exitCriteria = await this.ports.exitCriteriaEvaluator.evaluate({
          request,
          currentState,
          transition,
          sourceState,
          destinationState,
          exitCriteria: sourceState.exitCriteria,
        });
      } catch (error) {
        return rejectEvaluatorError('exit_criteria_evaluator_error', error);
      }
      if (!exitCriteria.passed) return reject('exit_criteria_false', exitCriteria.evidence);
    }

    return { authorized: true, currentState, transition, sourceState, destinationState, condition, exitCriteria };
  }
}

function machineOf(value: {
  projectId: EntityId;
  entityType: CoreEntityType;
  labelId: EntityId;
}): ProjectStateMachine {
  return { projectId: value.projectId, entityType: value.entityType, labelId: value.labelId };
}

function sameMachine(
  value: { projectId: EntityId; entityType: CoreEntityType; labelId: EntityId },
  machine: ProjectStateMachine,
): boolean {
  return value.projectId === machine.projectId && value.entityType === machine.entityType && value.labelId === machine.labelId;
}

function reject(
  reason: ProjectTransitionRejectionReason,
  evidence?: ProjectTransitionEvidence,
): ProjectTransitionRejected {
  return evidence === undefined ? { authorized: false, reason } : { authorized: false, reason, evidence };
}

function rejectEvaluatorError(
  reason: 'condition_evaluator_error' | 'exit_criteria_evaluator_error',
  error: unknown,
): ProjectTransitionRejected {
  if (error instanceof Error) return { authorized: false, reason, error: { name: error.name, message: error.message } };
  return { authorized: false, reason, error: { name: 'Error', message: String(error) } };
}
