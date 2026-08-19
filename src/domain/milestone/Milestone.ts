import { DomainError } from '../shared/errors';
import type { MilestoneId, ProjectId } from '../shared/ids';

/**
 * A dated checkpoint inside a project. It has no status of its own; whether
 * it is reached or upcoming is derived at the application layer by comparing
 * its date with now (`date <= now` means reached).
 */
export class Milestone {
  private constructor(
    /** Unique identifier of the milestone. */
    readonly id: MilestoneId,
    /** Short name of the milestone; must not be blank. */
    private _title: string,
    /** The date the milestone is planned for. */
    private _date: Date,
    /** The project this milestone belongs to. */
    readonly projectId: ProjectId,
    /** When the milestone was created. */
    readonly createdAt: Date,
    /** When the milestone was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: MilestoneId;
    title: string;
    date: Date;
    projectId: ProjectId;
    now: Date;
  }): Milestone {
    if (params.title.trim().length === 0) {
      throw new DomainError('Milestone title must not be empty');
    }
    return new Milestone(
      params.id,
      params.title,
      params.date,
      params.projectId,
      params.now,
      params.now,
    );
  }

  /** Rebuilds from persistence; no invariants enforced beyond construction. */
  static restore(params: {
    id: MilestoneId;
    title: string;
    date: Date;
    projectId: ProjectId;
    createdAt: Date;
    updatedAt: Date;
  }): Milestone {
    return new Milestone(
      params.id,
      params.title,
      params.date,
      params.projectId,
      params.createdAt,
      params.updatedAt,
    );
  }

  get title(): string {
    return this._title;
  }

  get date(): Date {
    return this._date;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  rename(title: string, now: Date): void {
    if (title.trim().length === 0) {
      throw new DomainError('Milestone title must not be empty');
    }
    this._title = title;
    this._updatedAt = now;
  }

  reschedule(date: Date, now: Date): void {
    this._date = date;
    this._updatedAt = now;
  }
}
