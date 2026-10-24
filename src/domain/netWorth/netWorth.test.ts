import { describe, it, expect } from 'vitest';
import { computeNetWorth, splitAmount, type WorthItem } from './netWorth';

const item = (id: string, amount: number, holderIds: string[] = [], kind = 'savings'): WorthItem => ({
  id, name: id, kind, amount, holderIds,
});

describe('splitAmount', () => {
  it('splits an integer amount in equal integer shares', () => {
    expect(splitAmount(900, 3)).toEqual([300, 300, 300]);
  });

  it('gives the remainder to the first shares, so the sum never changes', () => {
    expect(splitAmount(100, 3)).toEqual([34, 33, 33]);
    expect(splitAmount(1, 2)).toEqual([1, 0]);
  });

  it('returns no shares for nobody', () => {
    expect(splitAmount(100, 0)).toEqual([]);
  });
});

describe('computeNetWorth', () => {
  const members = ['ana', 'luis'];

  it('adds every asset and debt for the household, with the debt ratio', () => {
    const result = computeNetWorth(
      [item('casa', 400_000_000, ['ana', 'luis']), item('cdt', 100_000_000)],
      [item('hipoteca', 150_000_000, ['ana', 'luis'])],
      members,
    );

    expect(result.household.totals).toEqual({
      assets: 500_000_000,
      liabilities: 150_000_000,
      netWorth: 350_000_000,
      debtRatio: 0.3,
    });
  });

  it('splits a shared record equally between its holders', () => {
    const result = computeNetWorth(
      [item('casa', 400_000_000, ['ana', 'luis'])],
      [item('tarjeta', 3_000_000, ['ana'])],
      members,
    );

    expect(result.byMember.get('ana')!.totals).toMatchObject({ assets: 200_000_000, liabilities: 3_000_000, netWorth: 197_000_000 });
    expect(result.byMember.get('luis')!.totals).toMatchObject({ assets: 200_000_000, liabilities: 0, netWorth: 200_000_000 });
    expect(result.byMember.get('ana')!.assets).toEqual([
      { id: 'casa', name: 'casa', kind: 'savings', total: 400_000_000, share: 200_000_000, holderCount: 2 },
    ]);
  });

  it('puts records without holders in the shared group', () => {
    const result = computeNetWorth([item('cdt', 100)], [item('prestamo', 40)], members);

    expect(result.shared.totals).toEqual({ assets: 100, liabilities: 40, netWorth: 60, debtRatio: 0.4 });
    expect(result.shared.assets[0]).toMatchObject({ share: 100, holderCount: 0 });
    expect(result.byMember.get('ana')!.totals.assets).toBe(0);
  });

  it('members plus shared always add up to the household, also with odd splits', () => {
    const assets = [item('a', 100, ['ana', 'luis']), item('b', 7, ['luis']), item('c', 1_001)];
    const debts = [item('d', 33, ['ana', 'luis']), item('e', 5)];
    const result = computeNetWorth(assets, debts, ['ana', 'luis', 'eva']);

    const groups = [...result.byMember.values(), result.shared];
    expect(groups.reduce((s, g) => s + g.totals.assets, 0)).toBe(result.household.totals.assets);
    expect(groups.reduce((s, g) => s + g.totals.liabilities, 0)).toBe(result.household.totals.liabilities);
    expect(result.byMember.get('eva')!.totals).toEqual({ assets: 0, liabilities: 0, netWorth: 0, debtRatio: null });
  });

  it('ignores holders that are not active members (their share moves to the others)', () => {
    const result = computeNetWorth([item('casa', 100, ['ana', 'gone'])], [], members);

    expect(result.byMember.get('ana')!.totals.assets).toBe(100);
    expect(result.shared.totals.assets).toBe(0);
  });

  it('a record whose only holder is gone belongs to the household again', () => {
    const result = computeNetWorth([item('carro', 50, ['gone'])], [], members);
    expect(result.shared.totals.assets).toBe(50);
  });

  it('has no debt ratio without assets, and a negative net worth when debts win', () => {
    const result = computeNetWorth([], [item('d', 10)], members);
    expect(result.household.totals).toEqual({ assets: 0, liabilities: 10, netWorth: -10, debtRatio: null });
  });

  it('lists lines largest share first', () => {
    const result = computeNetWorth([item('small', 1), item('big', 9)], [], members);
    expect(result.household.assets.map(line => line.id)).toEqual(['big', 'small']);
  });
});
