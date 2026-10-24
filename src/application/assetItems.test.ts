import { describe, it, expect } from 'vitest';
import type { MemberRef } from '@/domain/member/HouseholdMember';
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
});
