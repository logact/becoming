import { DomainError } from '../shared/errors';
import type { GoalId, LabelId, ProjectId } from '../shared/ids';

export type ProjectStatus = 'planning' | 'active' | 'paused';

/** A plan that serves a goal; a goal may have several projects. */
export class Project {
  private constructor(
    /** Unique identifier of the project. */
    readonly id: ProjectId,
    /** Short name of the project; must not be blank. */
    private _name: string,
    /** The goal this project serves. */
    readonly goalId: GoalId,
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
    now: Date;
  }): Project {
    return new Project(
      params.id,
      params.name,
      params.goalId,
      'planning',
      false,
      [],
      params.now,
      params.now,
    );
  }

  get name(): string {
    return this._name;
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

  rename(name: string, now: Date): void {
    if (name.trim().length === 0) {
      throw new DomainError('Project name must not be empty');
    }
    this._name = name;
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
}
