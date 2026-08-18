import type { Record, RecordTargetType } from '../Record';

/** Records are append-only: they are never updated or deleted. */
export interface RecordRepository {
  append(record: Record): Promise<void>;
  listByTarget(targetType: RecordTargetType, targetId: string): Promise<Record[]>;
  listRecent(limit: number): Promise<Record[]>;
}
