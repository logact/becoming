import { Idea } from '../Idea';
import { DomainError } from '../../shared/errors';

const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-01-01T01:00:00Z');
const t2 = new Date('2026-01-01T02:00:00Z');

describe('Idea', () => {
  it('is created in captured status', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    expect(idea.status).toBe('captured');
    expect(idea.archived).toBe(false);
    expect(idea.createdAt).toBe(t0);
    expect(idea.updatedAt).toBe(t0);
  });

  it('explores from captured, pauses, and re-explores from paused', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    idea.explore(t1);
    expect(idea.status).toBe('exploring');
    expect(idea.updatedAt).toBe(t1);
    idea.pause(t2);
    expect(idea.status).toBe('paused');
    idea.explore(t2);
    expect(idea.status).toBe('exploring');
  });

  it.each(['captured', 'exploring', 'paused', 'handled'] as const)(
    'lets the user switch directly to %s',
    (status) => {
      const idea = Idea.restore({
        id: 'i1',
        content: 'App for habits',
        status: status === 'captured' ? 'handled' : 'captured',
        archived: false,
        labelIds: [],
        createdAt: t0,
        updatedAt: t0,
      });
      idea.changeStatus(status, t1);
      expect(idea.status).toBe(status);
      expect(idea.updatedAt).toBe(t1);
    },
  );

  it('provides semantic wrappers for every status', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    idea.explore(t1);
    expect(idea.status).toBe('exploring');
    idea.pause(t1);
    expect(idea.status).toBe('paused');
    idea.handle(t2);
    expect(idea.status).toBe('handled');
    idea.returnToInbox(t2);
    expect(idea.status).toBe('captured');
  });

  it('does not update updatedAt when status stays the same', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    idea.changeStatus('captured', t1);
    expect(idea.updatedAt).toBe(t0);
  });

  it('archives without touching status', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    idea.explore(t1);
    idea.archive(t2);
    expect(idea.archived).toBe(true);
    expect(idea.status).toBe('exploring');
    idea.unarchive(t2);
    expect(idea.archived).toBe(false);
    expect(idea.status).toBe('exploring');
  });

  it('edits content but rejects empty content', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    expect(() => idea.edit('   ', t1)).toThrow(DomainError);
    idea.edit('  App for goals  ', t1);
    expect(idea.content).toBe('App for goals');
    expect(idea.updatedAt).toBe(t1);
  });

  it('rejects blank creation and trims content', () => {
    expect(() => Idea.create({ id: 'i1', content: '   ', now: t0 })).toThrow(DomainError);
    expect(Idea.create({ id: 'i2', content: '  Useful thought  ', now: t0 }).content)
      .toBe('Useful thought');
  });

  it('adds and removes labels idempotently', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    idea.addLabel('l1');
    idea.addLabel('l1');
    expect(idea.labelIds).toEqual(['l1']);
    idea.removeLabel('l1');
    idea.removeLabel('l1');
    expect(idea.labelIds).toEqual([]);
  });

  it('restores from persisted fields without enforcing invariants', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    idea.explore(t1);
    idea.edit('App for goals', t1);
    idea.addLabel('l1');
    const restored = Idea.restore({
      id: idea.id,
      content: idea.content,
      status: idea.status,
      archived: idea.archived,
      labelIds: idea.labelIds,
      createdAt: idea.createdAt,
      updatedAt: idea.updatedAt,
    });
    expect(restored.id).toBe(idea.id);
    expect(restored.content).toBe(idea.content);
    expect(restored.status).toBe(idea.status);
    expect(restored.archived).toBe(idea.archived);
    expect(restored.labelIds).toEqual(idea.labelIds);
    expect(restored.labelIds).not.toBe(idea.labelIds);
    expect(restored.createdAt).toBe(idea.createdAt);
    expect(restored.updatedAt).toBe(idea.updatedAt);
  });
});
