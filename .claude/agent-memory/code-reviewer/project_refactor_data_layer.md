---
name: data_access_layer_refactor
description: Architecture decisions from the infrastructure/queries + application hook refactor (March 2026)
type: project
---

The codebase went through a major refactoring that introduced a proper data access layer structure:
- `src/infrastructure/powersync/queries/` — all SQL strings as typed `useQuery<T>` hooks
- `src/application/` — all business calculations (income conversion, balance calc, etc.) as hooks
- Feature components should have zero SQL and zero domain calculations

**Why:** Prior to this, SQL strings and calculations were scattered inside feature components, violating DDD layering.

**How to apply:** When reviewing new features, verify SQL strings are in `queries/`, calculations are in `application/`, and feature components only compose these.

## Established patterns from this refactor
- Query hooks return `{ data: T[], isLoading, error }` via PowerSync `useQuery<T>`
- Application hooks compose multiple query hooks and use `useMemo` for derived state
- Empty-query sentinel pattern: `WHERE 1=0` used when a parameter is null/empty to avoid conditional hook calls (e.g., `useExpensesForBudgetMonth(null)`)
- Lookup maps use `${budgetId}|${month}` composite keys as strings
- Thin adapters in features (`useMonthlyData.ts`, `useDebtData.ts`, etc.) are the accepted pattern for locale-aware label injection
- Re-export adapters (`export { useFoo as useBar }`) are acceptable for surfacing application hooks under feature-local names

## Known bugs introduced in this refactor (to watch for in future PRs)
1. `MonthViewPage.tsx` line 582: references `activeForMonth` which no longer exists in scope — now `creditCardBudgets` and `cashBudgets` are the correct substitutes
2. `MonthViewPage.tsx` lines 627-628: passes `imMap` and `trm` to `<IncomeSection>` but neither is destructured from `useMonthViewData` — `imMap` is not in the returned object and `trm` is not destructured at the call site
3. `IncomePage.tsx` line 28: destructures `hasUSDIncome` from `useIncomeData(month)` but `IncomeSummary` interface does not export that field (it's a private intermediate variable in `useIncomeSummary`)
4. `YearView.tsx` line 543: references `budgets` which is not destructured from `useYearViewData` at the call site
5. `AppShell.tsx` lines 175/178: `totalExecuted` and `trm` are destructured from `useAppShellData` but never used in the component
6. `YearView.tsx` line 30: imports `BudgetMonthRow` from `useYearViewData` but never uses it
7. `ExpenseFormDialog.tsx` line 35: `type ExpenseRow = ExpenseListRow` — local alias declared but flagged as unused by TS
