/**
 * Reusable presentation mapping for semantic-relation failures (issue #133).
 *
 * The application and domain layers stay authoritative for relation validity:
 * Goal pursuit (`projectGoalPursuitService`), Task membership
 * (`taskProjectMembershipService`), decomposition (`decompositionService` and
 * `domain/decompositionPolicy`), and the general Relation pipeline
 * (`relationService` and `domain/relation`/`relationPolicy`) reject invalid
 * mutations with structured errors. This module only translates those errors
 * into consistent, actionable presentation — it never decides validity.
 *
 * The same mapping drives both picker-time hints (`pickerHintForKind`) and
 * commit-time feedback (`mapRelationError`), so the language a user sees next
 * to an unavailable choice matches the language of the "Change not allowed"
 * sheet when commit-time validation still rejects it.
 */

/**
 * The failure categories this module distinguishes. The first ten are the
 * acceptance-scenario categories; the rest cover the remaining structured
 * identities the services produce. `unknown` is the safe fallback.
 */
export type RelationErrorKind =
  | 'missing-source'
  | 'missing-target'
  | 'duplicate-active-relation'
  | 'invalid-direction'
  | 'invalid-endpoint-type'
  | 'cardinality-violation'
  | 'cycle'
  | 'archived-endpoint'
  | 'cross-project-structure'
  | 'relation-not-found'
  | 'already-ended'
  | 'metadata-policy'
  | 'workflow-guidance'
  | 'integrity'
  | 'persistence'
  | 'unknown';

/** Which side of the attempted action the feedback points at. */
export type RelationErrorAffected =
  | 'source'
  | 'target'
  | 'candidate'
  | 'action'
  | 'unknown';

export interface RelationErrorFeedback {
  kind: RelationErrorKind;
  /** Short heading shown inside the commit-time feedback sheet. */
  title: string;
  /** Actionable explanation: what happened and what the user can do next. */
  explanation: string;
  /** The action or candidate this feedback is about. */
  affected: RelationErrorAffected;
  /**
   * Whether retrying can plausibly succeed after the user corrects the
   * choice/input, refreshes stale endpoints, or simply retries a transient
   * failure. False for integrity, guidance, and unknown failures.
   */
  retryable: boolean;
  /**
   * The original structured error identity, preserved verbatim for logs and
   * tests. Never used to render; presentation uses the fields above.
   */
  cause: { name: string; message: string };
}

interface KindPresentation {
  title: string;
  explanation: string;
  affected: RelationErrorAffected;
  retryable: boolean;
  /** Short picker-row reason for unavailable candidates (prototype language). */
  pickerHint: string;
}

const PRESENTATION: Record<RelationErrorKind, KindPresentation> = {
  'missing-source': {
    title: 'Starting point not found',
    explanation:
      'The item this connection starts from no longer exists. Refresh the choices and pick again.',
    affected: 'source',
    retryable: true,
    pickerHint: 'No longer available',
  },
  'missing-target': {
    title: 'Target not found',
    explanation:
      'The item you chose no longer exists. Refresh the choices and pick again.',
    affected: 'target',
    retryable: true,
    pickerHint: 'No longer available',
  },
  'duplicate-active-relation': {
    title: 'Already connected',
    explanation:
      'This active relationship already exists. Pick another choice, or end the existing relationship first.',
    affected: 'candidate',
    retryable: true,
    pickerHint: 'Duplicate active relationship',
  },
  'invalid-direction': {
    title: 'Direction not allowed',
    explanation:
      'This relationship only works in one direction. Choose a target that is valid for it.',
    affected: 'candidate',
    retryable: true,
    pickerHint: 'Invalid direction',
  },
  'invalid-endpoint-type': {
    title: 'Type not supported',
    explanation:
      'This kind of item cannot take part in this relationship. Choose a supported item.',
    affected: 'candidate',
    retryable: true,
    pickerHint: 'Unsupported item type',
  },
  'cardinality-violation': {
    title: 'Already placed',
    explanation:
      'This item already has an active placement here. End the existing one before adding another.',
    affected: 'candidate',
    retryable: true,
    pickerHint: 'Already in this structure',
  },
  cycle: {
    title: 'Would create a loop',
    explanation:
      'This connection would make an item its own ancestor. Choose an item outside this branch.',
    affected: 'candidate',
    retryable: true,
    pickerHint: 'Would create a cycle',
  },
  'archived-endpoint': {
    title: 'Archived item',
    explanation:
      'An archived item cannot start new relationships. Pick an active item instead.',
    affected: 'candidate',
    retryable: true,
    pickerHint: 'Archived endpoint',
  },
  'cross-project-structure': {
    title: 'Outside this Project',
    explanation:
      'This item has no active context in this Project. Connect it to the Project first.',
    affected: 'candidate',
    retryable: true,
    pickerHint: 'Cross-Project structure',
  },
  'relation-not-found': {
    title: 'Relationship not found',
    explanation:
      'This relationship is no longer available. Refresh and try again.',
    affected: 'action',
    retryable: true,
    pickerHint: 'No longer available',
  },
  'already-ended': {
    title: 'Already ended',
    explanation:
      'This relationship has already ended and cannot be replaced. Create a new one instead.',
    affected: 'action',
    retryable: true,
    pickerHint: 'No longer active',
  },
  'metadata-policy': {
    title: 'Details not accepted',
    explanation:
      'The relationship details were rejected. Correct them and try again.',
    affected: 'action',
    retryable: true,
    pickerHint: 'Unavailable',
  },
  'workflow-guidance': {
    title: 'Workflow guidance unavailable',
    explanation:
      'No applicable workflow guidance governs this change right now, so nothing was changed.',
    affected: 'action',
    retryable: false,
    pickerHint: 'Unavailable',
  },
  integrity: {
    title: 'Structure needs inspection',
    explanation:
      'The existing structure could not be validated safely, so nothing was changed.',
    affected: 'action',
    retryable: false,
    pickerHint: 'Unavailable',
  },
  persistence: {
    title: 'Save failed',
    explanation:
      'The change could not be saved and was rolled back. Nothing was committed; you can retry.',
    affected: 'action',
    retryable: true,
    pickerHint: 'Unavailable',
  },
  unknown: {
    title: 'Change not allowed',
    explanation:
      'This change could not be completed. Nothing was saved — your current screen and draft remain unchanged.',
    affected: 'unknown',
    retryable: false,
    pickerHint: 'Unavailable',
  },
};

/**
 * The structured error identities (`error.name`) produced by the relation
 * services and domain policies, mapped to presentation kinds. Endpoint-role
 * refinements (`missing-source` vs `missing-target`) read the structured
 * `endpoint`/`role` fields the error classes carry.
 */
function classify(error: Error): RelationErrorKind {
  const endpoint = readStringField(error, 'endpoint');
  const role = readStringField(error, 'role');
  switch (error.name) {
    // src/application/relationService.ts
    case 'RelationEndpointNotFoundError': {
      // This class does not retain `endpoint`; its message prefix is the
      // remaining structured identity.
      const which =
        endpoint ??
        (error.message.startsWith('Relation source endpoint') ? 'source' : 'target');
      return which === 'source' ? 'missing-source' : 'missing-target';
    }
    case 'DuplicateActiveRelationError':
      return 'duplicate-active-relation';
    case 'RelationDirectionNotPermittedError':
      return 'invalid-direction';
    case 'RelationCycleError':
      return 'cycle';
    case 'RelationTargetCardinalityError':
      return 'cardinality-violation';
    case 'RelationNotFoundError':
      return 'relation-not-found';
    case 'RelationAlreadyEndedError':
      return 'already-ended';
    case 'RelationPersistenceError':
    case 'RelationProvenancePersistenceError':
      return 'persistence';
    // src/application/projectGoalPursuitService.ts (Project -> contributes_to -> Goal)
    case 'ProjectGoalPursuitEndpointNotFoundError':
      return endpoint === 'project' ? 'missing-source' : 'missing-target';
    case 'ProjectGoalPursuitEndpointArchivedError':
      return 'archived-endpoint';
    case 'DuplicateActiveGoalPursuitError':
      return 'duplicate-active-relation';
    case 'ProjectAlreadyPursuesGoalError':
    case 'GoalAlreadyPursuedByProjectError':
      return 'cardinality-violation';
    case 'GoalPursuitNotFoundError':
      return 'relation-not-found';
    // src/application/taskProjectMembershipService.ts (Task -> belongs_to -> Project)
    case 'TaskProjectMembershipEndpointNotFoundError':
      return endpoint === 'task' ? 'missing-source' : 'missing-target';
    case 'TaskProjectMembershipEndpointArchivedError':
      return 'archived-endpoint';
    case 'DuplicateActiveTaskProjectMembershipError':
      return 'duplicate-active-relation';
    case 'TaskProjectMembershipNotFoundError':
      return 'relation-not-found';
    // src/application/decompositionService.ts
    case 'DuplicateActiveDecompositionError':
      return 'duplicate-active-relation';
    case 'DecompositionCycleError':
      return 'cycle';
    case 'DecompositionNotFoundError':
      return 'relation-not-found';
    case 'DecompositionGraphIntegrityError':
      return 'integrity';
    // src/domain/decompositionPolicy.ts (parent -> decomposes -> child)
    case 'DecompositionEndpointNotFoundError':
      return role === 'parent' ? 'missing-source' : 'missing-target';
    case 'DecompositionEndpointArchivedError':
    case 'DecompositionProjectArchivedError':
      return 'archived-endpoint';
    case 'DecompositionDirectionError':
      return 'invalid-direction';
    case 'DecompositionSelfLinkError':
      return 'cycle';
    case 'DecompositionProjectContextError':
      return 'cross-project-structure';
    case 'DecompositionParentCardinalityError':
      return 'cardinality-violation';
    case 'DecompositionProjectNotFoundError':
      return 'missing-target';
    case 'DecompositionMetadataPolicyError':
    case 'RelationMetadataPolicyError':
      return 'metadata-policy';
    case 'DecompositionWorkflowGuidanceMissingError':
    case 'DecompositionWorkflowGuidanceArchivedError':
    case 'DecompositionWorkflowGuidanceAmbiguousError':
    case 'DecompositionWorkflowGuidanceIncompatibleError':
      return 'workflow-guidance';
    default:
      break;
  }
  // src/domain/relation.ts raises plain Errors for aggregate violations;
  // their message prefix is the only structured identity available.
  if (
    error.message.startsWith('Relation sourceType must be a core entity type') ||
    error.message.startsWith('Relation targetType must be a core entity type')
  ) {
    return 'invalid-endpoint-type';
  }
  // RelationCycleError and RelationTargetCardinalityError do not set `name`;
  // their message shapes are the remaining structured identity.
  if (
    error.message.startsWith('Lineage relation ') &&
    error.message.endsWith(' would create a cycle')
  ) {
    return 'cycle';
  }
  if (
    error.message.startsWith('Relation type ') &&
    error.message.includes(' active relation(s) targeting ')
  ) {
    return 'cardinality-violation';
  }
  return 'unknown';
}

function readStringField(error: Error, field: string): string | undefined {
  const value = (error as unknown as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Translate any thrown relation-mutation error into presentation feedback.
 * Unknown errors (including non-Error rejections) map to the safe fallback:
 * a generic message that never leaks internals and always states that
 * nothing was saved.
 */
export function mapRelationError(error: unknown): RelationErrorFeedback {
  const cause =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: 'UnknownError', message: String(error) };
  const kind = error instanceof Error ? classify(error) : 'unknown';
  const presentation = PRESENTATION[kind];
  return {
    kind,
    title: presentation.title,
    explanation: presentation.explanation,
    affected: presentation.affected,
    retryable: presentation.retryable,
    cause,
  };
}

/**
 * The short picker-row reason for an unavailable candidate of a given kind.
 * Driven by the same presentation table as commit-time feedback, so a
 * candidate rejected at commit time repeats the language its row showed.
 */
export function pickerHintForKind(kind: RelationErrorKind): string {
  return PRESENTATION[kind].pickerHint;
}
