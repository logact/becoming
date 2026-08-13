import { createProjectBudgetRelation } from '../src/domain/projectBudget';
import { createResource } from '../src/domain/resource';
import {
  TASK_ALLOCATION_RELATION_TYPE,
  TaskAllocationOverBudgetError,
  TaskAllocationReferenceNotFoundError,
  assessTaskAllocationBudget,
  createTaskAllocationRelation,
  taskAllocationActiveIdentity,
  taskAllocationMetadata,
  taskAllocationQuantity,
  validateActiveTaskAllocationReferences,
  validateTaskAllocationHistory,
  validateTaskAllocationRelation,
} from '../src/domain/taskAllocation';

const CREATED = '2026-08-13T00:00:00.000Z';
const ENDED = '2026-08-13T01:00:00.000Z';

function resource() {
  return createResource({ title: 'Time', resourceType: 'time', unit: 'hour' }, { id: 'resource-1', now: CREATED });
}

function budget() {
  return createProjectBudgetRelation({
    projectId: 'project-1', resourceId: 'resource-1', amount: '10', unit: 'hour',
    projectContext: 'delivery', capacityPolicy: 'reject',
  }, { id: 'budget-1', now: CREATED });
}

function allocation(overrides: Partial<Parameters<typeof createTaskAllocationRelation>[0]> = {}) {
  return createTaskAllocationRelation({
    taskId: 'task-1', fundingProjectId: 'project-1', resourceId: 'resource-1',
    amount: '4', unit: 'hour', projectContext: 'delivery', overallocationPolicy: 'reject',
    ...overrides,
  }, { id: 'allocation-1', now: CREATED });
}

describe('Task allocation relation contract', () => {
  it('builds a canonical task -> allocated -> resource relation with a named funding budget context', () => {
    const relation = allocation({ amount: '4.00', policyContext: { reason: 'implementation' } });
    expect(relation).toMatchObject({ sourceType: 'task', relationType: TASK_ALLOCATION_RELATION_TYPE, targetType: 'resource' });
    expect(taskAllocationMetadata(relation.metadata)).toEqual({
      metadataVersion: 1, fundingProjectId: 'project-1', amount: '4', unit: 'hour',
      projectContext: 'delivery', overallocationPolicy: 'reject', policyContext: { reason: 'implementation' },
    });
    expect(taskAllocationQuantity(relation).toString()).toBe('4 hour');
    expect(() => validateTaskAllocationRelation(relation, resource())).not.toThrow();
  });

  it('requires exact positive quantity, direction, funding Project context, and compatible unit', () => {
    expect(() => allocation({ amount: '0' })).toThrow(/strictly positive/);
    expect(() => allocation({ fundingProjectId: ' ' })).toThrow(/fundingProjectId/);
    expect(() => allocation({ projectContext: ' ' })).toThrow(/projectContext/);
    expect(() => allocation({ overallocationPolicy: 'surface' as never })).toThrow(/overallocationPolicy/);
    expect(() => validateTaskAllocationRelation({ ...allocation(), sourceType: 'project' }, resource())).toThrow(/task -> allocated -> resource/);
    expect(() => validateTaskAllocationRelation(allocation({ unit: 'day' }), resource())).toThrow(/incompatible/);
  });

  it('uses Task/Project/Resource/context as the active temporal identity and permits adjacent supersession only', () => {
    const first = { ...allocation(), endedAt: ENDED };
    const successor = createTaskAllocationRelation({
      taskId: 'task-1', fundingProjectId: 'project-1', resourceId: 'resource-1', amount: '5', unit: 'hour',
      projectContext: 'delivery', overallocationPolicy: 'reject', effectiveFrom: ENDED,
    }, { id: 'allocation-2', now: ENDED });
    expect(taskAllocationActiveIdentity(first)).toBe(taskAllocationActiveIdentity(successor));
    expect(() => validateTaskAllocationHistory([first, successor], resource())).not.toThrow();
    expect(() => validateTaskAllocationHistory([first, {
      ...successor, id: 'overlap', createdAt: CREATED,
      metadata: { ...taskAllocationMetadata(successor.metadata), effectiveFrom: '2026-08-13T00:30:00.000Z' },
    }], resource())).toThrow(/overlapping/);
    expect(() => validateTaskAllocationHistory([{ ...allocation(), endedAt: CREATED }], resource())).toThrow(/zero-length/);
    expect(() => validateTaskAllocationHistory([first, allocation({ projectContext: 'contingency' })], resource())).toThrow(/one Task\/Project\/Resource\/context identity/);
  });

  it('requires active logical Task, funding Project, Resource, membership, and exactly named budget references', async () => {
    const relation = allocation();
    const lookup = {
      isTaskActive: async () => true, isProjectActive: async () => true, isResourceActive: async () => true,
      hasActiveTaskProjectMembership: async () => true,
      findActiveProjectBudget: async (projectId: string, resourceId: string, context: string) =>
        projectId === 'project-1' && resourceId === 'resource-1' && context === 'delivery' ? budget() : null,
    };
    await expect(validateActiveTaskAllocationReferences(relation, resource(), lookup)).resolves.toEqual(budget());
    await expect(validateActiveTaskAllocationReferences(relation, resource(), { ...lookup, hasActiveTaskProjectMembership: async () => false }))
      .rejects.toBeInstanceOf(TaskAllocationReferenceNotFoundError);
    await expect(validateActiveTaskAllocationReferences(relation, resource(), { ...lookup, findActiveProjectBudget: async () => budget() }))
      .resolves.toEqual(budget());
    await expect(validateActiveTaskAllocationReferences(allocation({ projectContext: 'contingency' }), resource(), lookup))
      .rejects.toBeInstanceOf(TaskAllocationReferenceNotFoundError);
  });

  it('returns explicit below, equal, and flagged-over budget outcomes while reject-over throws', () => {
    expect(assessTaskAllocationBudget(allocation({ amount: '4' }), [], budget(), resource())).toMatchObject({ status: 'below_budget', total: taskAllocationQuantity(allocation({ amount: '4' })) });
    expect(assessTaskAllocationBudget(allocation({ amount: '6' }), [allocation({ amount: '4' })], budget(), resource())).toMatchObject({ status: 'at_budget' });
    expect(assessTaskAllocationBudget(allocation({ amount: '7', overallocationPolicy: 'flag' }), [allocation({ amount: '4' })], budget(), resource())).toMatchObject({ status: 'over_budget', policy: 'flag' });
    expect(() => assessTaskAllocationBudget(allocation({ amount: '7' }), [allocation({ amount: '4' })], budget(), resource())).toThrow(TaskAllocationOverBudgetError);
  });

  it('will not assess an allocation against an unrelated or ended Project budget', () => {
    expect(() => assessTaskAllocationBudget(allocation(), [], createProjectBudgetRelation({
      projectId: 'project-other', resourceId: 'resource-1', amount: '10', unit: 'hour', projectContext: 'delivery', capacityPolicy: 'reject',
    }, { id: 'other-budget', now: CREATED }), resource())).toThrow(/explicitly named active compatible/);
    expect(() => assessTaskAllocationBudget(allocation(), [], { ...budget(), endedAt: ENDED }, resource())).toThrow(/explicitly named active compatible/);
  });
});
