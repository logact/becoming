import {
  ResourceBalanceUnitMismatchError,
  calculateProjectResourceBalances,
  calculateTaskResourceBalances,
  isBalanceRelationEffectiveAt,
  isBalanceUsageIncludedAt,
} from '../src/domain/resourceBalance';
import { Quantity } from '../src/domain/quantity';

const T0 = '2026-08-13T00:00:00.000Z';
const T1 = '2026-08-13T01:00:00.000Z';
const T2 = '2026-08-13T02:00:00.000Z';
const hour = (amount: string) => Quantity.of(amount, 'hour');

describe('resource balance semantics (#82)', () => {
  it('derives exact Project planned and actual fields without clamping negative exceptions', () => {
    const [balance] = calculateProjectResourceBalances({
      budgets: [{ relationId: 'budget-b', projectId: 'project', resourceId: 'time', amount: hour('1.25') }],
      allocations: [
        { relationId: 'allocation-z', taskId: 'task-2', fundingProjectId: 'project', resourceId: 'time', amount: hour('1') },
        { relationId: 'allocation-a', taskId: 'task-1', fundingProjectId: 'project', resourceId: 'time', amount: hour('0.75') },
      ],
      usage: [
        { recordId: 'usage-a', projectId: 'project', resourceId: 'time', taskId: 'task-1', amount: hour('1.5'), aggregationEffect: 1 },
        { recordId: 'correction-a', projectId: 'project', resourceId: 'time', taskId: 'task-1', amount: hour('0.25'), aggregationEffect: -1 },
      ],
    });
    expect(balance).toMatchObject({ projectId: 'project', resourceId: 'time', unit: 'hour', budgetRelationIds: ['budget-b'], allocationRelationIds: ['allocation-a', 'allocation-z'], usageRecordIds: ['correction-a', 'usage-a'] });
    expect(balance.budgeted.toString()).toBe('1.25 hour');
    expect(balance.allocated.toString()).toBe('1.75 hour');
    expect(balance.unallocated.toString()).toBe('-0.5 hour');
    expect(balance.consumed.toString()).toBe('1.25 hour');
    expect(balance.remaining.toString()).toBe('0 hour');
  });

  it('keeps task-attributed actual usage distinct from project-only usage and retains correction contributors', () => {
    const [balance] = calculateTaskResourceBalances({
      allocations: [{ relationId: 'allocation', taskId: 'task', fundingProjectId: 'project', resourceId: 'time', amount: hour('2') }],
      usage: [
        { recordId: 'task-use', projectId: 'project', resourceId: 'time', taskId: 'task', amount: hour('2.5'), aggregationEffect: 1 },
        { recordId: 'project-use', projectId: 'project', resourceId: 'time', taskId: null, amount: hour('99'), aggregationEffect: 1 },
        { recordId: 'reverse', projectId: 'project', resourceId: 'time', taskId: 'task', amount: hour('0.25'), aggregationEffect: -1 },
      ],
    });
    expect(balance.attributedConsumed.toString()).toBe('2.25 hour');
    expect(balance.remaining.toString()).toBe('-0.25 hour');
    expect(balance.usageRecordIds).toEqual(['reverse', 'task-use']);
  });

  it('partitions resource identities and rejects incompatible units instead of converting or combining them', () => {
    const balances = calculateProjectResourceBalances({
      budgets: [
        { relationId: 'time', projectId: 'project', resourceId: 'time', amount: hour('1') },
        { relationId: 'token', projectId: 'project', resourceId: 'token', amount: Quantity.of('10', 'token') },
      ], allocations: [], usage: [],
    });
    expect(balances.map((balance) => balance.resourceId)).toEqual(['time', 'token']);
    expect(() => calculateProjectResourceBalances({
      budgets: [{ relationId: 'budget', projectId: 'project', resourceId: 'time', amount: hour('1') }],
      allocations: [{ relationId: 'broken', taskId: 'task', fundingProjectId: 'project', resourceId: 'time', amount: Quantity.of('1', 'day') }], usage: [],
    })).toThrow(ResourceBalanceUnitMismatchError);
  });

  it('uses half-open relation validity and inclusive occurrence-time boundaries', () => {
    expect(isBalanceRelationEffectiveAt({ validFrom: T0, validUntil: T1 }, T0)).toBe(true);
    expect(isBalanceRelationEffectiveAt({ validFrom: T0, validUntil: T1 }, T1)).toBe(false);
    expect(isBalanceUsageIncludedAt(T1, T1)).toBe(true);
    expect(isBalanceUsageIncludedAt(T2, T1)).toBe(false);
  });
});
