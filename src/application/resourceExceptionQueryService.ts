import type { EntityId, IsoTimestamp } from '../domain/ids';
import { createResourceException } from '../domain/resourceException';
import type { ResourceException, ResourceExceptionStatus, ResourceExceptionType } from '../domain/resourceException';
import type { ProjectResourceBalance, TaskResourceBalance } from '../domain/resourceBalance';
import type { ProjectBudgetQueryService } from './projectBudgetQueryService';
import type { ResourceBalanceQueryService } from './resourceBalanceQueryService';
import type { ResourceUsageQueryService } from './resourceUsageQueryService';
import type { TaskAllocationQueryService } from './taskAllocationQueryService';
import type { ProjectRepository } from '../persistence/projectRepository';
import type { Clock } from './recordService';
import { systemClock } from './recordService';

/** A reproducible balance selection and the immutable facts that explain it. */
export interface ResourceExceptionTrace {
  asOf: IsoTimestamp;
  projectBalance: ProjectResourceBalance | null;
  taskBalance: TaskResourceBalance | null;
  budgetRelationIds: readonly EntityId[];
  allocationRelationIds: readonly EntityId[];
  usageRecordIds: readonly EntityId[];
}

/**
 * A derived exception interval. `detectedAt` is the first selected snapshot
 * in which the stable identity was active; `resolvedAt` is the first later
 * snapshot in which it was not.  A null resolution means it remains active
 * at `evaluatedAt`.  No interval is persisted or allowed to mutate sources.
 */
export interface ResourceExceptionQueryResult extends ResourceException {
  detectedAt: IsoTimestamp;
  evaluatedAt: IsoTimestamp;
  resolvedAt: IsoTimestamp | null;
  trace: ResourceExceptionTrace;
}

export interface ResourceExceptionQuery {
  projectId?: EntityId;
  resourceId?: EntityId;
  type?: ResourceExceptionType;
  taskId?: EntityId;
  /** Defaults to one clock snapshot, so the default response is current. */
  asOf?: IsoTimestamp;
  /** Retain identities that occurred before `asOf` but have since resolved. */
  includeResolved?: boolean;
  /** Stable offset pagination after filtering. */
  limit?: number;
  offset?: number;
}

export interface ResourceExceptionQueryServicePorts {
  balances: Pick<ResourceBalanceQueryService, 'listProjectBalances' | 'listTaskBalancesForProject'>;
  projectBudgets: Pick<ProjectBudgetQueryService, 'listBudgetHistory'>;
  taskAllocations: Pick<TaskAllocationQueryService, 'listAllocationHistory'>;
  resourceUsage: Pick<ResourceUsageQueryService, 'listHistory'>;
  /** Historical exceptions retain archived Projects as valid source contexts. */
  projects: Pick<ProjectRepository, 'list'>;
  clock?: Clock;
}

/**
 * Read-only current and historical exception projection.  History is folded
 * from the exact temporal boundaries consumed by #84, not from a mutable
 * incident table: planning interval starts/ends and original/correction
 * occurrence instants each produce an ordered balance snapshot.
 */
export class ResourceExceptionQueryService {
  private readonly clock: Clock;

  constructor(private readonly ports: ResourceExceptionQueryServicePorts) {
    this.clock = ports.clock ?? systemClock;
  }

  async list(query: ResourceExceptionQuery = {}): Promise<ResourceExceptionQueryResult[]> {
    assertQuery(query);
    const asOf = query.asOf ?? this.clock.now();
    const [projects, allocations, usage] = await Promise.all([
      this.ports.projects.list({ status: 'all' }), this.ports.taskAllocations.listAllocationHistory({}), this.listAllUsage(),
    ]);
    const projectIds = new Set<string>();
    for (const project of projects) projectIds.add(project.id);
    for (const allocation of allocations) projectIds.add(allocation.fundingProjectId);
    for (const item of usage) projectIds.add(item.original.projectId);
    if (query.projectId !== undefined) projectIds.add(query.projectId);
    const budgets = (await Promise.all([...projectIds].map((projectId) =>
      this.ports.projectBudgets.listBudgetHistory({ projectId })))).flat();

    const taskContexts = new Set<string>();
    for (const allocation of allocations) taskContexts.add(contextKey(allocation.fundingProjectId, allocation.taskId));
    for (const item of usage) {
      if (item.original.taskId !== null) taskContexts.add(contextKey(item.original.projectId, item.original.taskId));
    }
    if (query.projectId !== undefined && query.taskId !== undefined) taskContexts.add(contextKey(query.projectId, query.taskId));

    const snapshots = snapshotInstants(asOf, budgets, allocations, usage);
    const states = new Map<string, TrackedException>();
    for (const instant of snapshots) {
      const evaluated = await this.evaluateSnapshot(
        instant,
        [...projectIds].filter((id) => query.projectId === undefined || id === query.projectId),
        [...taskContexts].map(parseContext).filter((context) =>
          (query.projectId === undefined || context.projectId === query.projectId) &&
          (query.taskId === undefined || context.taskId === query.taskId)),
        query.resourceId,
      );
      const evaluatedByIdentity = new Map(evaluated.map((entry) => [entry.exception.identity, entry]));
      const active = evaluated.filter((entry) => entry.exception.status === 'active');
      const activeByIdentity = new Map(active.map((entry) => [entry.exception.identity, entry]));
      for (const [identity, state] of states) {
        if (state.resolvedAt === null && !activeByIdentity.has(identity)) {
          state.resolvedAt = instant;
          const resolution = evaluatedByIdentity.get(identity);
          if (resolution !== undefined) {
            state.evaluation = resolution;
            state.evaluatedAt = instant;
          }
        }
      }
      for (const evaluation of active) {
        const previous = states.get(evaluation.exception.identity);
        if (previous === undefined) {
          states.set(evaluation.exception.identity, { evaluation, detectedAt: instant, evaluatedAt: instant, resolvedAt: null });
        } else if (previous.resolvedAt !== null) {
          // Stable identities can recur after a correction or a new plan. The
          // current interval replaces an older resolved interval of the same identity.
          states.set(evaluation.exception.identity, { evaluation, detectedAt: instant, evaluatedAt: instant, resolvedAt: null });
        } else {
          previous.evaluation = evaluation;
          previous.evaluatedAt = instant;
        }
      }
    }

    return [...states.values()]
      .filter((state) => query.includeResolved === true || state.resolvedAt === null)
      .map((state) => toResult(state))
      .filter((entry) => query.type === undefined || entry.type === query.type)
      .filter((entry) => query.resourceId === undefined || entry.resourceId === query.resourceId)
      .filter((entry) => query.taskId === undefined || entry.taskId === query.taskId)
      .sort(compareResults)
      .slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 100));
  }

  private async evaluateSnapshot(
    asOf: IsoTimestamp,
    projectIds: string[],
    taskContexts: Array<{ projectId: string; taskId: string }>,
    resourceId: EntityId | undefined,
  ): Promise<ExceptionEvaluation[]> {
    const projectBalances = (await Promise.all(projectIds.map((projectId) =>
      this.ports.balances.listProjectBalances(projectId, { asOf, resourceId })))).flat();
    const taskBalances = (await Promise.all(taskContexts.map(async (context) => ({
      projectId: context.projectId,
      balances: await this.ports.balances.listTaskBalancesForProject(context.projectId, context.taskId, { asOf, resourceId }),
    })))).flatMap((context) => context.balances.map((balance) => ({ projectId: context.projectId, balance })));
    return deriveAll(projectBalances, taskBalances, asOf);
  }

  private async listAllUsage() {
    const all = [] as Awaited<ReturnType<ResourceUsageQueryService['listHistory']>>;
    for (let offset = 0;; offset += 100) {
      const page = await this.ports.resourceUsage.listHistory({ limit: 100, offset });
      all.push(...page);
      if (page.length < 100) return all;
    }
  }
}

interface TrackedException {
  evaluation: ExceptionEvaluation;
  detectedAt: IsoTimestamp;
  evaluatedAt: IsoTimestamp;
  resolvedAt: IsoTimestamp | null;
}

interface ExceptionEvaluation {
  exception: ResourceException;
  projectBalance: ProjectResourceBalance | null;
  taskBalance: TaskResourceBalance | null;
}

function deriveAll(
  projectBalances: readonly ProjectResourceBalance[],
  taskBalances: ReadonlyArray<{ projectId: EntityId; balance: TaskResourceBalance }>,
  asOf: IsoTimestamp,
): ExceptionEvaluation[] {
  const result: ExceptionEvaluation[] = [];
  for (const balance of projectBalances) {
    result.push({ exception: createResourceException({ type: 'project_over_allocation', projectId: balance.projectId, resourceId: balance.resourceId,
      planned: balance.budgeted, comparison: balance.allocated, asOf,
      contributorIds: { budgetRelationIds: balance.budgetRelationIds, allocationRelationIds: balance.allocationRelationIds, usageRecordIds: [] } }), projectBalance: balance, taskBalance: null });
    result.push({ exception: createResourceException({ type: 'project_exhausted', projectId: balance.projectId, resourceId: balance.resourceId,
      planned: balance.budgeted, comparison: balance.consumed, asOf,
      contributorIds: { budgetRelationIds: balance.budgetRelationIds, allocationRelationIds: [], usageRecordIds: balance.usageRecordIds } }), projectBalance: balance, taskBalance: null });
  }
  for (const context of taskBalances) result.push({ exception: createResourceException({ type: 'task_over_consumption', projectId: context.projectId,
    resourceId: context.balance.resourceId, taskId: context.balance.taskId, planned: context.balance.allocated,
    comparison: context.balance.attributedConsumed, asOf,
    contributorIds: { budgetRelationIds: [], allocationRelationIds: context.balance.allocationRelationIds, usageRecordIds: context.balance.usageRecordIds } }), projectBalance: null, taskBalance: context.balance });
  return result;
}

function toResult(state: TrackedException): ResourceExceptionQueryResult {
  const status: ResourceExceptionStatus = state.resolvedAt === null ? 'active' : 'resolved';
  const exception = { ...state.evaluation.exception, status };
  return {
    ...exception, detectedAt: state.detectedAt, evaluatedAt: state.evaluatedAt, resolvedAt: state.resolvedAt,
    trace: { asOf: state.evaluatedAt, projectBalance: state.evaluation.projectBalance,
      taskBalance: state.evaluation.taskBalance, ...exception.contributorIds },
  };
}

function snapshotInstants(asOf: IsoTimestamp, budgets: readonly { validFrom: IsoTimestamp; validUntil: IsoTimestamp | null }[], allocations: readonly { validFrom: IsoTimestamp; validUntil: IsoTimestamp | null }[], usage: readonly { original: { record: { occurredAt: IsoTimestamp } }; corrections: readonly { record: { occurredAt: IsoTimestamp } }[] }[]): IsoTimestamp[] {
  const max = Date.parse(asOf);
  const instants = new Set<IsoTimestamp>([asOf]);
  for (const source of [...budgets, ...allocations]) {
    if (Date.parse(source.validFrom) <= max) instants.add(source.validFrom);
    if (source.validUntil !== null && Date.parse(source.validUntil) <= max) instants.add(source.validUntil);
  }
  for (const item of usage) for (const occurrence of [item.original, ...item.corrections]) {
    if (Date.parse(occurrence.record.occurredAt) <= max) instants.add(occurrence.record.occurredAt);
  }
  return [...instants].sort((left, right) => left.localeCompare(right));
}

function compareResults(left: ResourceExceptionQueryResult, right: ResourceExceptionQueryResult): number {
  const severity = (left.severity === 'critical' ? 0 : 1) - (right.severity === 'critical' ? 0 : 1);
  if (severity !== 0) return severity;
  const type = left.type.localeCompare(right.type);
  if (type !== 0) return type;
  const resource = left.resourceId.localeCompare(right.resourceId);
  if (resource !== 0) return resource;
  const task = (left.taskId ?? '').localeCompare(right.taskId ?? '');
  return task === 0 ? left.projectId.localeCompare(right.projectId) : task;
}

function contextKey(projectId: string, taskId: string): string { return `${projectId}\u0000${taskId}`; }
function parseContext(key: string): { projectId: string; taskId: string } {
  const [projectId, taskId] = key.split('\u0000');
  return { projectId: projectId!, taskId: taskId! };
}

function assertQuery(query: ResourceExceptionQuery): void {
  for (const [name, value] of Object.entries({ projectId: query.projectId, resourceId: query.resourceId, taskId: query.taskId })) {
    if (value !== undefined && value.trim().length === 0) throw new Error(`Resource exception query ${name} must not be blank`);
  }
  if (query.asOf !== undefined && (query.asOf.trim().length === 0 || Number.isNaN(Date.parse(query.asOf)))) throw new Error('Resource exception query asOf must be a valid ISO 8601 timestamp');
  if (query.type !== undefined && !['project_over_allocation', 'project_exhausted', 'task_over_consumption'].includes(query.type)) throw new Error('Resource exception query type is invalid');
  if (!Number.isInteger(query.limit ?? 100) || (query.limit ?? 100) < 1) throw new Error('Resource exception query limit must be a positive integer');
  if (!Number.isInteger(query.offset ?? 0) || (query.offset ?? 0) < 0) throw new Error('Resource exception query offset must be a non-negative integer');
}
