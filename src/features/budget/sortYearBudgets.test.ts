import { describe, it, expect } from 'vitest';
import { sortYearBudgets } from './sortYearBudgets';
import type { BudgetRow } from '@/application/useYearViewData';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sort: name
// ---------------------------------------------------------------------------

describe('sortYearBudgets — name-asc', () => {
  it('sorts alphabetically A→Z', () => {
    const budgets = [makeBudget('c', 'Zara'), makeBudget('a', 'Apple'), makeBudget('b', 'Mercado')];
    const result = sortYearBudgets(budgets, 'name-asc');
    expect(result.map(b => b.name)).toEqual(['Apple', 'Mercado', 'Zara']);
  });

  it('does not mutate the original array', () => {
    const budgets = [makeBudget('a', 'Zara'), makeBudget('b', 'Apple')];
    const original = [...budgets];
    sortYearBudgets(budgets, 'name-asc');
    expect(budgets).toEqual(original);
  });
});

describe('sortYearBudgets — name-desc', () => {
  it('sorts alphabetically Z→A', () => {
    const budgets = [makeBudget('c', 'Zara'), makeBudget('a', 'Apple'), makeBudget('b', 'Mercado')];
    const result = sortYearBudgets(budgets, 'name-desc');
    expect(result.map(b => b.name)).toEqual(['Zara', 'Mercado', 'Apple']);
  });
});

// ---------------------------------------------------------------------------
// Sort: value
// ---------------------------------------------------------------------------

describe('sortYearBudgets — value-desc', () => {
  it('sorts by default_amount descending', () => {
    const budgets = [
      makeBudget('a', 'Arriendo', 500_000),
      makeBudget('b', 'Netflix',   52_000),
      makeBudget('c', 'Mercado',  200_000),
    ];
    const result = sortYearBudgets(budgets, 'value-desc');
    expect(result.map(b => b.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('sortYearBudgets — value-asc', () => {
  it('sorts by default_amount ascending', () => {
    const budgets = [
      makeBudget('a', 'Arriendo', 500_000),
      makeBudget('b', 'Netflix',   52_000),
      makeBudget('c', 'Mercado',  200_000),
    ];
    const result = sortYearBudgets(budgets, 'value-asc');
    expect(result.map(b => b.id)).toEqual(['b', 'c', 'a']);
  });
});

// ---------------------------------------------------------------------------
// Sort: category
// ---------------------------------------------------------------------------

describe('sortYearBudgets — category-asc', () => {
  it('sorts by category name A→Z; ties broken by budget name A→Z', () => {
    const budgets = [
      makeBudget('a', 'Arriendo', 500_000, 'housing'),  // Vivienda
      makeBudget('b', 'Mercado',  200_000, 'food'),     // Alimentación
      makeBudget('c', 'Gasolina', 120_000, 'housing'),  // Vivienda — tie
    ];
    const result = sortYearBudgets(budgets, 'category-asc');
    // housing (Vivienda) items should come last (alphabetically after food/Alimentación)
    expect(result[result.length - 2].category_id).toBe('housing');
    expect(result[result.length - 1].category_id).toBe('housing');
    // Within Vivienda group: Arriendo before Gasolina
    const housingItems = result.filter(b => b.category_id === 'housing');
    expect(housingItems[0].name).toBe('Arriendo');
    expect(housingItems[1].name).toBe('Gasolina');
  });

  it('handles single-item list', () => {
    const budgets = [makeBudget('a', 'Arriendo', 500_000, 'housing')];
    const result = sortYearBudgets(budgets, 'category-asc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });
});

describe('sortYearBudgets — category-desc', () => {
  it('sorts by category name Z→A; ties broken by budget name Z→A', () => {
    const budgets = [
      makeBudget('a', 'Arriendo', 500_000, 'housing'), // Vivienda
      makeBudget('b', 'Mercado',  200_000, 'food'),    // Alimentación
      makeBudget('c', 'Gasolina', 120_000, 'housing'), // Vivienda — tie
    ];
    const result = sortYearBudgets(budgets, 'category-desc');
    // Vivienda comes first (Z→A)
    expect(result[0].category_id).toBe('housing');
    expect(result[1].category_id).toBe('housing');
    // Within Vivienda: Z→A → Gasolina before Arriendo
    const housingItems = result.filter(b => b.category_id === 'housing');
    expect(housingItems[0].name).toBe('Gasolina');
    expect(housingItems[1].name).toBe('Arriendo');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('sortYearBudgets — edge cases', () => {
  it('returns empty array unchanged', () => {
    expect(sortYearBudgets([], 'name-asc')).toEqual([]);
  });

  it('returns single-item array unchanged', () => {
    const budgets = [makeBudget('a', 'Netflix')];
    const result = sortYearBudgets(budgets, 'value-desc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('stable with equal values (same default_amount)', () => {
    const budgets = [
      makeBudget('a', 'Zara',   100_000),
      makeBudget('b', 'Apple',  100_000),
      makeBudget('c', 'Mango',  100_000),
    ];
    // value-desc with ties: order is implementation-defined but should not throw
    expect(() => sortYearBudgets(budgets, 'value-desc')).not.toThrow();
    expect(sortYearBudgets(budgets, 'value-desc')).toHaveLength(3);
  });
});
