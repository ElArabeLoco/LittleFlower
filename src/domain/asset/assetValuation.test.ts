import { describe, it, expect } from 'vitest';
import {
  initialValuationId,
  latestValuation,
  sortValuations,
  valueChange,
  type AssetValuation,
} from './assetValuation';

function valuation(over: Partial<AssetValuation> & Pick<AssetValuation, 'id'>): AssetValuation {
  return {
    assetId: 'a-1',
    value: 100,
    currency: 'COP',
    valuedOn: '2026-01-01',
    note: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    ...over,
  };
}

describe('initialValuationId', () => {
  it('is deterministic per asset', () => {
    expect(initialValuationId('a-1')).toBe('initial:a-1');
  });
});

describe('sortValuations', () => {
  it('orders oldest first by date, then by creation time', () => {
    const list = [
      valuation({ id: 'c', valuedOn: '2026-03-01' }),
      valuation({ id: 'b2', valuedOn: '2026-02-01', createdAt: '2026-02-05T00:00:00.000Z' }),
      valuation({ id: 'b1', valuedOn: '2026-02-01', createdAt: '2026-02-01T00:00:00.000Z' }),
      valuation({ id: 'a', valuedOn: '2025-12-31' }),
    ];
    expect(sortValuations(list).map(v => v.id)).toEqual(['a', 'b1', 'b2', 'c']);
    expect(list[0].id).toBe('c'); // does not mutate
  });
});

describe('latestValuation', () => {
  it('is the most recent by date even when written earlier', () => {
    const list = [
      valuation({ id: 'new', valuedOn: '2026-05-01', createdAt: '2026-05-01T00:00:00.000Z' }),
      valuation({ id: 'backfilled', valuedOn: '2025-01-01', createdAt: '2026-06-01T00:00:00.000Z' }),
    ];
    expect(latestValuation(list)?.id).toBe('new');
  });

  it('is null without valuations', () => {
    expect(latestValuation([])).toBeNull();
  });
});

describe('valueChange', () => {
  it('is null with fewer than two valuations', () => {
    expect(valueChange([], null)).toBeNull();
    expect(valueChange([valuation({ id: 'a' })], null)).toBeNull();
  });

  it('compares the latest value with the first one', () => {
    const change = valueChange(
      [
        valuation({ id: 'mid', value: 90_000_000, valuedOn: '2025-06-01' }),
        valuation({ id: 'last', value: 120_000_000, valuedOn: '2026-01-01' }),
        valuation({ id: 'first', value: 100_000_000, valuedOn: '2025-01-01' }),
      ],
      null,
    );
    expect(change?.from.id).toBe('first');
    expect(change?.to.id).toBe('last');
    expect(change?.delta).toBe(20_000_000);
    expect(change?.percent).toBe(20);
  });

  it('reports a depreciation as a negative change, rounded to one decimal', () => {
    const change = valueChange(
      [
        valuation({ id: 'first', value: 60_000_000, valuedOn: '2024-01-01' }),
        valuation({ id: 'last', value: 52_000_000, valuedOn: '2026-01-01' }),
      ],
      null,
    );
    expect(change?.delta).toBe(-8_000_000);
    expect(change?.percent).toBe(-13.3);
  });

  it('converts a first value in another currency with the TRM', () => {
    const list = [
      valuation({ id: 'first', value: 10_000, currency: 'USD', valuedOn: '2025-01-01' }),
      valuation({ id: 'last', value: 44_000_000, currency: 'COP', valuedOn: '2026-01-01' }),
    ];
    const change = valueChange(list, 4_000);
    expect(change?.delta).toBe(4_000_000);
    expect(change?.percent).toBe(10);
    expect(valueChange(list, null)).toBeNull();
  });

  it('has no percentage when the first value is zero', () => {
    const change = valueChange(
      [
        valuation({ id: 'first', value: 0, valuedOn: '2025-01-01' }),
        valuation({ id: 'last', value: 500, valuedOn: '2026-01-01' }),
      ],
      null,
    );
    expect(change?.delta).toBe(500);
    expect(change?.percent).toBeNull();
  });
});
