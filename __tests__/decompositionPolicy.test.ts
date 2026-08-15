import {
  DECOMPOSITION_RELATION_POLICY,
  DECOMPOSITION_RELATION_TYPE,
  DecompositionDirectionError,
  DecompositionEndpointArchivedError,
  DecompositionEndpointNotFoundError,
  DecompositionParentCardinalityError,
  DecompositionProjectArchivedError,
  DecompositionProjectContextError,
  DecompositionProjectNotFoundError,
  DecompositionSelfLinkError,
  DecompositionWorkflowGuidanceAmbiguousError,
  DecompositionWorkflowGuidanceArchivedError,
  DecompositionWorkflowGuidanceIncompatibleError,
  DecompositionWorkflowGuidanceMissingError,
  decompositionMetadata,
  readDecompositionMetadata,
  requireDecompositionWorkflowGuidance,
  validateProjectScopedDecomposition,
} from '../src/domain/decompositionPolicy';

const proposal = (overrides: Record<string, unknown> = {}) => ({
  relationType: DECOMPOSITION_RELATION_TYPE,
  parentType: 'goal' as const,
  parentId: 'parent-goal',
  childType: 'task' as const,
  childId: 'child-task',
  metadata: decompositionMetadata('project-1'),
  ...overrides,
});

function lookup(overrides: Record<string, unknown> = {}) {
  return {
    getProject: async () => ({ id: 'project-1', archivedAt: null }),
    getGoal: async (id: string) => ({ id, archivedAt: null }),
    getTask: async (id: string) => ({ id, archivedAt: null }),
    hasActiveGoalPursuit: async () => true,
    getActiveGoalPursuitProjectId: async () => null,
    isInProjectDecompositionTree: async () => false,
    hasActiveTaskProjectMembership: async () => true,
    hasActiveDecompositionParent: async () => false,
    ...overrides,
  };
}

describe('project-scoped decomposition policy', () => {
  it.each([
    ['goal', 'goal', true], ['goal', 'task', true], ['task', 'task', true],
    ['task', 'goal', false], ['goal', 'project', false], ['project', 'goal', false],
  ] as const)('allows exactly the documented %s -> %s matrix', (parentType, childType, allowed) => {
    expect(DECOMPOSITION_RELATION_POLICY.allowsDirection(parentType, childType)).toBe(allowed);
  });

  it('uses canonical direction, relation-owned Project context, and a strict metadata schema', () => {
    expect(DECOMPOSITION_RELATION_TYPE).toBe('decomposes');
    expect(readDecompositionMetadata(decompositionMetadata('project-1'))).toEqual({ schema_version: 1, project_id: 'project-1' });
    expect(() => readDecompositionMetadata({ schema_version: 1, project_id: 'project-1', extra: true })).toThrow(/unsupported/);
    expect(() => readDecompositionMetadata({ schema_version: 2, project_id: 'project-1' })).toThrow(/schema_version/);
    expect(() => DECOMPOSITION_RELATION_POLICY.validateMetadata(null)).toThrow(/metadata/);
  });

  it('accepts active same-Project Goal -> Task after logical pursuit/membership checks', async () => {
    await expect(validateProjectScopedDecomposition(proposal(), lookup())).resolves.toEqual(decompositionMetadata('project-1'));
  });

  it('rejects wrong relation type, unsupported/reversed direction, and self links distinctly', async () => {
    await expect(validateProjectScopedDecomposition(proposal({ relationType: 'related_to' }), lookup())).rejects.toThrow(/Expected decomposition/);
    await expect(validateProjectScopedDecomposition(proposal({ parentType: 'task', childType: 'goal' }), lookup())).rejects.toBeInstanceOf(DecompositionDirectionError);
    await expect(validateProjectScopedDecomposition(proposal({ parentType: 'goal', childType: 'goal', childId: 'parent-goal' }), lookup())).rejects.toBeInstanceOf(DecompositionSelfLinkError);
  });

  it('rejects missing or archived Project and typed endpoints distinctly', async () => {
    await expect(validateProjectScopedDecomposition(proposal(), lookup({ getProject: async () => null }))).rejects.toBeInstanceOf(DecompositionProjectNotFoundError);
    await expect(validateProjectScopedDecomposition(proposal(), lookup({ getProject: async () => ({ id: 'project-1', archivedAt: 'now' }) }))).rejects.toBeInstanceOf(DecompositionProjectArchivedError);
    await expect(validateProjectScopedDecomposition(proposal(), lookup({ getGoal: async () => null }))).rejects.toBeInstanceOf(DecompositionEndpointNotFoundError);
    await expect(validateProjectScopedDecomposition(proposal(), lookup({ getTask: async () => ({ id: 'child-task', archivedAt: 'now' }) }))).rejects.toBeInstanceOf(DecompositionEndpointArchivedError);
  });

  it('requires Project context on both endpoints and a free child parent slot', async () => {
    await expect(validateProjectScopedDecomposition(proposal(), lookup({ hasActiveGoalPursuit: async () => false }))).rejects.toBeInstanceOf(DecompositionProjectContextError);
    await expect(validateProjectScopedDecomposition(proposal(), lookup({ hasActiveTaskProjectMembership: async () => false }))).rejects.toBeInstanceOf(DecompositionProjectContextError);
    await expect(validateProjectScopedDecomposition(proposal(), lookup({ hasActiveDecompositionParent: async () => true }))).rejects.toBeInstanceOf(DecompositionParentCardinalityError);
  });

  it('lets an in-tree Goal parent sub-goals under strict 1:1 pursuit', async () => {
    const edge = proposal({ childType: 'goal', childId: 'child-goal' });
    // The pursued root Goal parents a sub-goal: only one pursuit exists.
    await expect(validateProjectScopedDecomposition(edge, lookup())).resolves.toEqual(decompositionMetadata('project-1'));
    // A sub-goal already in the tree parents further sub-goals without any pursuit of its own.
    const parentInTree = lookup({
      hasActiveGoalPursuit: async () => false,
      isInProjectDecompositionTree: async (_projectId: string, id: string) => id === 'parent-goal',
    });
    await expect(validateProjectScopedDecomposition(edge, parentInTree)).resolves.toEqual(decompositionMetadata('project-1'));
    // A parent Goal with neither pursuit nor tree context is still rejected.
    await expect(validateProjectScopedDecomposition(edge, lookup({ hasActiveGoalPursuit: async () => false }))).rejects.toBeInstanceOf(DecompositionProjectContextError);
  });

  it('rejects a child Goal actively pursued by a different Project', async () => {
    const edge = proposal({ childType: 'goal', childId: 'child-goal' });
    await expect(validateProjectScopedDecomposition(edge, lookup({ getActiveGoalPursuitProjectId: async () => 'project-2' }))).rejects.toBeInstanceOf(DecompositionProjectContextError);
    // Pursuit by the same Project (the pursued root itself) stays attachable.
    await expect(validateProjectScopedDecomposition(edge, lookup({ getActiveGoalPursuitProjectId: async () => 'project-1' }))).resolves.toEqual(decompositionMetadata('project-1'));
  });
});

describe('decomposition workflow guidance port', () => {
  const query = { projectId: 'project-1', purpose: 'decompose', parentType: 'goal' as const, childType: 'task' as const, managementLabelId: 'label-1', version: 2 };

  it('resolves only an exact valid workflow version without storing it on endpoints', async () => {
    const resolver = { resolve: async () => ({ status: 'resolved' as const, workflowId: 'workflow-v2', version: 2 }) };
    await expect(requireDecompositionWorkflowGuidance(query, resolver)).resolves.toEqual({ status: 'resolved', workflowId: 'workflow-v2', version: 2 });
  });

  it.each([
    ['missing', DecompositionWorkflowGuidanceMissingError],
    ['archived', DecompositionWorkflowGuidanceArchivedError],
    ['ambiguous', DecompositionWorkflowGuidanceAmbiguousError],
  ] as const)('surfaces %s resolution explicitly', async (status, error) => {
    const resolver = { resolve: async () => ({ status }) };
    await expect(requireDecompositionWorkflowGuidance(query, resolver)).rejects.toBeInstanceOf(error);
  });

  it('rejects incompatible and wrongly-versioned resolver outcomes', async () => {
    await expect(requireDecompositionWorkflowGuidance(query, { resolve: async () => ({ status: 'incompatible' as const, reason: 'wrong machine' }) })).rejects.toBeInstanceOf(DecompositionWorkflowGuidanceIncompatibleError);
    await expect(requireDecompositionWorkflowGuidance(query, { resolve: async () => ({ status: 'resolved' as const, workflowId: 'workflow-v1', version: 1 }) })).rejects.toBeInstanceOf(DecompositionWorkflowGuidanceIncompatibleError);
  });
});
