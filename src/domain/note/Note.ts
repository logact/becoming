import { DomainError } from '../shared/errors';
import type { LabelId, NoteId } from '../shared/ids';

/** An extracted thought or methodology from the user. */
export class Note {
  private constructor(
    /** Unique identifier of the note. */
    readonly id: NoteId,
    /** The note's text; must not be blank. */
    private _content: string,
    /** Independent archive flag; archiving never overwrites anything else. */
    private _archived: boolean,
    /** Labels attached to the note for classification. */
    readonly labelIds: LabelId[],
    /** When the note was created. */
    readonly createdAt: Date,
    /** When the note was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: { id: NoteId; content: string; now: Date }): Note {
    return new Note(params.id, params.content, false, [], params.now, params.now);
  }

  get content(): string {
    return this._content;
  }

  get archived(): boolean {
    return this._archived;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  edit(content: string, now: Date): void {
    if (content.trim().length === 0) {
      throw new DomainError('Note content must not be empty');
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
