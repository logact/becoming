import {
  ResourceExceptionUnitMismatchError,
  createResourceException,
  isResourceExceptionActive,
  resourceExceptionIdentity,
  resourceExceptionStatus,
} from '../src/domain/resourceException';
import { Quantity } from '../src/domain/quantity';

const T0 = '2026-08-13T00:00:00.000Z';
const hour = (amount: string) => Quantity.of(amount, 'hour');
const trace = { budgetRelationIds: ['budget-b', 'budget-a', 'budget-a'], allocationRelationIds: ['allocation'], usageRecordIds: ['usage-b', 'usage-a'] };

describe('resource exception semantics (#97)', () => {
  it.each([
    ['project_over_allocation', '0.5', '0.49', false],
    ['project_over_allocation', '0.5', '0.5', false],
    ['project_over_allocation', '0.5', '0.51', true],
    ['project_exhausted', '0.5', '0.49', false],
    ['project_exhausted', '0.5', '0.5', true],
    ['project_exhausted', '0.5', '0.51', true],
    ['task_over_consumption', '0.5', '0.49', false],
    ['task_over_consumption', '0.5', '0.5', false],
    ['task_over_consumption', '0.5', '0.51', true],
  ] as const)('%s has an exact threshold at fractional planned %s and comparison %s', (type, planned, comparison, expected) => {
    expect(isResourceExceptionActive(type, hour(planned), hour(comparison))).toBe(expected);
  });

  it('treats a zero budget with zero consumption as exhausted, but not as either strict-over condition', () => {
    expect(isResourceExceptionActive('project_exhausted', hour('0'), hour('0'))).toBe(true);
    expect(isResourceExceptionActive('project_over_allocation', hour('0'), hour('0'))).toBe(false);
    expect(isResourceExceptionActive('task_over_consumption', hour('0'), hour('0'))).toBe(false);
  });

  it('creates a deterministic active exception with exact signed variance and contributor trace', () => {
    const exception = createResourceException({
      type: 'project_over_allocation', projectId: 'project', resourceId: 'time',
      planned: hour('1.25'), comparison: hour('1.5'), asOf: T0, contributorIds: trace,
    });
    expect(exception).toMatchObject({
      type: 'project_over_allocation', status: 'active', projectId: 'project', taskId: null,
      unit: 'hour', identity: 'project_over_allocation\u0000project\u0000time\u0000',
      contributorIds: { budgetRelationIds: ['budget-a', 'budget-b'], allocationRelationIds: ['allocation'], usageRecordIds: ['usage-a', 'usage-b'] },
    });
    expect(exception.planned.toString()).toBe('1.25 hour');
    expect(exception.comparison.toString()).toBe('1.5 hour');
    expect(exception.variance.toString()).toBe('0.25 hour');
  });

  it('uses a task-scoped stable identity and calculates resolved status from a later safe snapshot', () => {
    const identity = resourceExceptionIdentity({ type: 'task_over_consumption', projectId: 'project', resourceId: 'time', taskId: 'task' });
    expect(identity).toBe('task_over_consumption\u0000project\u0000time\u0000task');
    const resolved = createResourceException({
      type: 'task_over_consumption', projectId: 'project', resourceId: 'time', taskId: 'task',
      planned: hour('2'), comparison: hour('1.75'), asOf: T0, contributorIds: trace,
    });
    expect(resolved.status).toBe('resolved');
    expect(resourceExceptionStatus('task_over_consumption', hour('2'), hour('1.75'))).toBe('resolved');
    expect(resolved.variance.toString()).toBe('-0.25 hour');
  });

  it('rejects incompatible units before comparing and requires the correct scope identity', () => {
    expect(() => isResourceExceptionActive('project_exhausted', hour('1'), Quantity.of('1', 'token'))).toThrow(ResourceExceptionUnitMismatchError);
    expect(() => resourceExceptionIdentity({ type: 'task_over_consumption', projectId: 'project', resourceId: 'time', taskId: null })).toThrow(/requires a taskId/);
    expect(() => resourceExceptionIdentity({ type: 'project_exhausted', projectId: 'project', resourceId: 'time', taskId: 'task' })).toThrow(/must not include a taskId/);
  });
});
