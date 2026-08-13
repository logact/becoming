import { Quantity } from '../src/domain/quantity';
import type { ProjectResourceBalance, TaskResourceBalance } from '../src/domain/resourceBalance';
import { ResourceExceptionUnitMismatchError } from '../src/domain/resourceException';
import {
  evaluateResourceExceptions,
  type ResourceExceptionPolicy,
} from '../src/domain/resourceExceptionEvaluator';

const T0 = '2026-08-13T00:00:00.000Z';
const hour = (amount: string) => Quantity.of(amount, 'hour');

function project(overrides: Partial<ProjectResourceBalance> = {}): ProjectResourceBalance {
  const budgeted = overrides.budgeted ?? hour('10');
  const allocated = overrides.allocated ?? hour('10');
  const consumed = overrides.consumed ?? hour('5');
  return {
    projectId: 'project', resourceId: 'time', unit: 'hour', budgeted, allocated,
    unallocated: budgeted.subtract(allocated), consumed, remaining: budgeted.subtract(consumed),
    budgetRelationIds: ['budget'], allocationRelationIds: ['allocation'], usageRecordIds: ['usage'],
    ...overrides,
  };
}

function task(overrides: Partial<TaskResourceBalance> = {}): TaskResourceBalance {
  const allocated = overrides.allocated ?? hour('5');
  const attributedConsumed = overrides.attributedConsumed ?? hour('5');
  return {
    taskId: 'task', resourceId: 'time', unit: 'hour', allocated, attributedConsumed,
    remaining: allocated.subtract(attributedConsumed), allocationRelationIds: ['allocation'], usageRecordIds: ['usage'],
    ...overrides,
  };
}

describe('resource exception evaluator (#98)', () => {
  it('derives simultaneous Project conditions and an independent Task condition with exact traces', () => {
    const result = evaluateResourceExceptions({
      asOf: T0,
      projectBalances: [project({ budgeted: hour('1.25'), allocated: hour('1.5'), consumed: hour('1.75') })],
      taskBalances: [{ projectId: 'project', balance: task({ allocated: hour('1.5'), attributedConsumed: hour('1.75') }) }],
    });
    expect(result.map((entry) => entry.type)).toEqual([
      'project_exhausted', 'project_over_allocation', 'task_over_consumption',
    ]);
    expect(result.map((entry) => [entry.severity, entry.planned.toString(), entry.comparison.toString(), entry.variance.toString()])).toEqual([
      ['critical', '1.25 hour', '1.75 hour', '0.5 hour'],
      ['warning', '1.25 hour', '1.5 hour', '0.25 hour'],
      ['warning', '1.5 hour', '1.75 hour', '0.25 hour'],
    ]);
    expect(result.map((entry) => entry.contributorIds)).toEqual([
      { budgetRelationIds: ['budget'], allocationRelationIds: [], usageRecordIds: ['usage'] },
      { budgetRelationIds: ['budget'], allocationRelationIds: ['allocation'], usageRecordIds: [] },
      { budgetRelationIds: [], allocationRelationIds: ['allocation'], usageRecordIds: ['usage'] },
    ]);
  });

  it('honours equality and zero boundaries without manufacturing strict-over exceptions', () => {
    expect(evaluateResourceExceptions({
      asOf: T0, projectBalances: [project({ budgeted: hour('0'), allocated: hour('0'), consumed: hour('0') })],
      taskBalances: [{ projectId: 'project', balance: task({ allocated: hour('0'), attributedConsumed: hour('0') }) }],
    }).map((entry) => entry.type)).toEqual(['project_exhausted']);
    expect(evaluateResourceExceptions({
      asOf: T0, projectBalances: [project()], taskBalances: [{ projectId: 'project', balance: task() }],
    })).toEqual([]);
  });

  it('partitions multiple Resources and Tasks, orders them deterministically, and deduplicates identity', () => {
    const overTime = project({ resourceId: 'time', budgeted: hour('1'), allocated: hour('2'), consumed: hour('1') });
    const overToken = project({ resourceId: 'token', unit: 'token', budgeted: Quantity.of('3', 'token'), allocated: Quantity.of('4', 'token'), unallocated: Quantity.of('-1', 'token'), consumed: Quantity.of('0', 'token'), remaining: Quantity.of('3', 'token'), budgetRelationIds: ['token-budget'] });
    const taskA = task({ taskId: 'a', allocated: hour('0.1'), attributedConsumed: hour('0.2') });
    const taskB = task({ taskId: 'b', allocated: hour('0.2'), attributedConsumed: hour('0.3') });
    const result = evaluateResourceExceptions({
      asOf: T0, projectBalances: [overToken, overTime, overTime],
      taskBalances: [{ projectId: 'project', balance: taskB }, { projectId: 'project', balance: taskA }],
    });
    expect(result.map((entry) => entry.identity)).toEqual([
      'project_exhausted\u0000project\u0000time\u0000',
      'project_over_allocation\u0000project\u0000time\u0000',
      'project_over_allocation\u0000project\u0000token\u0000',
      'task_over_consumption\u0000project\u0000time\u0000a',
      'task_over_consumption\u0000project\u0000time\u0000b',
    ]);
  });

  it('rejects incompatible summary units before comparing and performs no source writes', () => {
    const source: ProjectResourceBalance = {
      projectId: 'project', resourceId: 'time', unit: 'hour', budgeted: hour('10'),
      allocated: Quantity.of('2', 'day'), unallocated: hour('8'), consumed: hour('5'), remaining: hour('5'),
      budgetRelationIds: ['budget'], allocationRelationIds: ['allocation'], usageRecordIds: ['usage'],
    };
    expect(() => evaluateResourceExceptions({ asOf: T0, projectBalances: [source], taskBalances: [] }))
      .toThrow(ResourceExceptionUnitMismatchError);

    const safeProject = project();
    const safeTask = task();
    const before = snapshot({ safeProject, safeTask });
    evaluateResourceExceptions({ asOf: T0, projectBalances: [safeProject], taskBalances: [{ projectId: 'project', balance: safeTask }] });
    expect(snapshot({ safeProject, safeTask })).toBe(before);
  });

  it('defaults to informational detection but lets a command boundary reject an active exception', () => {
    expect(evaluateResourceExceptions({
      asOf: T0, projectBalances: [project({ allocated: hour('11') })], taskBalances: [],
    })).toHaveLength(1);
    const reject: ResourceExceptionPolicy = (exception) => { throw new Error(`reject ${exception.identity}`); };
    expect(() => evaluateResourceExceptions({
      asOf: T0, projectBalances: [project({ allocated: hour('11') })], taskBalances: [], policy: reject,
    })).toThrow(/reject project_over_allocation/);
  });
});

function snapshot(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
}
