import { getCategoryName } from '@/domain/budget/categories';
import type { BudgetRow } from '@/application/useYearViewData';

export type YearSortKey =
  | 'name-asc' | 'name-desc'
  | 'category-asc' | 'category-desc'
  | 'value-asc' | 'value-desc';

export function sortYearBudgets(budgets: BudgetRow[], sortKey: YearSortKey): BudgetRow[] {
  return [...budgets].sort((a, b) => {
    switch (sortKey) {
      case 'name-asc':  return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'category-asc': {
        const cmp = getCategoryName(a.category_id).localeCompare(getCategoryName(b.category_id));
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      }
      case 'category-desc': {
        const cmp = getCategoryName(b.category_id).localeCompare(getCategoryName(a.category_id));
        return cmp !== 0 ? cmp : b.name.localeCompare(a.name);
      }
      case 'value-asc':  return a.default_amount - b.default_amount;
      case 'value-desc': return b.default_amount - a.default_amount;
      default: return 0;
    }
  });
}
