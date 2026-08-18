import { DomainError } from '../shared/errors';
import type { RelationId } from '../shared/ids';

export type RelationEndType = 'goal' | 'task' | 'idea' | 'project' | 'resource' | 'note' | 'record';

/**
 * A directed link between two core models (e.g. a task derived from an idea,
 * a goal depending on another goal). The meaning of the link is carried by
 * `kind` (e.g. 'derivedFrom', 'dependsOn', 'relatesTo').
 */
export class Relation {
  private constructor(
    /** Unique identifier of the relation. */
    readonly id: RelationId,
    /** Model type of the link's source end. */
    readonly sourceType: RelationEndType,
    /** Id of the source model. */
    readonly sourceId: string,
    /** Model type of the link's target end. */
    readonly targetType: RelationEndType,
    /** Id of the target model. */
    readonly targetId: string,
    /** Meaning of the link, e.g. 'derivedFrom', 'dependsOn', 'relatesTo'. */
    readonly kind: string,
    /** When the relation was created. */
    readonly createdAt: Date,
    /** Optional extra information about the relation. */
    readonly detail: string | undefined,
  ) {}

  static create(params: {
    id: RelationId;
    sourceType: RelationEndType;
    sourceId: string;
    targetType: RelationEndType;
    targetId: string;
    kind: string;
    now: Date;
    detail?: string;
  }): Relation {
    if (params.sourceType === params.targetType && params.sourceId === params.targetId) {
      throw new DomainError('A relation must not link a model to itself');
    }
    return new Relation(
      params.id,
      params.sourceType,
      params.sourceId,
      params.targetType,
      params.targetId,
      params.kind,
      params.now,
      params.detail,

    );
  }
}
