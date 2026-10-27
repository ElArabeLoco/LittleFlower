import { describe, it, expect } from 'vitest';
import { sortAndFilterBudgets } from './sortAndFilterBudgets';
import type { BudgetRow, BudgetMonthRow } from '@/application/useMonthViewData';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MONTH = '2026-04';

function makeBudget(
  id: string,
  name: string,
  defaultAmount = 100_000,
  categoryId = 'other',
): BudgetRow {
  return {
    id,
    name,
    description: null,
    category_id: categoryId,
    payment_mode: 'cash',
    default_amount: defaultAmount,
    household_id: 'hh-1',
    start_month: '2026-01',
    end_month: null,
    debt_id: null,
  };
}

function makeBudgetMonth(
  budgetId: string,
  amount: number,
  isExecuted: 0 | 1 = 0,
): BudgetMonthRow {
  return { id: `bm-${budgetId}`, budget_id: budgetId, month: MONTH, amount, is_executed: isExecuted };
}

/** Build a bmMap from an array of BudgetMonthRows. */
function buildBmMap(rows: BudgetMonthRow[]): Map<string, BudgetMonthRow> {
  const m = new Map<string, BudgetMonthRow>();
  for (const r of rows) m.set(`${r.budget_id}|${r.month}`, r);
  return m;
}

const EMPTY_MAP: Map<string, BudgetMonthRow> = new Map();

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('sortAndFilterBudgets — filtering', () => {
  const budgets = [
    makeBudget('a', 'Arriendo'),
    makeBudget('b', 'Mercado'),
    makeBudget('c', 'Netflix'),
  ];

  it('empty filterText returns all budgets', () => {
    const result = sortAndFilterBudgets(budgets, 'name-asc', '', EMPTY_MAP, MONTH);
    expect(result).toHaveLength(3);
  });

  it('matches partial name (case-insensitive)', () => {
    const result = sortAndFilterBudgets(budgets, 'name-asc', 'arri', EMPTY_MAP, MONTH);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('is case-insensitive', () => {
    const result = sortAndFilterBudgets(budgets, 'name-asc', 'NETFLIX', EMPTY_MAP, MONTH);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c');
  });

  it('returns empty array when no names match', () => {
    const result = sortAndFilterBudgets(budgets, 'name-asc', 'zzz', EMPTY_MAP, MONTH);
    expect(result).toHaveLength(0);
  });

  it('trims leading/trailing whitespace from query', () => {
    const result = sortAndFilterBudgets(budgets, 'name-asc', '  mer  ', EMPTY_MAP, MONTH);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('handles empty budgets array', () => {
    const result = sortAndFilterBudgets([], 'name-asc', 'mercado', EMPTY_MAP, MONTH);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Sort: name
// ---------------------------------------------------------------------------

describe('sortAndFilterBudgets — name-asc', () => {
  it('sorts alphabetically A→Z', () => {
    const budgets = [makeBudget('c', 'Zara'), makeBudget('a', 'Apple'), makeBudget('b', 'Mercado')];
    const result = sortAndFilterBudgets(budgets, 'name-asc', '', EMPTY_MAP, MONTH);
    expect(result.map(b => b.name)).toEqual(['Apple', 'Mercado', 'Zara']);
  });
});

describe('sortAndFilterBudgets — name-desc', () => {
  it('sorts alphabetically Z→A', () => {
    const budgets = [makeBudget('c', 'Zara'), makeBudget('a', 'Apple'), makeBudget('b', 'Mercado')];
    const result = sortAndFilterBudgets(budgets, 'name-desc', '', EMPTY_MAP, MONTH);
    expect(result.map(b => b.name)).toEqual(['Zara', 'Mercado', 'Apple']);
  });
});

// ---------------------------------------------------------------------------
// Sort: value
// ---------------------------------------------------------------------------

describe('sortAndFilterBudgets — value-desc', () => {
  it('sorts by amount descending using default_amount when no bm row', () => {
    const budgets = [
      makeBudget('a', 'Arriendo', 500_000),
      makeBudget('b', 'Netflix',   52_000),
      makeBudget('c', 'Mercado',  200_000),
    ];
    const result = sortAndFilterBudgets(budgets, 'value-desc', '', EMPTY_MAP, MONTH);
    expect(result.map(b => b.id)).toEqual(['a', 'c', 'b']);
  });

  it('uses bm.amount when a BudgetMonthRow override exists', () => {
    const budgets = [makeBudget('a', 'A', 100_000), makeBudget('b', 'B', 500_000)];
    // Override: budget 'a' has a higher actual amount this month
    const bmMap = buildBmMap([makeBudgetMonth('a', 800_000)]);
    const result = sortAndFilterBudgets(budgets, 'value-desc', '', bmMap, MONTH);
    expect(result.map(b => b.id)).toEqual(['a', 'b']);
  });
});

describe('sortAndFilterBudgets — value-asc', () => {
  it('sorts by amount ascending', () => {
    const budgets = [
      makeBudget('a', 'Arriendo', 500_000),
      makeBudget('b', 'Netflix',   52_000),
      makeBudget('c', 'Mercado',  200_000),
    ];
    const result = sortAndFilterBudgets(budgets, 'value-asc', '', EMPTY_MAP, MONTH);
    expect(result.map(b => b.id)).toEqual(['b', 'c', 'a']);
  });
});

// ---------------------------------------------------------------------------
// Sort: category
// ---------------------------------------------------------------------------

describe('sortAndFilterBudgets — category-asc', () => {
  it('sorts by category name A→Z; ties broken by budget name A→Z', () => {
    // 'housing' → 'Vivienda', 'food' → 'Alimentación' (or 'Otro' for unknown)
    // Using known category IDs from categories.test.ts
    const budgets = [
      makeBudget('a', 'Arriendo',  500_000, 'housing'),  // Vivienda
      makeBudget('b', 'Mercado',   200_000, 'food'),     // Alimentación (or Otro)
      makeBudget('c', 'Gasolina',  120_000, 'housing'),  // Vivienda — tie
    ];
    const result = sortAndFilterBudgets(budgets, 'category-asc', '', EMPTY_MAP, MONTH);
    // Alimentación/food first, then Vivienda×2 sorted by name: Arriendo, Gasolina
    expect(result[result.length - 2].category_id).toBe('housing');
    expect(result[result.length - 1].category_id).toBe('housing');
    // Within Vivienda group: Arriendo before Gasolina
    const housingItems = result.filter(b => b.category_id === 'housing');
    expect(housingItems[0].name).toBe('Arriendo');
    expect(housingItems[1].name).toBe('Gasolina');
  });
});

describe('sortAndFilterBudgets — category-desc', () => {
  it('sorts by category name Z→A; ties broken by budget name Z→A', () => {
    const budgets = [
      makeBudget('a', 'Arriendo', 500_000, 'housing'), // Vivienda
      makeBudget('b', 'Mercado',  200_000, 'food'),    // Alimentación/Otro
      makeBudget('c', 'Gasolina', 120_000, 'housing'), // Vivienda — tie
    ];
    const result = sortAndFilterBudgets(budgets, 'category-desc', '', EMPTY_MAP, MONTH);
    // Vivienda first (higher alphabetically), then other
    const housingItems = result.filter(b => b.category_id === 'housing');
    // Within Vivienda: Z→A → Gasolina before Arriendo
    expect(housingItems[0].name).toBe('Gasolina');
    expect(housingItems[1].name).toBe('Arriendo');
  });
});

// ---------------------------------------------------------------------------
// Sort: pending-desc (the default)
// ---------------------------------------------------------------------------

describe('sortAndFilterBudgets — pending-desc', () => {
  it('shows pending items before executed items', () => {
    const budgets = [
      makeBudget('a', 'Arriendo'),
      makeBudget('b', 'Netflix'),
      makeBudget('c', 'Mercado'),
    ];
    const bmMap = buildBmMap([
      makeBudgetMonth('a', 500_000, 1), // executed
      makeBudgetMonth('b',  52_000, 0), // pending
      makeBudgetMonth('c', 200_000, 0), // pending
    ]);
    const result = sortAndFilterBudgets(budgets, 'pending-desc', '', bmMap, MONTH);
    const pendingIds = result.filter(b => {
      const bm = bmMap.get(`${b.id}|${MONTH}`);
      return !bm || bm.is_executed !== 1;
    }).map(b => b.id);
    const executedIds = result.filter(b => bmMap.get(`${b.id}|${MONTH}`)?.is_executed === 1).map(b => b.id);
    // All pending come before all executed
    const lastPendingIdx = Math.max(...pendingIds.map(id => result.findIndex(b => b.id === id)));
    const firstExecutedIdx = Math.min(...executedIds.map(id => result.findIndex(b => b.id === id)));
    expect(lastPendingIdx).toBeLessThan(firstExecutedIdx);
  });

  it('within pending: sorts by value descending (uses bm.amount)', () => {
    const budgets = [
      makeBudget('a', 'Netflix',   52_000),
      makeBudget('b', 'Mercado',  200_000),
      makeBudget('c', 'Arriendo', 500_000),
    ];
    const bmMap = buildBmMap([
      makeBudgetMonth('a',  52_000, 0),
      makeBudgetMonth('b', 200_000, 0),
      makeBudgetMonth('c', 500_000, 0),
    ]);
    const result = sortAndFilterBudgets(budgets, 'pending-desc', '', bmMap, MONTH);
    expect(result.map(b => b.id)).toEqual(['c', 'b', 'a']);
  });

  it('within pending: ties in value sorted alphabetically', () => {
    const budgets = [
      makeBudget('a', 'Zara',   100_000),
      makeBudget('b', 'Apple',  100_000),
    ];
    const bmMap = buildBmMap([
      makeBudgetMonth('a', 100_000, 0),
      makeBudgetMonth('b', 100_000, 0),
    ]);
    const result = sortAndFilterBudgets(budgets, 'pending-desc', '', bmMap, MONTH);
    expect(result.map(b => b.name)).toEqual(['Apple', 'Zara']);
  });

  it('within pending: falls back to default_amount when no bm row', () => {
    const budgets = [
      makeBudget('a', 'Netflix',   50_000),
      makeBudget('b', 'Arriendo', 500_000),
    ];
    // No bmMap entries — both pending, use default_amount
    const result = sortAndFilterBudgets(budgets, 'pending-desc', '', EMPTY_MAP, MONTH);
    expect(result.map(b => b.id)).toEqual(['b', 'a']); // 500k before 50k
  });

  it('within executed: sorts alphabetically', () => {
    const budgets = [
      makeBudget('a', 'Zara',   100_000),
      makeBudget('b', 'Apple',  200_000),
    ];
    const bmMap = buildBmMap([
      makeBudgetMonth('a', 100_000, 1),
      makeBudgetMonth('b', 200_000, 1),
    ]);
    const result = sortAndFilterBudgets(budgets, 'pending-desc', '', bmMap, MONTH);
    // Both executed: sorted by name A→Z
    expect(result.map(b => b.name)).toEqual(['Apple', 'Zara']);
  });

  it('budgets with no bm entry are treated as pending', () => {
    const budgets = [
      makeBudget('a', 'Executed', 100_000),
      makeBudget('b', 'NoBm',     200_000),
    ];
    const bmMap = buildBmMap([makeBudgetMonth('a', 100_000, 1)]);
    const result = sortAndFilterBudgets(budgets, 'pending-desc', '', bmMap, MONTH);
    // NoBm has no bm row → treated as pending → comes first
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('a');
  });

  it('does not mutate the original array', () => {
    const budgets = [makeBudget('a', 'A'), makeBudget('b', 'B')];
    const original = [...budgets];
    sortAndFilterBudgets(budgets, 'pending-desc', '', EMPTY_MAP, MONTH);
    expect(budgets).toEqual(original);
  });

  it('applies filter then sort (only matching budgets are sorted)', () => {
    const budgets = [
      makeBudget('a', 'Mercado',   200_000),
      makeBudget('b', 'Mercadito', 100_000),
      makeBudget('c', 'Netflix',    50_000),
    ];
    const bmMap = buildBmMap([
      makeBudgetMonth('a', 200_000, 0),
      makeBudgetMonth('b', 100_000, 0),
      makeBudgetMonth('c',  50_000, 0),
    ]);
    const result = sortAndFilterBudgets(budgets, 'pending-desc', 'merC', bmMap, MONTH);
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id)).toEqual(['a', 'b']); // 200k before 100k
  });
});
