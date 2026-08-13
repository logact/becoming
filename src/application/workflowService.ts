import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  archiveWorkflow,
  createWorkflow,
  createWorkflowVersion,
  publishWorkflow,
  updateWorkflowDraft,
} from '../domain/workflow';
import type { Workflow, WorkflowDraftChanges } from '../domain/workflow';
import type { EntitySnapshot } from '../domain/mutationProvenance';
import type { RecordRepository } from '../persistence/recordRepository';
import type { WorkflowRepository } from '../persistence/workflowRepository';
import { MutationProvenanceService } from './mutationProvenanceService';
import { systemClock, uuidGenerator } from './recordService';
import type { Clock, IdGenerator } from './recordService';
import type { UnitOfWork } from './unitOfWork';
import { WorkflowNotFoundError } from './workflowStateService';

/**
 * Application boundary for discovering Workflow definitions and mutating them
 * under provenance.
 *
 * The service depends only on framework-neutral ports — a `Clock`, an
 * `IdGenerator`, a `UnitOfWork`, Workflow/Record repository factories bound
 * to the unit-of-work context, and a plain read repository — so the same
 * behavior runs under any UI, HTTP, or persistence framework (or none at
 * all).
 *
 * Discovery semantics:
 * - `listActive` returns active versions only; `listHistory` is the explicit
 *   historical lookup and includes archived versions. Both follow the
 *   repository's deterministic order (highest version first, ties broken by
 *   creation time, then id).
 * - `discover` resolves exactly ONE active definition for application: with a
 *   `version` it is an exact match, without one it is the highest active
 *   version. Zero matches return `{ kind: 'missing' }`; more than one match
 *   (duplicate active rows of the same type, purpose, and version) returns
 *   `{ kind: 'ambiguous' }` with the candidates — an arbitrary pick is never
 *   made. Archived versions are never eligible for `discover`; they stay
 *   resolvable only through the explicit `discoverInHistory` lookup.
 *
 * Provenance semantics: every mutation command (create, draft update,
 * publish, new version, archive) routes through `MutationProvenanceService`,
 * so the Workflow change and its provenance Record commit in the same unit
 * of work or roll back together — in both failure directions. Snapshots are
 * plain field spreads; the default `workflow` field policy allowlists exactly
 * the definition fields, so payloads carry relevant non-sensitive data only.
 * Snapshots are read before the transaction opens through `readWorkflows`;
 * the write itself goes through the `workflows` factory bound to the
 * transaction context.
 */

/** Query for the active-definition listings. */
export interface WorkflowListingQuery {
  workflowType: string;
  purpose?: string;
}

/** Query for resolving one definition; `version` means exact match. */
export interface WorkflowDiscoveryQuery extends WorkflowListingQuery {
  version?: number;
}

/** Query for the historical lookup over active and archived versions. */
export interface WorkflowHistoryDiscoveryQuery extends WorkflowListingQuery {
  version: number;
}

/**
 * Result of resolving one Workflow definition. `missing` and `ambiguous` are
 * explicit outcomes — discovery never selects arbitrarily.
 */
export type WorkflowDiscovery =
  | { kind: 'found'; workflow: Workflow }
  | { kind: 'missing' }
  | { kind: 'ambiguous'; candidates: Workflow[] };

/** Command for defining a new root Workflow draft. */
export interface CreateWorkflowDefinitionCommand {
  actor: string;
  title: string;
  workflowType: string;
  description?: string;
  purpose?: string;
  entryCriteria?: string;
  exitCriteria?: string;
  occurredAt?: IsoTimestamp;
}

export interface WorkflowServicePorts<TContext> {
  unitOfWork: UnitOfWork<TContext>;
  /** Bind a Workflow repository to the unit-of-work context. */
  workflows: (context: TContext) => WorkflowRepository;
  /** Bind a Record repository to the unit-of-work context. */
  records: (context: TContext) => RecordRepository;
  /**
   * Read path for loading the current row before the transaction opens —
   * `mutateWithProvenance` needs its before/after snapshots up front.
   */
  readWorkflows: WorkflowRepository;
  clock?: Clock;
  ids?: IdGenerator;
}

export class WorkflowService<TContext> {
  private readonly workflows: (context: TContext) => WorkflowRepository;
  private readonly readWorkflows: WorkflowRepository;
  private readonly clock: Clock;
  private readonly provenance: MutationProvenanceService<TContext>;

  constructor(ports: WorkflowServicePorts<TContext>) {
    this.workflows = ports.workflows;
    this.readWorkflows = ports.readWorkflows;
    this.clock = ports.clock ?? systemClock;
    this.provenance = new MutationProvenanceService<TContext>({
      unitOfWork: ports.unitOfWork,
      records: ports.records,
      clock: this.clock,
      ids: ports.ids ?? uuidGenerator,
    });
  }

  /**
   * Return the active Workflow versions matching the query in deterministic
   * order (highest version first, ties broken by creation time, then id).
   */
  async listActive(query: WorkflowListingQuery): Promise<Workflow[]> {
    return this.readWorkflows.list(query);
  }

  /**
   * Return the full definition history matching the query — active and
   * archived — in the same deterministic order, so archived versions stay
   * inspectable.
   */
  async listHistory(query: WorkflowListingQuery): Promise<Workflow[]> {
    return this.readWorkflows.list({ ...query, includeArchived: true });
  }

  /**
   * Resolve exactly one ACTIVE definition for application. With `version` the
   * match is exact; without it the highest active version wins. No match
   * returns `{ kind: 'missing' }`; duplicate active matches return
   * `{ kind: 'ambiguous' }`. Archived versions are never eligible.
   */
  async discover(query: WorkflowDiscoveryQuery): Promise<WorkflowDiscovery> {
    const active = await this.listActive(query);
    if (query.version !== undefined) {
      return this.resolve(active.filter((w) => w.version === query.version));
    }
    if (active.length === 0) {
      return { kind: 'missing' };
    }
    const highest = active[0].version;
    return this.resolve(active.filter((w) => w.version === highest));
  }

  /**
   * Resolve one definition — active or archived — by exact version, so
   * archived versions stay resolvable for historical inspection. Same
   * missing/ambiguous rules as `discover`.
   */
  async discoverInHistory(
    query: WorkflowHistoryDiscoveryQuery,
  ): Promise<WorkflowDiscovery> {
    const history = await this.listHistory(query);
    return this.resolve(history.filter((w) => w.version === query.version));
  }

  /**
   * Define a new root Workflow draft with provenance. Returns the stored
   * aggregate. Throws a domain error for invalid fields, or a provenance
   * persistence error with full rollback when the audit append fails.
   */
  async createWorkflowDefinition(
    command: CreateWorkflowDefinitionCommand,
  ): Promise<Workflow> {
    const workflow = createWorkflow({
      title: command.title,
      workflowType: command.workflowType,
      description: command.description,
      purpose: command.purpose,
      entryCriteria: command.entryCriteria,
      exitCriteria: command.exitCriteria,
    });
    return this.provenance.mutateWithProvenance({
      entityType: 'workflow',
      entityId: workflow.id,
      action: 'create',
      actor: command.actor,
      occurredAt: command.occurredAt,
      after: snapshot(workflow),
      mutate: async (context) => {
        await this.workflows(context).add(workflow);
        return workflow;
      },
    });
  }

  /**
   * Edit an unpublished draft with provenance. Throws
   * `WorkflowNotFoundError` for an unknown id and a domain error when the
   * Workflow is published, archived, or the change is invalid.
   */
  async updateWorkflowDraft(
    id: EntityId,
    changes: WorkflowDraftChanges,
    actor: string,
    occurredAt?: IsoTimestamp,
  ): Promise<Workflow> {
    const before = await this.requireWorkflow(id);
    const after = updateWorkflowDraft(before, changes, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'workflow',
      entityId: id,
      action: 'update',
      actor,
      occurredAt,
      before: snapshot(before),
      after: snapshot(after),
      mutate: async (context) => {
        await this.workflows(context).save(after);
        return after;
      },
    });
  }

  /**
   * Publish a draft, freezing it as an immutable version, with provenance.
   * Throws `WorkflowNotFoundError` for an unknown id and a domain error when
   * already published or archived.
   */
  async publishWorkflow(
    id: EntityId,
    actor: string,
    occurredAt?: IsoTimestamp,
  ): Promise<Workflow> {
    const before = await this.requireWorkflow(id);
    const after = publishWorkflow(before, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'workflow',
      entityId: id,
      action: 'update',
      actor,
      occurredAt,
      before: snapshot(before),
      after: snapshot(after),
      mutate: async (context) => {
        await this.workflows(context).save(after);
        return after;
      },
    });
  }

  /**
   * Create the next version of a published Workflow as a new draft with
   * provenance; the after snapshot records the `supersedesId` lineage.
   * Throws `WorkflowNotFoundError` for an unknown id and a domain error when
   * the predecessor is not published.
   */
  async createWorkflowVersion(
    predecessorId: EntityId,
    overrides: WorkflowDraftChanges,
    actor: string,
    occurredAt?: IsoTimestamp,
  ): Promise<Workflow> {
    const predecessor = await this.requireWorkflow(predecessorId);
    const successor = createWorkflowVersion(predecessor, overrides);
    return this.provenance.mutateWithProvenance({
      entityType: 'workflow',
      entityId: successor.id,
      action: 'create',
      actor,
      occurredAt,
      after: snapshot(successor),
      mutate: async (context) => {
        await this.workflows(context).add(successor);
        return successor;
      },
    });
  }

  /**
   * Archive a Workflow definition with provenance; the archived version stays
   * resolvable in historical lookups but leaves active discovery. Throws
   * `WorkflowNotFoundError` for an unknown id and a domain error when already
   * archived.
   */
  async archiveWorkflow(
    id: EntityId,
    actor: string,
    occurredAt?: IsoTimestamp,
  ): Promise<Workflow> {
    const before = await this.requireWorkflow(id);
    const after = archiveWorkflow(before, this.clock.now());
    return this.provenance.mutateWithProvenance({
      entityType: 'workflow',
      entityId: id,
      action: 'archive',
      actor,
      occurredAt,
      before: snapshot(before),
      after: snapshot(after),
      mutate: async (context) => {
        await this.workflows(context).save(after);
        return after;
      },
    });
  }

  /** Return the Workflow with this id (active or archived), or null. */
  async getWorkflow(id: EntityId): Promise<Workflow | null> {
    return this.readWorkflows.getById(id);
  }

  private resolve(candidates: Workflow[]): WorkflowDiscovery {
    if (candidates.length === 0) {
      return { kind: 'missing' };
    }
    if (candidates.length > 1) {
      return { kind: 'ambiguous', candidates };
    }
    return { kind: 'found', workflow: candidates[0] };
  }

  private async requireWorkflow(id: EntityId): Promise<Workflow> {
    const workflow = await this.readWorkflows.getById(id);
    if (workflow === null) {
      throw new WorkflowNotFoundError(id);
    }
    return workflow;
  }
}

/**
 * Plain field snapshot of a Workflow. Every field is JSON-safe, and the
 * default `workflow` field policy allowlists exactly these fields, so the
 * provenance payload carries relevant non-sensitive data only.
 */
function snapshot(workflow: Workflow): EntitySnapshot {
  return { ...workflow };
}
