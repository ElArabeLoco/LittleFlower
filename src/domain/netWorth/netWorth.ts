/**
 * Net worth (patrimonio) — what the household owns minus what it owes.
 *
 * Assets count at their current value and liabilities at the outstanding
 * balance of each debt, both already in COP. Per member:
 *
 *   - a record with N holders counts amount / N for each of them (integer
 *     shares; the remainder goes to the first holders, so nothing is lost);
 *   - a record with no holders — or whose holders are all gone — belongs to
 *     the household as a whole: the "shared" group.
 *
 * So the members plus the shared group always add up to the household total.
 */

/** One asset or one debt, in COP. */
export interface WorthItem {
  id: string;
  name: string;
  /** Asset kind or debt kind, carried through for grouping. */
  kind: string;
  /** Integer COP, >= 0 (asset value or outstanding debt balance). */
  amount: number;
  /** Holder member ids in display order (empty = the whole household). */
  holderIds: string[];
}

/** One record as it counts for a group. */
export interface WorthLine {
  id: string;
  name: string;
  kind: string;
  /** The whole record. */
  total: number;
  /** What counts for this group (the whole record for the household). */
  share: number;
  /** Active holders of the record (0 = the whole household). */
  holderCount: number;
}

export interface WorthTotals {
  assets: number;
  liabilities: number;
  netWorth: number;
  /** Liabilities / assets; null when there are no assets. */
  debtRatio: number | null;
}

export interface WorthGroup {
  totals: WorthTotals;
  /** Largest share first. */
  assets: WorthLine[];
  /** Largest share first. */
  liabilities: WorthLine[];
}

export interface NetWorth {
  household: WorthGroup;
  /** One group per active member (every member, even with nothing). */
  byMember: Map<string, WorthGroup>;
  /** Records without active holders. */
  shared: WorthGroup;
}

/** `amount` in `n` integer shares that add up to it; the remainder goes first. */
export function splitAmount(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

interface MutableGroup {
  assets: WorthLine[];
  liabilities: WorthLine[];
}

export function computeNetWorth(
  assets: WorthItem[],
  liabilities: WorthItem[],
  memberIds: string[],
): NetWorth {
  const active = new Set(memberIds);
  const household: MutableGroup = { assets: [], liabilities: [] };
  const shared: MutableGroup = { assets: [], liabilities: [] };
  const members = new Map<string, MutableGroup>(memberIds.map(id => [id, { assets: [], liabilities: [] }]));

  function place(items: WorthItem[], side: keyof MutableGroup) {
    for (const item of items) {
      const holders = item.holderIds.filter(id => active.has(id));
      const line = (share: number): WorthLine => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        total: item.amount,
        share,
        holderCount: holders.length,
      });

      household[side].push(line(item.amount));
      if (holders.length === 0) {
        shared[side].push(line(item.amount));
        continue;
      }
      splitAmount(item.amount, holders.length).forEach((share, i) => {
        members.get(holders[i])![side].push(line(share));
      });
    }
  }

  place(assets, 'assets');
  place(liabilities, 'liabilities');

  return {
    household: finish(household),
    byMember: new Map([...members].map(([id, group]) => [id, finish(group)])),
    shared: finish(shared),
  };
}

function finish(group: MutableGroup): WorthGroup {
  const byShare = (a: WorthLine, b: WorthLine) => b.share - a.share;
  const assets = [...group.assets].sort(byShare);
  const liabilities = [...group.liabilities].sort(byShare);
  const assetsTotal = sumShares(assets);
  const liabilitiesTotal = sumShares(liabilities);
  return {
    totals: {
      assets: assetsTotal,
      liabilities: liabilitiesTotal,
      netWorth: assetsTotal - liabilitiesTotal,
      debtRatio: assetsTotal > 0 ? liabilitiesTotal / assetsTotal : null,
    },
    assets,
    liabilities,
  };
}

function sumShares(lines: WorthLine[]): number {
  return lines.reduce((sum, line) => sum + line.share, 0);
}
