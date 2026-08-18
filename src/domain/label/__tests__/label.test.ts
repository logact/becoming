import { Label } from '../Label';

describe('Label', () => {
  it('is created with a name and optional color', () => {
    const label = Label.create({ id: 'l1', name: 'health', color: '#00ff00' });
    expect(label.id).toBe('l1');
    expect(label.name).toBe('health');
    expect(label.color).toBe('#00ff00');
  });

  it('renames', () => {
    const label = Label.create({ id: 'l1', name: 'health' });
    label.rename('fitness');
    expect(label.name).toBe('fitness');
    expect(label.color).toBeUndefined();
  });
});
