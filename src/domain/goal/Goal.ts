import { DomainError } from '../shared/errors';
import type { GoalId, LabelId } from '../shared/ids';

export type GoalStatus = 'todo' | 'doing' | 'done' | 'paused';

/** A target state the user aims to achieve. */
export class Goal {
  private constructor(
    /** Unique identifier of the goal. */
    readonly id: GoalId,
    /** Short name of the goal; must not be blank. */
    private _title: string,
    /** Optional longer explanation of what achieving the goal means. */
    private _description: string | undefined,
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
    now: Date;
  }): Goal {
    return new Goal(
      params.id,
      params.title,
      params.description,
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
    this.transition('todo', 'doing', now);
  }

  /** doing → paused */
  pause(now: Date): void {
    this.transition('doing', 'paused', now);
  }

  /** paused → doing */
  resume(now: Date): void {
    this.transition('paused', 'doing', now);
  }

  /** doing → done */
  complete(now: Date): void {
    this.transition('doing', 'done', now);
  }

  /** done → todo */
  reopen(now: Date): void {
    this.transition('done', 'todo', now);
  }

  rename(title: string, now: Date): void {
    if (title.trim().length === 0) {
      throw new DomainError('Goal title must not be empty');
    }
    this._title = title;
    this._updatedAt = now;
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

  private transition(from: GoalStatus, to: GoalStatus, now: Date): void {
    if (this._status !== from) {
      throw new DomainError(`Cannot transition Goal from ${this._status} to ${to}`);
    }
    this._status = to;
    this._updatedAt = now;
  }
}
