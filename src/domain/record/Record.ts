import type { RecordId } from '../shared/ids';



/**
 * An append-only, immutable entry describing a change to a domain model or
 * something the user has done. Instances are created by application services.
 */
export class Record {
  private constructor(
    /** Unique identifier of the record. */
    readonly id: RecordId,
    /** What happened, e.g. 'goalCreated' or 'taskCompleted'. */
    readonly kind: string,
    /** Optional extra information about the event. */
    readonly detail: string | undefined,
    /** When the event happened. */
    readonly occurredAt: Date,
 
  ) {}

  static create(params: {
    id: RecordId;
    kind: string;
    detail?: string;
    occurredAt: Date;
  }): Record {
    return new Record(
      params.id,
      params.kind,
      params.detail,
      params.occurredAt,
    );
  }
}
