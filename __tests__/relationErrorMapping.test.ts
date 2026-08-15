import {
  DecompositionCycleError,
  DecompositionNotFoundError,
  DecompositionGraphIntegrityError,
  DuplicateActiveDecompositionError,
} from '../src/application/decompositionService';
import {
  DuplicateActiveGoalPursuitError,
  GoalPursuitNotFoundError,
  ProjectGoalPursuitEndpointArchivedError,
  ProjectGoalPursuitEndpointNotFoundError,
} from '../src/application/projectGoalPursuitService';
import {
  DuplicateActiveRelationError,
  RelationAlreadyEndedError,
  RelationCycleError,
  RelationDirectionNotPermittedError,
  RelationEndpointNotFoundError,
  RelationNotFoundError,
  RelationPersistenceError,
  RelationProvenancePersistenceError,
  RelationTargetCardinalityError,
} from '../src/application/relationService';
import {
  DuplicateActiveTaskProjectMembershipError,
  TaskProjectMembershipEndpointArchivedError,
  TaskProjectMembershipEndpointNotFoundError,
  TaskProjectMembershipNotFoundError,
} from '../src/application/taskProjectMembershipService';
import {
  DecompositionDirectionError,
  DecompositionEndpointArchivedError,
  DecompositionEndpointNotFoundError,
  DecompositionMetadataPolicyError,
  DecompositionParentCardinalityError,
  DecompositionProjectArchivedError,
  DecompositionProjectContextError,
  DecompositionProjectNotFoundError,
  DecompositionSelfLinkError,
  DecompositionWorkflowGuidanceMissingError,
} from '../src/domain/decompositionPolicy';
import type { Relation } from '../src/domain/relation';
import { RelationMetadataPolicyError } from '../src/domain/relationPolicy';
import { mapRelationError, pickerHintForKind } from '../src/ui/relations';
import type { RelationErrorKind } from '../src/ui/relations';

const RELATION: Relation = {
  id: 'rel-1',
  sourceType: 'project',
  sourceId: 'p-1',
  relationType: 'contributes_to',
  targetType: 'goal',
  targetId: 'g-1',
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  endedAt: null,
};

interface Case {
  name: string;
  error: unknown;
  kind: RelationErrorKind;
  affected: 'source' | 'target' | 'candidate' | 'action' | 'unknown';
  retryable: boolean;
}

const CASES: Case[] = [
  // Missing source.
  {
    name: 'RelationEndpointNotFoundError (source)',
    error: new RelationEndpointNotFoundError('source', 'project', 'p-1'),
    kind: 'missing-source',
    affected: 'source',
    retryable: true,
  },
  {
    name: 'ProjectGoalPursuitEndpointNotFoundError (project)',
    error: new ProjectGoalPursuitEndpointNotFoundError('project', 'p-1'),
    kind: 'missing-source',
    affected: 'source',
    retryable: true,
  },
  {
    name: 'TaskProjectMembershipEndpointNotFoundError (task)',
    error: new TaskProjectMembershipEndpointNotFoundError('task', 't-1'),
    kind: 'missing-source',
    affected: 'source',
    retryable: true,
  },
  {
    name: 'DecompositionEndpointNotFoundError (parent)',
    error: new DecompositionEndpointNotFoundError('parent', 'goal', 'g-1'),
    kind: 'missing-source',
    affected: 'source',
    retryable: true,
  },
  // Missing target.
  {
    name: 'RelationEndpointNotFoundError (target)',
    error: new RelationEndpointNotFoundError('target', 'goal', 'g-1'),
    kind: 'missing-target',
    affected: 'target',
    retryable: true,
  },
  {
    name: 'ProjectGoalPursuitEndpointNotFoundError (goal)',
    error: new ProjectGoalPursuitEndpointNotFoundError('goal', 'g-1'),
    kind: 'missing-target',
    affected: 'target',
    retryable: true,
  },
  {
    name: 'TaskProjectMembershipEndpointNotFoundError (project)',
    error: new TaskProjectMembershipEndpointNotFoundError('project', 'p-1'),
    kind: 'missing-target',
    affected: 'target',
    retryable: true,
  },
  {
    name: 'DecompositionEndpointNotFoundError (child)',
    error: new DecompositionEndpointNotFoundError('child', 'task', 't-1'),
    kind: 'missing-target',
    affected: 'target',
    retryable: true,
  },
  {
    name: 'DecompositionProjectNotFoundError',
    error: new DecompositionProjectNotFoundError('p-1'),
    kind: 'missing-target',
    affected: 'target',
    retryable: true,
  },
  // Duplicate active relation.
  {
    name: 'DuplicateActiveRelationError',
    error: new DuplicateActiveRelationError(RELATION),
    kind: 'duplicate-active-relation',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DuplicateActiveGoalPursuitError',
    error: new DuplicateActiveGoalPursuitError(RELATION),
    kind: 'duplicate-active-relation',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DuplicateActiveTaskProjectMembershipError',
    error: new DuplicateActiveTaskProjectMembershipError(RELATION),
    kind: 'duplicate-active-relation',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DuplicateActiveDecompositionError',
    error: new DuplicateActiveDecompositionError(RELATION),
    kind: 'duplicate-active-relation',
    affected: 'candidate',
    retryable: true,
  },
  // Invalid direction.
  {
    name: 'RelationDirectionNotPermittedError',
    error: new RelationDirectionNotPermittedError('decomposes', 'task', 'goal'),
    kind: 'invalid-direction',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DecompositionDirectionError',
    error: new DecompositionDirectionError('task', 'goal'),
    kind: 'invalid-direction',
    affected: 'candidate',
    retryable: true,
  },
  // Invalid endpoint type (plain domain Error, message prefix is its identity).
  {
    name: 'Relation sourceType must be a core entity type',
    error: new Error('Relation sourceType must be a core entity type, got "label"'),
    kind: 'invalid-endpoint-type',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'Relation targetType must be a core entity type',
    error: new Error('Relation targetType must be a core entity type, got "label"'),
    kind: 'invalid-endpoint-type',
    affected: 'candidate',
    retryable: true,
  },
  // Cardinality violation.
  {
    name: 'RelationTargetCardinalityError',
    error: new RelationTargetCardinalityError(RELATION, 1),
    kind: 'cardinality-violation',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DecompositionParentCardinalityError',
    error: new DecompositionParentCardinalityError('p-1', 'task', 't-1'),
    kind: 'cardinality-violation',
    affected: 'candidate',
    retryable: true,
  },
  // Cycle.
  {
    name: 'RelationCycleError',
    error: new RelationCycleError(RELATION),
    kind: 'cycle',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DecompositionCycleError',
    error: new DecompositionCycleError('goal', 'g-1', 'goal', 'g-2'),
    kind: 'cycle',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DecompositionSelfLinkError',
    error: new DecompositionSelfLinkError('task', 't-1'),
    kind: 'cycle',
    affected: 'candidate',
    retryable: true,
  },
  // Archived endpoint.
  {
    name: 'ProjectGoalPursuitEndpointArchivedError',
    error: new ProjectGoalPursuitEndpointArchivedError('goal', 'g-1'),
    kind: 'archived-endpoint',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'TaskProjectMembershipEndpointArchivedError',
    error: new TaskProjectMembershipEndpointArchivedError('task', 't-1'),
    kind: 'archived-endpoint',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DecompositionEndpointArchivedError',
    error: new DecompositionEndpointArchivedError('child', 'task', 't-1'),
    kind: 'archived-endpoint',
    affected: 'candidate',
    retryable: true,
  },
  {
    name: 'DecompositionProjectArchivedError',
    error: new DecompositionProjectArchivedError('p-1'),
    kind: 'archived-endpoint',
    affected: 'candidate',
    retryable: true,
  },
  // Cross-Project structure.
  {
    name: 'DecompositionProjectContextError',
    error: new DecompositionProjectContextError('child', 'task', 't-1', 'p-1'),
    kind: 'cross-project-structure',
    affected: 'candidate',
    retryable: true,
  },
  // Remaining structured identities.
  {
    name: 'RelationNotFoundError',
    error: new RelationNotFoundError('rel-9'),
    kind: 'relation-not-found',
    affected: 'action',
    retryable: true,
  },
  {
    name: 'GoalPursuitNotFoundError',
    error: new GoalPursuitNotFoundError('rel-9'),
    kind: 'relation-not-found',
    affected: 'action',
    retryable: true,
  },
  {
    name: 'TaskProjectMembershipNotFoundError',
    error: new TaskProjectMembershipNotFoundError('rel-9'),
    kind: 'relation-not-found',
    affected: 'action',
    retryable: true,
  },
  {
    name: 'DecompositionNotFoundError',
    error: new DecompositionNotFoundError('rel-9'),
    kind: 'relation-not-found',
    affected: 'action',
    retryable: true,
  },
  {
    name: 'RelationAlreadyEndedError',
    error: new RelationAlreadyEndedError('rel-9'),
    kind: 'already-ended',
    affected: 'action',
    retryable: true,
  },
  {
    name: 'RelationMetadataPolicyError',
    error: new RelationMetadataPolicyError('lineage', 'metadata must be a JSON object'),
    kind: 'metadata-policy',
    affected: 'action',
    retryable: true,
  },
  {
    name: 'DecompositionMetadataPolicyError',
    error: new DecompositionMetadataPolicyError('metadata must be an object'),
    kind: 'metadata-policy',
    affected: 'action',
    retryable: true,
  },
  {
    name: 'DecompositionWorkflowGuidanceMissingError',
    error: new DecompositionWorkflowGuidanceMissingError(),
    kind: 'workflow-guidance',
    affected: 'action',
    retryable: false,
  },
  {
    name: 'DecompositionGraphIntegrityError',
    error: new DecompositionGraphIntegrityError('existing active cycle detected'),
    kind: 'integrity',
    affected: 'action',
    retryable: false,
  },
  {
    name: 'RelationPersistenceError',
    error: new RelationPersistenceError('create', 'rel-1', new Error('disk full')),
    kind: 'persistence',
    affected: 'action',
    retryable: true,
  },
  {
    name: 'RelationProvenancePersistenceError',
    error: new RelationProvenancePersistenceError('created', 'rel-1', new Error('disk full')),
    kind: 'persistence',
    affected: 'action',
    retryable: true,
  },
  // Unknown → safe fallback.
  {
    name: 'unrecognized Error',
    error: new Error('totally unexpected'),
    kind: 'unknown',
    affected: 'unknown',
    retryable: false,
  },
  {
    name: 'non-Error rejection',
    error: 'a plain string rejection',
    kind: 'unknown',
    affected: 'unknown',
    retryable: false,
  },
];

describe('mapRelationError', () => {
  it.each(CASES)('$name → $kind', ({ error, kind, affected, retryable }) => {
    const feedback = mapRelationError(error);
    expect(feedback.kind).toBe(kind);
    expect(feedback.affected).toBe(affected);
    expect(feedback.retryable).toBe(retryable);
    expect(feedback.title.trim().length).toBeGreaterThan(0);
    expect(feedback.explanation.trim().length).toBeGreaterThan(0);
  });

  it.each(CASES.filter((c) => c.error instanceof Error))(
    'preserves the structured identity of $name',
    ({ error }) => {
      const original = error as Error;
      const feedback = mapRelationError(error);
      expect(feedback.cause.name).toBe(original.name);
      expect(feedback.cause.message).toBe(original.message);
    },
  );

  it('never leaks unknown internals into the fallback presentation', () => {
    const feedback = mapRelationError(new Error('sqlite constraint SQLITE_XYZ at line 42'));
    expect(feedback.kind).toBe('unknown');
    expect(feedback.explanation).not.toContain('sqlite');
    expect(feedback.explanation).not.toContain('SQLITE_XYZ');
    expect(feedback.cause.message).toContain('SQLITE_XYZ');
  });
});

describe('pickerHintForKind', () => {
  it('uses the prototype picker language for the common rejections', () => {
    expect(pickerHintForKind('archived-endpoint')).toBe('Archived endpoint');
    expect(pickerHintForKind('duplicate-active-relation')).toBe('Duplicate active relationship');
    expect(pickerHintForKind('invalid-direction')).toBe('Invalid direction');
    expect(pickerHintForKind('cardinality-violation')).toBe('Already in this structure');
    expect(pickerHintForKind('cross-project-structure')).toBe('Cross-Project structure');
  });
});
