import { describe, it, expect } from 'vitest';
import { createLabelCache } from './labelCache';

describe('createLabelCache()', () => {
  it('returns names by table and id, and null otherwise', () => {
    const cache = createLabelCache();
    cache.setNames('budgets', new Map([['b-1', 'Arriendo']]));

    expect(cache.getName('budgets', 'b-1')).toBe('Arriendo');
    expect(cache.getName('budgets', 'b-2')).toBeNull();
    expect(cache.getName('debts', 'b-1')).toBeNull();
    expect(cache.getName('budgets', 42)).toBeNull();
  });

  it('replaces every name of a table on setNames', () => {
    const cache = createLabelCache();
    cache.setNames('budgets', new Map([['b-1', 'Arriendo']]));

    cache.setNames('budgets', new Map([['b-2', 'Mercado']]));

    expect(cache.getName('budgets', 'b-1')).toBeNull();
    expect(cache.getName('budgets', 'b-2')).toBe('Mercado');
  });

  it('forgets every name on clear', () => {
    const cache = createLabelCache();
    cache.setNames('budgets', new Map([['b-1', 'Arriendo']]));
    cache.setNames('debts', new Map([['d-1', 'Hipoteca']]));

    cache.clear();

    expect(cache.getName('budgets', 'b-1')).toBeNull();
    expect(cache.getName('debts', 'd-1')).toBeNull();
  });
});
