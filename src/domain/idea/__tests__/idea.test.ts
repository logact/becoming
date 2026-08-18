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

  it('rejects invalid transitions', () => {
    const idea = Idea.create({ id: 'i1', content: 'App for habits', now: t0 });
    expect(() => idea.pause(t1)).toThrow(DomainError);
    idea.explore(t1);
    expect(() => idea.explore(t2)).toThrow(DomainError);
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
    idea.edit('App for goals', t1);
    expect(idea.content).toBe('App for goals');
    expect(idea.updatedAt).toBe(t1);
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
});
