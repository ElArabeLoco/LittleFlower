import { getCategoryName } from '@/domain/budget/categories';
import type { BudgetRow, BudgetMonthRow } from '@/application/useMonthViewData';
import type { SortKey } from '@/features/month/components/FilterSortBar';

export function sortAndFilterBudgets(
  budgets: BudgetRow[],
  sortKey: SortKey,
  filterText: string,
  bmMap: Map<string, BudgetMonthRow>,
  month: string,
): BudgetRow[] {
  const q = filterText.toLowerCase().trim();
  const filtered = q ? budgets.filter(b => b.name.toLowerCase().includes(q)) : budgets;

  return [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'pending-desc': {
        const bmA = bmMap.get(`${a.id}|${month}`);
        const bmB = bmMap.get(`${b.id}|${month}`);
        const execA = bmA?.is_executed === 1 ? 1 : 0;
        const execB = bmB?.is_executed === 1 ? 1 : 0;
        if (execA !== execB) return execA - execB;
        if (execA === 0) {
          const amtA = bmA?.amount ?? a.default_amount;
          const amtB = bmB?.amount ?? b.default_amount;
          if (amtB !== amtA) return amtB - amtA;
        }
        return a.name.localeCompare(b.name);
      }
      case 'value-desc': {
        const amtA = bmMap.get(`${a.id}|${month}`)?.amount ?? a.default_amount;
        const amtB = bmMap.get(`${b.id}|${month}`)?.amount ?? b.default_amount;
        return amtB - amtA;
      }
      case 'value-asc': {
        const amtA = bmMap.get(`${a.id}|${month}`)?.amount ?? a.default_amount;
        const amtB = bmMap.get(`${b.id}|${month}`)?.amount ?? b.default_amount;
        return amtA - amtB;
      }
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'category-asc': {
        const cmp = getCategoryName(a.category_id).localeCompare(getCategoryName(b.category_id));
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      }
      case 'category-desc': {
        const cmp = getCategoryName(b.category_id).localeCompare(getCategoryName(a.category_id));
        return cmp !== 0 ? cmp : b.name.localeCompare(a.name);
      }
      default:
        return 0;
    }
  });
}
