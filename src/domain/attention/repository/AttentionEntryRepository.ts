import type { AttentionEntry, AttentionEntryKind, AttentionTargetType } from '../AttentionEntry';
import type { AttentionEntryId } from '../../shared/ids';

export interface AttentionEntryFilter {
  kind?: AttentionEntryKind;
  targetType?: AttentionTargetType;
  targetId?: string;
}

export interface AttentionEntryRepository {
  /** Upserts the attention entry. */
  save(entry: AttentionEntry): Promise<void>;
  findById(id: AttentionEntryId): Promise<AttentionEntry | null>;
  list(filter?: AttentionEntryFilter): Promise<AttentionEntry[]>;
  delete(id: AttentionEntryId): Promise<void>;
}
