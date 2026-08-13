import { createResource } from '../src/domain/resource';
import {
  ResourceUsageReferenceNotFoundError,
  createResourceUsageRecord,
  createResourceUsageReversal,
  resourceUsagePayload,
  validateActiveResourceUsageReferences,
  validateResourceUsageEntry,
  validateResourceUsageHistory,
} from '../src/domain/resourceUsage';

const NOW = '2026-08-13T00:00:00.000Z';
const resource = () => createResource({ title: 'Time', resourceType: 'time', unit: 'hour' }, { id: 'resource-1', now: NOW });
const usage = (overrides: Partial<Parameters<typeof createResourceUsageRecord>[0]> = {}) => createResourceUsageRecord({
  description: 'Implemented the usage contract', occurredAt: NOW, recordedAt: NOW, actor: 'worker',
  projectId: 'project-1', resourceId: 'resource-1', amount: '1.50', unit: 'hour', taskId: 'task-1',
  executionContext: { run: 'local' }, ...overrides,
}, { record: { id: 'usage-1', now: NOW }, projectRelation: { id: 'usage-project', now: NOW }, resourceRelation: { id: 'usage-resource', now: NOW }, taskRelation: { id: 'usage-task', now: NOW } });

describe('resource usage record contract', () => {
  it('creates a positive exact resource_usage Record with Project, Resource, Task and execution links', () => {
    const entry = usage();
    expect(entry.record).toMatchObject({ id: 'usage-1', recordType: 'resource_usage', actor: 'worker', occurredAt: NOW, recordedAt: NOW });
    expect(resourceUsagePayload(entry.record.payload)).toEqual({ metadataVersion: 1, amount: '1.5', unit: 'hour', projectId: 'project-1', resourceId: 'resource-1', taskId: 'task-1', aggregationEffect: 1, executionContext: { run: 'local' } });
    expect(entry.projectRelation).toMatchObject({ sourceType: 'record', relationType: 'belongs_to', targetType: 'project', targetId: 'project-1' });
    expect(entry.resourceRelation).toMatchObject({ relationType: 'consumes', targetType: 'resource', targetId: 'resource-1' });
    expect(entry.taskRelation).toMatchObject({ targetType: 'task', targetId: 'task-1' });
    expect(() => validateResourceUsageEntry(entry, resource())).not.toThrow();
  });

  it('requires positive exact amounts, unit compatibility, actor, and all required facts', () => {
    expect(() => usage({ amount: '0' })).toThrow(/strictly positive/);
    expect(() => usage({ amount: '-1' })).toThrow(/strictly positive/);
    expect(() => usage({ unit: 'day' })).not.toThrow();
    expect(() => validateResourceUsageEntry(usage({ unit: 'day' }), resource())).toThrow(/incompatible/);
    expect(() => usage({ actor: ' ' })).toThrow(/actor/);
    expect(() => usage({ projectId: ' ' })).toThrow(/projectId/);
  });

  it('keeps Task attribution and planned contexts optional', () => {
    const entry = usage({ taskId: undefined, executionContext: undefined, plannedContext: { projectBudgetContext: 'delivery' } });
    expect(entry.taskRelation).toBeNull();
    expect(resourceUsagePayload(entry.record.payload)).toMatchObject({ plannedContext: { projectBudgetContext: 'delivery' } });
    expect(() => validateResourceUsageEntry(entry, resource())).not.toThrow();
  });

  it('validates active Project, Resource, optional Task membership, and named planned references through ports', async () => {
    const entry = usage({ plannedContext: { projectBudgetContext: 'delivery', taskAllocationContext: 'delivery' } });
    const lookup = {
      isProjectActive: async () => true, isResourceActive: async () => true, isTaskActive: async () => true,
      hasActiveTaskProjectMembership: async () => true, hasActiveProjectBudget: async () => true, hasActiveTaskAllocation: async () => true,
    };
    await expect(validateActiveResourceUsageReferences(entry, resource(), lookup)).resolves.toBeUndefined();
    await expect(validateActiveResourceUsageReferences(entry, resource(), { ...lookup, hasActiveTaskProjectMembership: async () => false })).rejects.toBeInstanceOf(ResourceUsageReferenceNotFoundError);
    await expect(validateActiveResourceUsageReferences(entry, resource(), { ...lookup, isResourceActive: async () => false })).rejects.toBeInstanceOf(ResourceUsageReferenceNotFoundError);
    await expect(validateActiveResourceUsageReferences(entry, resource(), { ...lookup, hasActiveProjectBudget: async () => false })).rejects.toBeInstanceOf(ResourceUsageReferenceNotFoundError);
  });

  it('appends a reversal without mutating the original, with an explicit negative aggregation effect', () => {
    const original = usage();
    const reversal = createResourceUsageReversal({ description: 'Undo duplicate entry', occurredAt: NOW, recordedAt: NOW, actor: 'worker', corrects: original }, {
      record: { id: 'reversal-1', now: NOW }, projectRelation: { id: 'reversal-project', now: NOW }, resourceRelation: { id: 'reversal-resource', now: NOW }, taskRelation: { id: 'reversal-task', now: NOW }, correctionRelation: { id: 'reversal-correction', now: NOW },
    });
    expect(original.record.recordType).toBe('resource_usage');
    expect(reversal.record).toMatchObject({ recordType: 'correction' });
    expect(resourceUsagePayload(reversal.record.payload)).toMatchObject({ aggregationEffect: -1, correctsRecordId: 'usage-1', amount: '1.5' });
    expect(reversal.correctionRelation).toMatchObject({ targetType: 'record', targetId: 'usage-1' });
    expect(() => validateResourceUsageHistory([original, reversal], resource())).not.toThrow();
  });

  it('rejects ambiguous double replacement, self correction, and correction cycles', () => {
    const original = usage();
    const reversal = createResourceUsageReversal({ description: 'Undo', occurredAt: NOW, recordedAt: NOW, actor: 'worker', corrects: original }, { record: { id: 'reversal-1', now: NOW } });
    const withId = (entry: typeof reversal, id: string, target: string) => ({
      ...entry,
      record: { ...entry.record, id, payload: { ...resourceUsagePayload(entry.record.payload), correctsRecordId: target } },
      projectRelation: { ...entry.projectRelation, sourceId: id },
      resourceRelation: { ...entry.resourceRelation, sourceId: id },
      taskRelation: entry.taskRelation === null ? null : { ...entry.taskRelation, sourceId: id },
      correctionRelation: entry.correctionRelation === null ? null : { ...entry.correctionRelation, sourceId: id, targetId: target },
    });
    const duplicate = withId(reversal, 'reversal-2', 'usage-1');
    expect(() => validateResourceUsageHistory([original, reversal, duplicate], resource())).toThrow(/double replacement/);
    const self = withId(reversal, 'reversal-1', 'reversal-1');
    expect(() => validateResourceUsageHistory([original, self], resource())).toThrow(/itself/);
    const first = withId(reversal, 'a', 'b');
    const second = withId(reversal, 'b', 'a');
    expect(() => validateResourceUsageHistory([first, second], resource())).toThrow(/cycle/);
  });
});
