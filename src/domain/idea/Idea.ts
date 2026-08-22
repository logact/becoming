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
    /** User-controlled workflow classification. */
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
    const content = params.content.trim();
    if (content.length === 0) {
      throw new DomainError('Idea content must not be empty');
    }
    return new Idea(params.id, content, 'captured', false, [], params.now, params.now);
  }

  /** Rebuilds from persistence; no invariants enforced beyond construction. */
  static restore(params: {
    id: IdeaId;
    content: string;
    status: IdeaStatus;
    archived: boolean;
    labelIds: LabelId[];
    createdAt: Date;
    updatedAt: Date;
  }): Idea {
    return new Idea(
      params.id,
      params.content,
      params.status,
      params.archived,
      [...params.labelIds],
      params.createdAt,
      params.updatedAt,
    );
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

  /** Changes the user-controlled workflow classification; same-state is a no-op. */
  changeStatus(next: IdeaStatus, now: Date): void {
    if (next === this._status) return;
    this._status = next;
    this._updatedAt = now;
  }

  explore(now: Date): void {
    this.changeStatus('exploring', now);
  }

  pause(now: Date): void {
    this.changeStatus('paused', now);
  }

  handle(now: Date): void {
    this.changeStatus('handled', now);
  }

  returnToInbox(now: Date): void {
    this.changeStatus('captured', now);
  }

  edit(content: string, now: Date): void {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new DomainError('Idea content must not be empty');
    }
    this._content = trimmed;
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
