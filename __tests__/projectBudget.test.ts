import { createProject } from '../src/domain/project';
import {
  PROJECT_BUDGET_RELATION_TYPE,
  ProjectBudgetCapacityExceededError,
  ProjectBudgetReferenceNotFoundError,
  assessProjectBudgetCapacity,
  createProjectBudgetRelation,
  projectBudgetActiveIdentity,
  projectBudgetMetadata,
  projectBudgetQuantity,
  validateActiveProjectBudgetReferences,
  validateProjectBudgetHistory,
  validateProjectBudgetRelation,
} from '../src/domain/projectBudget';
import { createResource } from '../src/domain/resource';
import type { Relation } from '../src/domain/relation';

const CREATED = '2026-08-13T00:00:00.000Z';
const ENDED = '2026-08-13T01:00:00.000Z';

function fundingResource(capacity: string | null = '40') {
  return createResource({
    title: 'Development time', resourceType: 'time', unit: 'hour',
    ...(capacity === null ? {} : { capacity }),
  }, { id: 'resource-1', now: CREATED });
}

function budget(overrides: Partial<Parameters<typeof createProjectBudgetRelation>[0]> = {}) {
  return createProjectBudgetRelation({
    projectId: 'project-1', resourceId: 'resource-1', amount: '8', unit: 'hour',
    projectContext: 'delivery', capacityPolicy: 'reject',
    ...overrides,
  }, { id: 'budget-1', now: CREATED });
}

describe('Project budget relation contract', () => {
  it('builds the canonical project -> budgeted_by -> resource relation with exact metadata', () => {
    const relation = budget({ amount: '8.00', policyContext: { source: 'plan' } });

    expect(relation.sourceType).toBe('project');
    expect(relation.relationType).toBe(PROJECT_BUDGET_RELATION_TYPE);
    expect(relation.targetType).toBe('resource');
    expect(projectBudgetMetadata(relation.metadata)).toEqual({
      metadataVersion: 1, amount: '8', unit: 'hour', projectContext: 'delivery',
      capacityPolicy: 'reject', policyContext: { source: 'plan' },
    });
    expect(projectBudgetQuantity(relation).toString()).toBe('8 hour');
    expect(() => validateProjectBudgetRelation(relation, fundingResource())).not.toThrow();
  });

  it('rejects wrong direction, missing canonical metadata, non-positive amounts, and incompatible units', () => {
    expect(() => budget({ amount: '0' })).toThrow(/strictly positive/);
    expect(() => budget({ projectContext: ' ' })).toThrow(/projectContext/);
    expect(() => budget({ effectiveFrom: 'bad-date' })).toThrow(/effectiveFrom/);
    expect(() => validateProjectBudgetRelation(
      { ...budget(), sourceType: 'resource' }, fundingResource(),
    )).toThrow(/project -> budgeted_by -> resource/);
    expect(() => validateProjectBudgetRelation(
      budget({ unit: 'day' }), fundingResource(),
    )).toThrow(/incompatible/);
  });

  it('validates active logical Project and Resource references through a port', async () => {
    const relation = budget();
    await expect(validateActiveProjectBudgetReferences(relation, {
      isProjectActive: async (id) => id === relation.sourceId,
      isResourceActive: async (id) => id === relation.targetId,
    })).resolves.toBeUndefined();
    await expect(validateActiveProjectBudgetReferences(relation, {
      isProjectActive: async () => false,
      isResourceActive: async () => true,
    })).rejects.toBeInstanceOf(ProjectBudgetReferenceNotFoundError);
  });

  it('keys active identity by Project, Resource, and explicit context', () => {
    expect(projectBudgetActiveIdentity(budget())).toBe(projectBudgetActiveIdentity(
      budget({ amount: '9' }),
    ));
    expect(projectBudgetActiveIdentity(budget())).not.toBe(projectBudgetActiveIdentity(
      budget({ projectContext: 'contingency' }),
    ));
  });

  it('requires non-zero, non-overlapping temporal histories while allowing adjacent replacement', () => {
    const first = { ...budget(), endedAt: ENDED };
    const successor = createProjectBudgetRelation({
      projectId: 'project-1', resourceId: 'resource-1', amount: '10', unit: 'hour',
      projectContext: 'delivery', capacityPolicy: 'reject', effectiveFrom: ENDED,
    }, { id: 'budget-2', now: ENDED });
    expect(() => validateProjectBudgetHistory([first, successor], fundingResource())).not.toThrow();
    expect(() => validateProjectBudgetHistory([
      first,
      { ...successor, id: 'overlap', createdAt: CREATED, metadata: {
        ...projectBudgetMetadata(successor.metadata), effectiveFrom: '2026-08-13T00:30:00.000Z',
      } },
    ], fundingResource())).toThrow(/overlapping/);
    expect(() => validateProjectBudgetHistory([
      { ...budget(), endedAt: CREATED },
    ], fundingResource())).toThrow(/zero-length/);
    expect(() => validateProjectBudgetHistory([
      first,
      { ...successor, metadata: {
        ...projectBudgetMetadata(successor.metadata), projectContext: 'contingency',
      } },
    ], fundingResource())).toThrow(/one Project\/Resource\/context identity/);
  });

  it('returns deterministic finite-capacity outcomes and leaves unspecified capacity explicit', () => {
    const overSurface = budget({ amount: '41', capacityPolicy: 'surface' });
    expect(assessProjectBudgetCapacity(overSurface, fundingResource())).toMatchObject({
      status: 'exceeds_capacity', policy: 'surface',
    });
    expect(() => assessProjectBudgetCapacity(
      budget({ amount: '41', capacityPolicy: 'reject' }), fundingResource(),
    )).toThrow(ProjectBudgetCapacityExceededError);
    expect(assessProjectBudgetCapacity(budget(), fundingResource(null))).toMatchObject({
      status: 'capacity_unspecified', policy: 'reject',
    });
  });
});
