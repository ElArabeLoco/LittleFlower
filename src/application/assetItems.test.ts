import { describe, it, expect } from 'vitest';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import type { AssetValuation } from '@/domain/asset/assetValuation';
import { toAssetItems } from './assetItems';

const ana: MemberRef = { id: 'm-ana', name: 'Ana', tone: 'iris' };

describe('toAssetItems', () => {
  const rows = [
    { id: 'a1', name: 'Apartamento', kind: 'real_estate', value: 450_000_000, currency: 'COP' },
    { id: 'a2', name: 'Cuenta en dólares', kind: 'savings', value: 2_000, currency: 'USD' },
    { id: 'a3', name: 'Algo raro', kind: 'spaceship', value: 1, currency: 'EUR' },
  ];

  it('converts USD with the TRM and keeps COP as is', () => {
    const items = toAssetItems(rows, 4_000, new Map([['a1', [ana]]]));

    expect(items.map(i => [i.id, i.valueCOP, i.missingTrm])).toEqual([
      ['a1', 450_000_000, false],
      ['a2', 8_000_000, false],
      ['a3', 1, false],
    ]);
    expect(items[0].holders).toEqual([ana]);
    expect(items[1].holders).toEqual([]);
  });

  it('flags USD assets without a TRM and counts them as 0', () => {
    const [, usd] = toAssetItems(rows, null, new Map());
    expect(usd).toMatchObject({ valueCOP: 0, missingTrm: true });
  });

  it('reads unknown kinds and currencies safely', () => {
    const [, , odd] = toAssetItems(rows, null, new Map());
    expect(odd).toMatchObject({ kind: 'other', currency: 'COP' });
  });

  it('attaches the value history oldest first and the change, also in COP', () => {
    const point = (id: string, assetId: string, value: number, valuedOn: string, currency: 'COP' | 'USD' = 'COP'): AssetValuation => ({
      id, assetId, value, currency, valuedOn, note: null, createdAt: `${valuedOn}T00:00:00.000Z`,
    });
    const valuations = new Map([
      ['a1', [point('v2', 'a1', 450_000_000, '2026-06-01'), point('v1', 'a1', 400_000_000, '2025-01-01')]],
      ['a2', [point('u1', 'a2', 2_500, '2025-01-01', 'USD'), point('u2', 'a2', 2_000, '2026-01-01', 'USD')]],
    ]);

    const [cop, usd, none] = toAssetItems(rows, 4_000, new Map(), valuations);
    expect(cop.history.map(v => [v.id, v.inCurrent, v.fromPrevious])).toEqual([
      ['v1', 400_000_000, null],
      ['v2', 450_000_000, 50_000_000],
    ]);
    expect(cop.change).toMatchObject({ delta: 50_000_000, percent: 12.5 });
    expect(cop.changeCOP).toBe(50_000_000);
    expect(usd.changeCOP).toBe(-2_000_000);
    expect(none).toMatchObject({ history: [], change: null, changeCOP: null });

    const [, usdWithoutTrm] = toAssetItems(rows, null, new Map(), valuations);
    expect(usdWithoutTrm.change).toMatchObject({ delta: -500 });
    expect(usdWithoutTrm.changeCOP).toBeNull();
  });
});
