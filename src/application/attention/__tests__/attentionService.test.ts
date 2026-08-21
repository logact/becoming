import { AttentionService } from '../AttentionService';
import { makeFakeRepos } from '../../__tests__/fakes';

const t0 = new Date('2026-02-01T00:00:00Z');

async function makeService() {
  const { attentionEntryRepo: entries } = await makeFakeRepos();
  return { service: new AttentionService(entries), entries };
}

describe('AttentionService', () => {
  it('pin creates a pin entry for the target', async () => {
    const { service, entries } = await makeService();

    await service.pin({ id: 'a1', targetType: 'goal', targetId: 'g1', now: t0 });

    const [entry] = await entries.list();
    expect(entry.id).toBe('a1');
    expect(entry.targetType).toBe('goal');
    expect(entry.targetId).toBe('g1');
    expect(entry.kind).toBe('pin');
    expect(entry.createdAt).toEqual(t0);
  });

  it('dismiss creates a dismiss entry for the target', async () => {
    const { service, entries } = await makeService();

    await service.dismiss({ id: 'a1', targetType: 'task', targetId: 't1', now: t0 });

    const storedEntries = await entries.list();
    expect(storedEntries).toHaveLength(1);
    expect(storedEntries[0].kind).toBe('dismiss');
  });

  it('pin replaces an existing dismiss for the same target', async () => {
    const { service, entries } = await makeService();
    await service.dismiss({ id: 'a1', targetType: 'goal', targetId: 'g1', now: t0 });

    await service.pin({ id: 'a2', targetType: 'goal', targetId: 'g1', now: t0 });

    const storedEntries = await entries.list();
    expect(storedEntries).toHaveLength(1);
    expect(storedEntries[0].id).toBe('a2');
    expect(storedEntries[0].kind).toBe('pin');
  });

  it('dismiss replaces an existing pin for the same target', async () => {
    const { service, entries } = await makeService();
    await service.pin({ id: 'a1', targetType: 'goal', targetId: 'g1', now: t0 });

    await service.dismiss({ id: 'a2', targetType: 'goal', targetId: 'g1', now: t0 });

    const storedEntries = await entries.list();
    expect(storedEntries).toHaveLength(1);
    expect(storedEntries[0].id).toBe('a2');
    expect(storedEntries[0].kind).toBe('dismiss');
  });

  it('pin leaves entries of other targets untouched', async () => {
    const { service, entries } = await makeService();
    await service.pin({ id: 'a1', targetType: 'goal', targetId: 'g1', now: t0 });

    await service.pin({ id: 'a2', targetType: 'task', targetId: 'g1', now: t0 });

    expect(await entries.list()).toHaveLength(2);
  });

  it('clear removes any entries for the target', async () => {
    const { service, entries } = await makeService();
    await service.pin({ id: 'a1', targetType: 'goal', targetId: 'g1', now: t0 });
    await service.pin({ id: 'a2', targetType: 'goal', targetId: 'g2', now: t0 });

    await service.clear('goal', 'g1');

    const storedEntries = await entries.list();
    expect(storedEntries).toHaveLength(1);
    expect(storedEntries[0].targetId).toBe('g2');
  });

  it('clear on a target without entries is a no-op', async () => {
    const { service, entries } = await makeService();

    await service.clear('goal', 'g1');

    expect(await entries.list()).toHaveLength(0);
  });
});
