import { DomainError } from '../shared/errors';
import type { GoalId, LabelId, MilestoneId, ProjectId } from '../shared/ids';
import type { Project } from '../project/Project';

export type GoalStatus = 'todo' | 'doing' | 'done' | 'paused' | 'failed';

/**
 * A target state the user aims to achieve. A goal with a `projectId` is a
 * sub-goal decomposed inside that project; `parentGoalId` carries the
 * goal-tree structure. A top-level goal has neither and owns its projects
 * directly.
 */
export class Goal {
  private constructor(
    /** Unique identifier of the goal. */
    readonly id: GoalId,
    /** Short name of the goal; must not be blank. */
    private _title: string,
    /** Optional longer explanation of what achieving the goal means. */
    private _description: string | undefined,
    /** Optional date on which the goal is planned to become actionable. */
    private _startAt: Date | undefined,
    /** Optional deadline by which the goal should be achieved. */
    private _due: Date | undefined,
    /** Lifecycle status, changed only through start/pause/resume/complete/reopen. */
    private _status: GoalStatus,
    /** Independent archive flag; archiving never overwrites the status. */
    private _archived: boolean,
    /** Labels attached to the goal for classification. */
    readonly labelIds: LabelId[],
    /** The project this goal belongs to as a sub-goal, if any. */
    readonly projectId: ProjectId | undefined,
    /** The parent goal in the goal tree, if this is a sub-goal. */
    readonly parentGoalId: GoalId | undefined,
    /** The milestone this goal is linked to, if any. */
    private _milestoneId: MilestoneId | undefined,
    /** When the goal was created. */
    readonly createdAt: Date,
    /** When the goal was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: GoalId;
    title: string;
    description?: string;
    startAt?: Date;
    due?: Date;
    projectId?: ProjectId;
    parentGoalId?: GoalId;
    milestoneId?: MilestoneId;
    now: Date;
  }): Goal {
    Goal.validateSchedule(params.startAt, params.due);
    return new Goal(
      params.id,
      params.title,
      params.description,
      params.startAt,
      params.due,
      'todo',
      false,
      [],
      params.projectId,
      params.parentGoalId,
      params.milestoneId,
      params.now,
      params.now,
    );
  }

  /** Rebuilds from persistence while preserving the schedule invariant. */
  static restore(params: {
    id: GoalId;
    title: string;
    description?: string;
    startAt?: Date;
    due?: Date;
    status: GoalStatus;
    archived: boolean;
    labelIds: LabelId[];
    projectId?: ProjectId;
    parentGoalId?: GoalId;
    milestoneId?: MilestoneId;
    createdAt: Date;
    updatedAt: Date;
  }): Goal {
    Goal.validateSchedule(params.startAt, params.due);
    return new Goal(
      params.id,
      params.title,
      params.description,
      params.startAt,
      params.due,
      params.status,
      params.archived,
      [...params.labelIds],
      params.projectId,
      params.parentGoalId,
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

  get startAt(): Date | undefined {
    return this._startAt;
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

  /**
   * Activates `project` as this goal's current plan. The active project is
   * derived (the project with status `active`), so at most one may be active:
   * the previously active project, if any and different, is paused first.
   * Both projects must belong to this goal.
   */
  activateProject(project: Project, currentActive: Project | undefined, now: Date): void {
    if (project.goalId !== this.id) {
      throw new DomainError('Project does not belong to this goal');
    }
    if (currentActive !== undefined && currentActive.goalId !== this.id) {
      throw new DomainError('Current active project does not belong to this goal');
    }
    if (currentActive !== undefined && currentActive.id !== project.id) {
      currentActive.pause(now);
    }
    project.activate(now);
  }

  rename(title: string, now: Date): void {
    if (title.trim().length === 0) {
      throw new DomainError('Goal title must not be empty');
    }
    this._title = title;
    this._updatedAt = now;
  }

  setDue(due: Date, now: Date): void {
    this.setSchedule(this._startAt, due, now);
  }

  clearDue(now: Date): void {
    this.setSchedule(this._startAt, undefined, now);
  }

  /** Atomically replaces the optional planned start and due dates. */
  setSchedule(startAt: Date | undefined, due: Date | undefined, now: Date): void {
    Goal.validateSchedule(startAt, due);
    this._startAt = startAt;
    this._due = due;
    this._updatedAt = now;
  }

  /** Links the goal to a milestone; passing undefined clears the link. */
  assignMilestone(milestoneId: MilestoneId | undefined, now: Date): void {
    this._milestoneId = milestoneId;
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

  /** True when a scheduled, unarchived todo goal has reached its start date. */
  isReadyToStart(now: Date): boolean {
    return (
      !this._archived &&
      this._status === 'todo' &&
      this._startAt !== undefined &&
      Goal.localCalendarDate(this._startAt) <= Goal.localCalendarDate(now)
    );
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

  private static validateSchedule(startAt: Date | undefined, due: Date | undefined): void {
    if (
      startAt !== undefined &&
      due !== undefined &&
      Goal.localCalendarDate(startAt) > Goal.localCalendarDate(due)
    ) {
      throw new DomainError('Goal start date must not be after its due date');
    }
  }

  private static localCalendarDate(date: Date): number {
    return date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();
  }
}
