import type { EntityId, IsoTimestamp } from '../domain/ids';
import {
  LINEAGE_RELATION_TYPES,
  type LineageRelationType,
} from '../domain/relationPolicy';
import type { Relation } from '../domain/relation';
import type { RelationRepository } from '../persistence/relationRepository';
import type {
  CreateRelationCommand,
  EndRelationCommand,
  ReplaceRelationCommand,
  RelationService,
} from './relationService';

/**
 * Application boundary for explicit origin and transformation links.
 *
 * This service owns no second graph or persistence path. It narrows commands
 * to the two lineage relation types, then delegates all endpoint, policy,
 * metadata, cardinality, cycle, temporal, and atomic provenance work to the
 * shared RelationService. Lineage remains represented exclusively by
 * independent immutable Relation rows.
 */

/** Thrown when a command tries to use a non-lineage semantic relation type. */
export class UnsupportedLineageRelationTypeError extends Error {
  constructor(relationType: string) {
    super(`Unsupported lineage relation type ${JSON.stringify(relationType)}`);
    this.name = 'UnsupportedLineageRelationTypeError';
  }
}

/** Thrown when an existing relation is addressed as if it were lineage. */
export class RelationIsNotLineageError extends Error {
  constructor(relation: Relation) {
    super(`Relation ${relation.id} (${relation.relationType}) is not a lineage link`);
    this.name = 'RelationIsNotLineageError';
  }
}

/** Input shared by origin and transformation link creation. */
export interface CreateLineageLinkCommand
  extends Omit<CreateRelationCommand, 'relationType'> {
  relationType: LineageRelationType | string;
}

/** A source immediately recorded as the direct origin of its derivative. */
export type CreateOriginLinkCommand = Omit<CreateLineageLinkCommand, 'relationType'>;

/** A source explicitly transformed into its derivative. */
export type CreateTransformationLinkCommand = Omit<CreateLineageLinkCommand, 'relationType'>;

export interface EndLineageLinkCommand extends EndRelationCommand {}

export interface ReplaceLineageLinkCommand {
  relationId: EntityId;
  actor: string;
  endedAt?: IsoTimestamp;
  replacement: Omit<CreateLineageLinkCommand, 'actor'>;
}

export interface LineageServicePorts<TContext> {
  /** The sole mutation boundary for Relations and their provenance Records. */
  relationService: RelationService<TContext>;
  /** Read-only history lookup used to prevent ending/replacing another edge kind. */
  relations: RelationRepository;
}

/**
 * Creates, ends, and replaces explicit lineage links.
 *
 * `endLink` preserves the shared idempotent contract: ending an already-ended
 * link returns its stored first-ending state and appends no second provenance
 * Record. `replaceLink` is deliberately end-old/create-new; it never changes
 * historical endpoint or metadata columns on the original relation.
 */
export class LineageService<TContext> {
  constructor(private readonly ports: LineageServicePorts<TContext>) {}

  async createLink(command: CreateLineageLinkCommand): Promise<Relation> {
    return this.ports.relationService.createRelation({
      ...command,
      relationType: requireLineageRelationType(command.relationType),
    });
  }

  async createOrigin(command: CreateOriginLinkCommand): Promise<Relation> {
    return this.createLink({ ...command, relationType: 'origin_of' });
  }

  async createTransformation(
    command: CreateTransformationLinkCommand,
  ): Promise<Relation> {
    return this.createLink({ ...command, relationType: 'transforms_into' });
  }

  async endLink(command: EndLineageLinkCommand): Promise<Relation> {
    await this.requireLineageRelation(command.relationId);
    return this.ports.relationService.endRelation(command);
  }

  async replaceLink(command: ReplaceLineageLinkCommand): Promise<{
    ended: Relation;
    replacement: Relation;
  }> {
    await this.requireLineageRelation(command.relationId);
    const replacement: ReplaceRelationCommand['replacement'] = {
      ...command.replacement,
      relationType: requireLineageRelationType(command.replacement.relationType),
    };
    return this.ports.relationService.replaceRelation({
      relationId: command.relationId,
      actor: command.actor,
      endedAt: command.endedAt,
      replacement,
    });
  }

  private async requireLineageRelation(relationId: EntityId): Promise<void> {
    const relation = await this.ports.relations.getById(relationId);
    // Preserve RelationService's canonical unknown-id error rather than
    // introducing a second missing-relation contract at this façade.
    if (relation !== null && !isLineageRelationType(relation.relationType)) {
      throw new RelationIsNotLineageError(relation);
    }
  }
}

function isLineageRelationType(value: string): value is LineageRelationType {
  return LINEAGE_RELATION_TYPES.includes(value as LineageRelationType);
}

function requireLineageRelationType(value: string): LineageRelationType {
  if (!isLineageRelationType(value)) {
    throw new UnsupportedLineageRelationTypeError(value);
  }
  return value;
}
