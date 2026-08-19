import { DomainError } from '../shared/errors';
import type { AttentionEntryId } from '../shared/ids';

export type AttentionTargetType = 'goal' | 'task' | 'project' | 'idea';
export type AttentionEntryKind = 'pin' | 'dismiss';

/**
 * User intent for the dashboard attention section; rule-derived attention
 * items are never stored, only explicit pins and dismissals are.
 */
export class AttentionEntry {
  private constructor(
    /** Unique identifier of the attention entry. */
    readonly id: AttentionEntryId,
    /** Model type the entry points at. */
    readonly targetType: AttentionTargetType,
    /** Id of the target model; must not be blank. */
    readonly targetId: string,
    /** pin = user added the target; dismiss = user hid the target. */
    readonly kind: AttentionEntryKind,
    /** When the entry was created. */
    readonly createdAt: Date,
  ) {}

  static create(params: {
    id: AttentionEntryId;
    targetType: AttentionTargetType;
    targetId: string;
    kind: AttentionEntryKind;
    now: Date;
  }): AttentionEntry {
    if (params.targetId.trim().length === 0) {
      throw new DomainError('AttentionEntry targetId must not be empty');
    }
    return new AttentionEntry(
      params.id,
      params.targetType,
      params.targetId,
      params.kind,
      params.now,
    );
  }

  /** Rebuilds from persistence; no invariants enforced beyond construction. */
  static restore(params: {
    id: AttentionEntryId;
    targetType: AttentionTargetType;
    targetId: string;
    kind: AttentionEntryKind;
    createdAt: Date;
  }): AttentionEntry {
    return new AttentionEntry(
      params.id,
      params.targetType,
      params.targetId,
      params.kind,
      params.createdAt,
    );
  }
}
