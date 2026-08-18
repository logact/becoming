import { DomainError } from '../shared/errors';
import type { GoalId, LabelId, ProjectId } from '../shared/ids';

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done' | 'failed';

/** A plan that serves a goal; a goal may have several projects. */
export class Project {
  private constructor(
    /** Unique identifier of the project. */
    readonly id: ProjectId,
    /** Short name of the project; must not be blank. */
    private _name: string,
    /** The goal this project serves. */
    readonly goalId: GoalId,
    /** Optional deadline; must be earlier than the serving goal's due. */
    private _due: Date | undefined,
    /** Lifecycle status, changed only through activate/pause. */
    private _status: ProjectStatus,
    /** Independent archive flag; archiving never overwrites the status. */
    private _archived: boolean,
    /** Labels attached to the project for classification. */
    readonly labelIds: LabelId[],
    /** When the project was created. */
    readonly createdAt: Date,
    /** When the project was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: ProjectId;
    name: string;
    goalId: GoalId;
    due?: Date;
    /** Due of the serving goal, used to validate the project due. */
    goalDue?: Date;
    now: Date;
  }): Project {
    const project = new Project(
      params.id,
      params.name,
      params.goalId,
      undefined,
      'planning',
      false,
      [],
      params.now,
      params.now,
    );
    if (params.due !== undefined) {
      project.setDue(params.due, params.goalDue, params.now);
    }
    return project;
  }

  get name(): string {
    return this._name;
  }

  get due(): Date | undefined {
    return this._due;
  }

  get status(): ProjectStatus {
    return this._status;
  }

  get archived(): boolean {
    return this._archived;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** planning|paused → active */
  activate(now: Date): void {
    if (this._status === 'active') {
      throw new DomainError('Project is already active');
    }
    this._status = 'active';
    this._updatedAt = now;
  }

  /** active → paused */
  pause(now: Date): void {
    if (this._status !== 'active') {
      throw new DomainError(`Cannot pause Project from ${this._status}`);
    }
    this._status = 'paused';
    this._updatedAt = now;
  }

  /** active|paused → failed */
  fail(now: Date): void {
    if (this._status !== 'active' && this._status !== 'paused') {
      throw new DomainError(`Cannot fail Project from ${this._status}`);
    }
    this._status = 'failed';
    this._updatedAt = now;
  }

  rename(name: string, now: Date): void {
    if (name.trim().length === 0) {
      throw new DomainError('Project name must not be empty');
    }
    this._name = name;
    this._updatedAt = now;
  }

  /**
   * Set the project deadline. When the serving goal has a due, the project's
   * due must be strictly earlier than it.
   */
  setDue(due: Date, goalDue: Date | undefined, now: Date): void {
    if (goalDue !== undefined && due.getTime() >= goalDue.getTime()) {
      throw new DomainError('Project due must be earlier than its goal due');
    }
    this._due = due;
    this._updatedAt = now;
  }

  clearDue(now: Date): void {
    this._due = undefined;
    this._updatedAt = now;
  }

  /**
   * True when the project is not archived, not done/failed, has a due, and the
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
}
