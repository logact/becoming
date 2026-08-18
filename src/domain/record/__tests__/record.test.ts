import { Record } from '../Record';

const occurredAt = new Date('2026-01-01T01:00:00Z');

describe('Record', () => {
  it('sets fields exactly as given', () => {
    const record = Record.create({
      id: 'rec1',
      kind: 'statusChanged',
      detail: 'todo → doing',
      occurredAt,
    });
    expect(record.id).toBe('rec1');
    expect(record.kind).toBe('statusChanged');
    expect(record.detail).toBe('todo → doing');
    expect(record.occurredAt).toBe(occurredAt);
  });

  it('leaves detail undefined when omitted', () => {
    const record = Record.create({
      id: 'rec2',
      kind: 'created',
      occurredAt,
    });
    expect(record.detail).toBeUndefined();
  });
});
