/**
 * Label cache — budget, income, debt and asset names by id.
 *
 * CRUD entries and changed rows often carry only a foreign key (an expense's
 * budget_id, an income month's income_id). The activity log resolves those
 * ids to names through this cache, the default NameLookup of describeRecord.
 *
 * The download tracker fills it from local SQLite; until then every lookup
 * returns null and changes are simply described without a related name.
 */

export type LabelTable = 'budgets' | 'incomes' | 'debts' | 'assets';

export interface LabelCache {
  getName(table: LabelTable, id: unknown): string | null;
  /** Replaces every known name of `table`. */
  setNames(table: LabelTable, names: Map<string, string>): void;
  /** Forgets every name (sign-out or another user). */
  clear(): void;
}

export function createLabelCache(): LabelCache {
  const names = new Map<LabelTable, Map<string, string>>();

  // Arrow functions: the methods are passed around unbound as NameLookup.
  return {
    getName: (table, id) => (typeof id === 'string' ? names.get(table)?.get(id) ?? null : null),
    setNames: (table, tableNames) => {
      names.set(table, new Map(tableNames));
    },
    clear: () => {
      names.clear();
    },
  };
}

/** App-wide cache shared by the connector and the trackers. */
export const labelCache: LabelCache = createLabelCache();
