import { DomainError } from '../shared/errors';
import type { GoalId, LabelId, MilestoneId, ProjectId, TaskId } from '../shared/ids';

export type TaskStatus = 'todo' | 'doing' | 'done' | 'paused' | 'failed';

/** An action that implements a goal through the project it belongs to. */
export class Task {
  private constructor(
    /** Unique identifier of the task. */
    readonly id: TaskId,
    /** Short name of the task; must not be blank. */
    private _title: string,
    /** Optional longer explanation of what the task involves. */
    private _description: string | undefined,
    /** Optional deadline by which the task should be done. */
    private _due: Date | undefined,
    /** Lifecycle status, changed only through start/pause/resume/complete/reopen. */
    private _status: TaskStatus,
    /** Independent archive flag; archiving never overwrites the status. */
    private _archived: boolean,
    /** Labels attached to the task for classification. */
    readonly labelIds: LabelId[],
    /** The project this task belongs to. */
    readonly projectId: ProjectId,
    /** The goal within the project this task is assigned to, if any. */
    private _goalId: GoalId | undefined,
    /** The milestone this task is linked to, if any. */
    private _milestoneId: MilestoneId | undefined,
    /** When the task was created. */
    readonly createdAt: Date,
    /** When the task was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: TaskId;
    title: string;
    description?: string;
    due?: Date;
    projectId: ProjectId;
    goalId?: GoalId;
    milestoneId?: MilestoneId;
    now: Date;
  }): Task {
    return new Task(
      params.id,
      params.title,
      params.description,
      params.due,
      'todo',
      false,
      [],
      params.projectId,
      params.goalId,
      params.milestoneId,
      params.now,
      params.now,
    );
  }

  /** Rebuilds from persistence; no invariants enforced beyond construction. */
  static restore(params: {
    id: TaskId;
    title: string;
    description?: string;
    due?: Date;
    status: TaskStatus;
    archived: boolean;
    labelIds: LabelId[];
    projectId: ProjectId;
    goalId?: GoalId;
    milestoneId?: MilestoneId;
    createdAt: Date;
    updatedAt: Date;
  }): Task {
    return new Task(
      params.id,
      params.title,
      params.description,
      params.due,
      params.status,
      params.archived,
      [...params.labelIds],
      params.projectId,
      params.goalId,
      params.milestoneId,
      params.createdAt,
      params.updatedAt,
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

  get status(): TaskStatus {
    return this._status;
  }

  get archived(): boolean {
    return this._archived;
  }

  get goalId(): GoalId | undefined {
    return this._goalId;
  }

  get milestoneId(): MilestoneId | undefined {
    return this._milestoneId;
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
      throw new DomainError('Task title must not be empty');
    }
    this._title = title;
    this._updatedAt = now;
  }

  setDue(due: Date, now: Date): void {
    this._due = due;
    this._updatedAt = now;
  }

  /** Assigns the task to a goal within its project. */
  assignGoal(goalId: GoalId, now: Date): void {
    this._goalId = goalId;
    this._updatedAt = now;
  }

  /** Links the task to a milestone; passing undefined clears the link. */
  assignMilestone(milestoneId: MilestoneId | undefined, now: Date): void {
    this._milestoneId = milestoneId;
    this._updatedAt = now;
  }

  clearDue(now: Date): void {
    this._due = undefined;
    this._updatedAt = now;
  }

  /**
   * True when the task is not archived, not done/failed, has a due, and the
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

  private transition(from: TaskStatus[], to: TaskStatus, now: Date): void {
    if (!from.includes(this._status)) {
      throw new DomainError(`Cannot transition Task from ${this._status} to ${to}`);
    }
    this._status = to;
    this._updatedAt = now;
  }
}
