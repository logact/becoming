import { Note } from '../Note';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');

describe('Note', () => {
  it('is created with content', () => {
    const note = Note.create({ id: 'n1', content: 'Ship small, iterate', now: t0 });
    expect(note.content).toBe('Ship small, iterate');
    expect(note.archived).toBe(false);
    expect(note.createdAt).toBe(t0);
    expect(note.updatedAt).toBe(t0);
  });

  it('edits content but rejects empty content', () => {
    const note = Note.create({ id: 'n1', content: 'Ship small, iterate', now: t0 });
    expect(() => note.edit('   ', t1)).toThrow(DomainError);
    note.edit('Ship smaller', t1);
    expect(note.content).toBe('Ship smaller');
    expect(note.updatedAt).toBe(t1);
  });

  it('archives and unarchives independently', () => {
    const note = Note.create({ id: 'n1', content: 'Ship small, iterate', now: t0 });
    note.archive(t1);
    expect(note.archived).toBe(true);
    note.unarchive(t1);
    expect(note.archived).toBe(false);
  });

  it('adds and removes labels idempotently', () => {
    const note = Note.create({ id: 'n1', content: 'Ship small, iterate', now: t0 });
    note.addLabel('l1');
    note.addLabel('l1');
    expect(note.labelIds).toEqual(['l1']);
    note.removeLabel('l1');
    note.removeLabel('l1');
    expect(note.labelIds).toEqual([]);
  });
});
