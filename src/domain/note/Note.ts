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
    /** Time this note was most recently pinned; null means unpinned. */
    private _pinnedAt: Date | null,
    /** Labels attached to the note for classification. */
    readonly labelIds: LabelId[],
    /** When the note was created. */
    readonly createdAt: Date,
    /** When the note was last modified. */
    private _updatedAt: Date,
  ) {}

  static create(params: { id: NoteId; content: string; now: Date }): Note {
    const content = params.content.trim();
    if (content.length === 0) throw new DomainError('Note content must not be empty');
    return new Note(params.id, content, false, null, [], params.now, params.now);
  }

  static restore(params: {
    id: NoteId;
    content: string;
    archived: boolean;
    pinnedAt: Date | null;
    labelIds: LabelId[];
    createdAt: Date;
    updatedAt: Date;
  }): Note {
    return new Note(
      params.id,
      params.content,
      params.archived,
      params.pinnedAt,
      [...params.labelIds],
      params.createdAt,
      params.updatedAt,
    );
  }

  get content(): string {
    return this._content;
  }

  get archived(): boolean {
    return this._archived;
  }

  get pinnedAt(): Date | null {
    return this._pinnedAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  edit(content: string, now: Date): void {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new DomainError('Note content must not be empty');
    }
    this._content = trimmed;
    this._updatedAt = now;
  }

  /** Re-pinning deliberately refreshes pinnedAt so the note rises to the top. */
  pin(now: Date): void {
    this._pinnedAt = now;
  }

  unpin(_now: Date): void {
    if (this._pinnedAt === null) return;
    this._pinnedAt = null;
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
