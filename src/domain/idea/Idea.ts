import { DomainError } from '../shared/errors';
import type { IdeaId, LabelId } from '../shared/ids';

export type IdeaStatus = 'captured' | 'exploring' | 'paused' | 'handled';

/** A casually written idea; may later be transformed into another model. */
export class Idea {
  private constructor(
    /** Unique identifier of the idea. */
    readonly id: IdeaId,
    /** The idea's text; must not be blank. */
    private _content: string,
    /** Lifecycle status, changed only through explore/pause. */
    private _status: IdeaStatus,
    /** Independent archive flag; archiving never overwrites the status. */
    private _archived: boolean,
    /** Labels attached to the idea for classification. */
    readonly labelIds: LabelId[],
    /** When the idea was created. */
    readonly createdAt: Date,
    /** When the idea was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: { id: IdeaId; content: string; now: Date }): Idea {
    return new Idea(params.id, params.content, 'captured', false, [], params.now, params.now);
  }

  get content(): string {
    return this._content;
  }

  get status(): IdeaStatus {
    return this._status;
  }

  get archived(): boolean {
    return this._archived;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** captured|paused → exploring */
  explore(now: Date): void {
    if (this._status === 'exploring') {
      throw new DomainError('Idea is already exploring');
    }
    this._status = 'exploring';
    this._updatedAt = now;
  }

  /** exploring → paused */
  pause(now: Date): void {
    if (this._status !== 'exploring') {
      throw new DomainError(`Cannot pause Idea from ${this._status}`);
    }
    this._status = 'paused';
    this._updatedAt = now;
  }

  edit(content: string, now: Date): void {
    if (content.trim().length === 0) {
      throw new DomainError('Idea content must not be empty');
    }
    this._content = content;
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
