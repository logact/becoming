import { Note } from '../Note';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');

describe('Note', () => {
  it('is created with content', () => {
    const note = Note.create({ id: 'n1', content: 'Ship small, iterate', now: t0 });
    expect(note.content).toBe('Ship small, iterate');
    expect(note.archived).toBe(false);
    expect(note.pinnedAt).toBeNull();
    expect(note.createdAt).toBe(t0);
    expect(note.updatedAt).toBe(t0);
  });

  it('edits content but rejects empty content', () => {
    const note = Note.create({ id: 'n1', content: 'Ship small, iterate', now: t0 });
    expect(() => note.edit('   ', t1)).toThrow(DomainError);
    note.edit('  Ship smaller  ', t1);
    expect(note.content).toBe('Ship smaller');
    expect(note.updatedAt).toBe(t1);
  });

  it('rejects blank creation and trims content', () => {
    expect(() => Note.create({ id: 'n1', content: '  ', now: t0 })).toThrow(DomainError);
    expect(Note.create({ id: 'n2', content: '  Keep this  ', now: t0 }).content).toBe('Keep this');
  });

  it('pins without changing updatedAt, refreshes repeated pins, and unpins', () => {
    const note = Note.create({ id: 'n1', content: 'Ship small', now: t0 });
    note.pin(t1);
    expect(note.pinnedAt).toBe(t1);
    expect(note.updatedAt).toBe(t0);
    const t2 = new Date('2026-01-01T02:00:00Z');
    note.pin(t2);
    expect(note.pinnedAt).toBe(t2);
    expect(note.updatedAt).toBe(t0);
    note.unpin(t2);
    expect(note.pinnedAt).toBeNull();
    expect(note.updatedAt).toBe(t0);
    note.unpin(t2);
    expect(note.pinnedAt).toBeNull();
  });

  it('keeps pin state independent from archive and restores all fields', () => {
    const note = Note.create({ id: 'n1', content: 'Ship small', now: t0 });
    note.pin(t1);
    note.archive(t1);
    note.addLabel('l1');
    expect(note.pinnedAt).toBe(t1);
    const restored = Note.restore({
      id: note.id,
      content: note.content,
      archived: note.archived,
      pinnedAt: note.pinnedAt,
      labelIds: note.labelIds,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
    expect(restored.pinnedAt).toBe(t1);
    expect(restored.content).toBe('Ship small');
    expect(restored.archived).toBe(true);
    expect(restored.labelIds).toEqual(['l1']);
    expect(restored.labelIds).not.toBe(note.labelIds);
    expect(restored.createdAt).toBe(t0);
    expect(restored.updatedAt).toBe(t1);
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
