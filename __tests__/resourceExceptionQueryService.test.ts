import { ResourceExceptionQueryService } from '../src/application/resourceExceptionQueryService';
import { Quantity } from '../src/domain/quantity';

const T0 = '2026-08-13T00:00:00.000Z';
const T1 = '2026-08-13T01:00:00.000Z';
const T2 = '2026-08-13T02:00:00.000Z';
const T3 = '2026-08-13T03:00:00.000Z';
const hour = (amount: string) => Quantity.of(amount, 'hour');

function service(input: {
  budgets?: Array<{ projectId: string; validFrom: string; validUntil: string | null }>;
  projects?: string[];
  allocations?: Array<{ fundingProjectId: string; taskId: string; validFrom: string; validUntil: string | null }>;
  usage?: unknown[];
  projectAt: (projectId: string, asOf: string) => unknown[];
  taskAt?: (projectId: string, taskId: string, asOf: string) => unknown[];
}) {
  return new ResourceExceptionQueryService({
    projectBudgets: { listBudgetHistory: jest.fn(async ({ projectId }) => (input.budgets ?? []).filter((entry) => entry.projectId === projectId)) } as never,
    taskAllocations: { listAllocationHistory: jest.fn(async () => input.allocations ?? []) } as never,
    resourceUsage: { listHistory: jest.fn(async () => input.usage ?? []) } as never,
    projects: { list: jest.fn(async () => (input.projects ?? ['p', 'other']).map((id) => ({ id }))) } as never,
    balances: {
      listProjectBalances: jest.fn(async (projectId: string, { asOf }: { asOf: string }) => input.projectAt(projectId, asOf)),
      listTaskBalancesForProject: jest.fn(async (projectId: string, taskId: string, { asOf }: { asOf: string }) => input.taskAt?.(projectId, taskId, asOf) ?? []),
    } as never,
    clock: { now: () => T3 },
  });
}

function project(overrides: Record<string, unknown> = {}) {
  return { projectId: 'p', resourceId: 'hours', unit: 'hour', budgeted: hour('10'), allocated: hour('10'),
    unallocated: hour('0'), consumed: hour('5'), remaining: hour('5'), budgetRelationIds: ['budget'], allocationRelationIds: ['allocation'], usageRecordIds: ['usage'], ...overrides };
}

function task(overrides: Record<string, unknown> = {}) {
  return { taskId: 'task', resourceId: 'hours', unit: 'hour', allocated: hour('2'), attributedConsumed: hour('1'),
    remaining: hour('1'), allocationRelationIds: ['allocation'], usageRecordIds: ['usage'], ...overrides };
}

describe('ResourceExceptionQueryService (#99)', () => {
  it('defaults to active exceptions and can include a resolved historical interval with its resolution snapshot trace', async () => {
    const query = service({
      budgets: [{ projectId: 'p', validFrom: T0, validUntil: null }],
      projects: ['p'],
      usage: [{ original: { projectId: 'p', taskId: null, record: { occurredAt: T1 } }, corrections: [{ record: { occurredAt: T2 } }] }],
      projectAt: (_projectId, asOf) => [project({ consumed: asOf < T2 ? hour('12') : hour('8'), remaining: asOf < T2 ? hour('-2') : hour('2') })],
    });
    await expect(query.list()).resolves.toEqual([]);
    const [resolved] = await query.list({ includeResolved: true });
    expect(resolved).toMatchObject({ type: 'project_exhausted', status: 'resolved', detectedAt: T0, evaluatedAt: T2, resolvedAt: T2 });
    expect(resolved.comparison.toString()).toBe('8 hour');
    expect(resolved.trace).toMatchObject({ asOf: T2, budgetRelationIds: ['budget'], usageRecordIds: ['usage'] });
    expect(resolved.trace.projectBalance?.consumed.toString()).toBe('8 hour');
  });

  it('filters exact project/resource/type/task contexts, keeps zero exhaustion, and applies stable pagination', async () => {
    const query = service({
      budgets: [{ projectId: 'p', validFrom: T0, validUntil: null }, { projectId: 'other', validFrom: T0, validUntil: null }],
      projects: ['p', 'other'],
      allocations: [{ fundingProjectId: 'p', taskId: 'task', validFrom: T0, validUntil: null }],
      projectAt: (projectId) => projectId === 'p'
        ? [project({ resourceId: 'hours', budgeted: hour('0'), allocated: hour('1'), consumed: hour('0'), remaining: hour('0') }), project({ resourceId: 'tokens', unit: 'token', budgeted: Quantity.of('2', 'token'), allocated: Quantity.of('3', 'token'), unallocated: Quantity.of('-1', 'token'), consumed: Quantity.of('0', 'token'), remaining: Quantity.of('2', 'token') })]
        : [project({ projectId: 'other', allocated: hour('12') })],
      taskAt: () => [task({ attributedConsumed: hour('3'), remaining: hour('-1') })],
    });
    const all = await query.list({ includeResolved: true });
    expect(all.map((entry) => entry.type)).toEqual(['project_exhausted', 'project_over_allocation', 'project_over_allocation', 'project_over_allocation', 'task_over_consumption']);
    await expect(query.list({ projectId: 'p', resourceId: 'hours', type: 'task_over_consumption', taskId: 'task' })).resolves.toHaveLength(1);
    await expect(query.list({ projectId: 'p', resourceId: 'hours', limit: 1, offset: 1 })).resolves.toEqual([all[2]]);
  });

  it('uses planning boundaries and maintains project/resource/unit partitions without manufacturing strict-over zero exceptions', async () => {
    const query = service({
      budgets: [{ projectId: 'p', validFrom: T0, validUntil: T2 }],
      projects: ['p'],
      projectAt: (_projectId, asOf) => asOf < T2
        ? [project({ resourceId: 'hours', budgeted: hour('0'), allocated: hour('0'), consumed: hour('0'), remaining: hour('0') })]
        : [],
    });
    const result = await query.list({ includeResolved: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'project_exhausted', status: 'resolved', detectedAt: T0, resolvedAt: T2, unit: 'hour' });
    expect(result[0]?.variance.toString()).toBe('0 hour');
  });
});
