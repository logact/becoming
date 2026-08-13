import { ResourceBalanceQueryService } from '../src/application/resourceBalanceQueryService';
import { ResourceBalanceUnitMismatchError } from '../src/domain/resourceBalance';
import { Quantity } from '../src/domain/quantity';

const hour = (amount: string) => Quantity.of(amount, 'hour');
const token = (amount: string) => Quantity.of(amount, 'token');

function balances(input: {
  budgets?: unknown[];
  projectAllocations?: unknown[];
  taskAllocations?: unknown[];
  projectUsage?: unknown[];
  taskUsage?: unknown[];
}) {
  const listHistory = jest.fn(async (query: { projectId?: string; taskId?: string }) =>
    query.taskId === undefined ? input.projectUsage ?? [] : input.taskUsage ?? []);
  const query = new ResourceBalanceQueryService({
    projectBudgets: {
      listActiveBudgetsForProject: jest.fn(async () => input.budgets ?? []),
    } as never,
    taskAllocations: {
      listActiveAllocationsForProject: jest.fn(async () => input.projectAllocations ?? []),
      listActiveAllocationsForTask: jest.fn(async () => input.taskAllocations ?? []),
    } as never,
    resourceUsage: {
      listHistory,
    } as never,
  });
  return { query, listHistory };
}

function usage(id: string, amount: Quantity, options: { projectId?: string; resourceId?: string; taskId?: string | null; corrections?: { id: string; amount: Quantity }[] } = {}) {
  const projectId = options.projectId ?? 'project';
  const resourceId = options.resourceId ?? 'hours';
  const taskId = options.taskId ?? null;
  return {
    original: { recordId: id, projectId, resourceId, taskId, amount },
    corrections: (options.corrections ?? []).map((correction) => ({
      recordId: correction.id, projectId, resourceId, taskId, amount: correction.amount,
    })),
    effectiveAmount: amount,
  };
}

describe('ResourceBalanceQueryService (#83)', () => {
  it('returns empty current Project and Task balance sets without inventing zero-resource rows', async () => {
    const { query } = balances({});
    await expect(query.listCurrentProjectBalances('project')).resolves.toEqual([]);
    await expect(query.listCurrentTaskBalances('task')).resolves.toEqual([]);
  });

  it('calculates exact multi-resource Project fields and counts project-only and Task-attributed usage once', async () => {
    const { query } = balances({
      budgets: [
        { relationId: 'budget-hours', projectId: 'project', resourceId: 'hours', amount: hour('1.25') },
        { relationId: 'budget-tokens', projectId: 'project', resourceId: 'tokens', amount: token('12.5') },
      ],
      projectAllocations: [
        { relationId: 'allocation-a', taskId: 'task-a', fundingProjectId: 'project', resourceId: 'hours', amount: hour('0.75') },
        { relationId: 'allocation-b', taskId: 'task-b', fundingProjectId: 'project', resourceId: 'hours', amount: hour('1') },
      ],
      projectUsage: [
        usage('project-use', hour('0.5')),
        usage('task-use', hour('1'), { taskId: 'task-a', corrections: [{ id: 'reversal', amount: hour('0.25') }] }),
        usage('token-use', token('2.75'), { resourceId: 'tokens' }),
      ],
    });

    const result = await query.listCurrentProjectBalances('project');
    expect(result.map((balance) => balance.resourceId)).toEqual(['hours', 'tokens']);
    const hours = result[0];
    expect(hours).toMatchObject({
      budgetRelationIds: ['budget-hours'], allocationRelationIds: ['allocation-a', 'allocation-b'],
      usageRecordIds: ['project-use', 'reversal', 'task-use'],
    });
    expect(hours.budgeted.toString()).toBe('1.25 hour');
    expect(hours.allocated.toString()).toBe('1.75 hour');
    expect(hours.unallocated.toString()).toBe('-0.5 hour');
    expect(hours.consumed.toString()).toBe('1.25 hour');
    expect(hours.remaining.toString()).toBe('0 hour');
    expect(result[1].remaining.toString()).toBe('9.75 token');
  });

  it('returns Task balances only for allocations and reconciles Task-attributed effective usage', async () => {
    const { query } = balances({
      taskAllocations: [
        { relationId: 'allocated-hours', taskId: 'task', fundingProjectId: 'project', resourceId: 'hours', amount: hour('1.5') },
      ],
      taskUsage: [
        usage('task-use', hour('2'), { taskId: 'task', corrections: [{ id: 'reverse', amount: hour('0.25') }] }),
        usage('unallocated-token-use', token('1'), { taskId: 'task', resourceId: 'tokens' }),
      ],
    });

    const [result] = await query.listCurrentTaskBalances('task');
    expect(result).toMatchObject({
      taskId: 'task', resourceId: 'hours', allocationRelationIds: ['allocated-hours'],
      usageRecordIds: ['reverse', 'task-use'],
    });
    expect(result.allocated.toString()).toBe('1.5 hour');
    expect(result.attributedConsumed.toString()).toBe('1.75 hour');
    expect(result.remaining.toString()).toBe('-0.25 hour');
  });

  it('propagates upstream malformed-reference failures and rejects corrupt unit mixtures deterministically', async () => {
    const { query: malformed, listHistory } = balances({});
    listHistory.mockRejectedValueOnce(new Error('Resource usage history integrity error for Record broken: Resource missing'));
    await expect(malformed.listCurrentProjectBalances('project')).rejects.toThrow(/integrity error/);

    const { query: mismatch } = balances({
      budgets: [{ relationId: 'budget', projectId: 'project', resourceId: 'hours', amount: hour('1') }],
      projectAllocations: [{ relationId: 'bad-allocation', taskId: 'task', fundingProjectId: 'project', resourceId: 'hours', amount: token('1') }],
    });
    await expect(mismatch.listCurrentProjectBalances('project')).rejects.toEqual(expect.objectContaining({
      name: ResourceBalanceUnitMismatchError.name, contributorIds: ['bad-allocation'],
    }));
  });
});
