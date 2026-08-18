import {
  AttentionEntry,
  type AttentionEntryKind,
  type AttentionTargetType,
} from '../../domain/attention/AttentionEntry';
import type { AttentionEntryRepository } from '../../domain/attention/repository/AttentionEntryRepository';
import type { AttentionEntryId } from '../../domain/shared/ids';

/**
 * Use case for the user-managed part of the dashboard attention section:
 * pinning a target into it, dismissing a target from it, and clearing that
 * intent. One active entry per target: pinning removes a dismissal and vice
 * versa.
 */
export class AttentionService {
  constructor(private readonly attentionEntries: AttentionEntryRepository) {}

  /** Pins the target into the attention section, replacing any dismissal. */
  async pin(params: {
    id: AttentionEntryId;
    targetType: AttentionTargetType;
    targetId: string;
    now: Date;
  }): Promise<AttentionEntry> {
    return this.replace(params, 'pin');
  }

  /** Dismisses the target from the attention section, replacing any pin. */
  async dismiss(params: {
    id: AttentionEntryId;
    targetType: AttentionTargetType;
    targetId: string;
    now: Date;
  }): Promise<AttentionEntry> {
    return this.replace(params, 'dismiss');
  }

  /** Removes any pin/dismiss entry for the target (un-pin / un-dismiss). */
  async clear(targetType: AttentionTargetType, targetId: string): Promise<void> {
    const existing = await this.attentionEntries.list({ targetType, targetId });
    for (const entry of existing) {
      await this.attentionEntries.delete(entry.id);
    }
  }

  private async replace(
    params: {
      id: AttentionEntryId;
      targetType: AttentionTargetType;
      targetId: string;
      now: Date;
    },
    kind: AttentionEntryKind,
  ): Promise<AttentionEntry> {
    await this.clear(params.targetType, params.targetId);
    const entry = AttentionEntry.create({ ...params, kind });
    await this.attentionEntries.save(entry);
    return entry;
  }
}
