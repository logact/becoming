import { DomainError } from '../shared/errors';
import type { GoalId, LabelId } from '../shared/ids';

export type GoalStatus = 'todo' | 'doing' | 'done' | 'paused' | 'failed';

/** A target state the user aims to achieve. */
export class Goal {
  private constructor(
    /** Unique identifier of the goal. */
    readonly id: GoalId,
    /** Short name of the goal; must not be blank. */
    private _title: string,
    /** Optional longer explanation of what achieving the goal means. */
    private _description: string | undefined,
    /** Optional deadline by which the goal should be achieved. */
    private _due: Date | undefined,
    /** Lifecycle status, changed only through start/pause/resume/complete/reopen. */
    private _status: GoalStatus,
    /** Independent archive flag; archiving never overwrites the status. */
    private _archived: boolean,
    /** Labels attached to the goal for classification. */
    readonly labelIds: LabelId[],
    /** When the goal was created. */
    readonly createdAt: Date,
    /** When the goal was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: GoalId;
    title: string;
    description?: string;
    due?: Date;
    now: Date;
  }): Goal {
    return new Goal(
      params.id,
      params.title,
      params.description,
      params.due,
      'todo',
      false,
      [],
      params.now,
      params.now,
    );
  }

  get title(): string {
    return this._title;
  }

  get description(): string | undefined {
    return this._description;
  }

  get due(): Date | undefined {
    return this._due;
  }

  get status(): GoalStatus {
    return this._status;
  }

  get archived(): boolean {
    return this._archived;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** todo → doing */
  start(now: Date): void {
    this.transition(['todo'], 'doing', now);
  }

  /** doing → paused */
  pause(now: Date): void {
    this.transition(['doing'], 'paused', now);
  }

  /** paused → doing */
  resume(now: Date): void {
    this.transition(['paused'], 'doing', now);
  }

  /** doing → done */
  complete(now: Date): void {
    this.transition(['doing'], 'done', now);
  }

  /** doing|paused → failed */
  fail(now: Date): void {
    this.transition(['doing', 'paused'], 'failed', now);
  }

  /** done|failed → todo */
  reopen(now: Date): void {
    this.transition(['done', 'failed'], 'todo', now);
  }

  rename(title: string, now: Date): void {
    if (title.trim().length === 0) {
      throw new DomainError('Goal title must not be empty');
    }
    this._title = title;
    this._updatedAt = now;
  }

  setDue(due: Date, now: Date): void {
    this._due = due;
    this._updatedAt = now;
  }

  clearDue(now: Date): void {
    this._due = undefined;
    this._updatedAt = now;
  }

  /**
   * True when the goal is not archived, not done/failed, has a due, and the
   * due is within `windowMs` from `now`; an already-passed due also counts.
   */
  isDueImminent(windowMs: number, now: Date): boolean {
    if (
      this._archived ||
      this._status === 'done' ||
      this._status === 'failed' ||
      this._due === undefined
    ) {
      return false;
    }
    return this._due.getTime() - now.getTime() <= windowMs;
  }

  /** Archive is an independent flag and never overwrites status. */
  archive(now: Date): void {
    this._archived = true;
    this._updatedAt = now;
  }

  unarchive(now: Date): void {
    this._archived = false;
    this._updatedAt = now;
  }

  addLabel(labelId: LabelId): void {
    if (!this.labelIds.includes(labelId)) {
      this.labelIds.push(labelId);
    }
  }

  removeLabel(labelId: LabelId): void {
    const index = this.labelIds.indexOf(labelId);
    if (index >= 0) {
      this.labelIds.splice(index, 1);
    }
  }

  private transition(from: GoalStatus[], to: GoalStatus, now: Date): void {
    if (!from.includes(this._status)) {
      throw new DomainError(`Cannot transition Goal from ${this._status} to ${to}`);
    }
    this._status = to;
    this._updatedAt = now;
  }
}
