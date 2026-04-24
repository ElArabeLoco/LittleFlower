---
name: Dashboard Month Navigation Architecture
description: Key patterns and known issues from the dashboard month navigation implementation
type: project
---

The dashboard supports month navigation via `selectedMonth: string` state in `DashboardPage`, passed to `DashboardDataProvider` which feeds `useDashboardData(selectedMonth)`.

**Why:** Users need to browse historical months; the KPI widgets and charts must all reflect the same selected month.

**How to apply:** When reviewing dashboard-related PRs, verify that:
1. All context-fed widgets use `currentMonth` from `useMonthlyData()` (which comes from context) — not `getCurrentMonth()` directly.
2. Widgets with their own queries (BurnUp charts, DailySpend, RecentExpenses) receive `month` as a prop from `DashboardPage`.
3. `DebtEvolutionChart` and `DebtProgressChart` are intentionally NOT month-aware — they show all-time debt data. `prevNMonths(6)` in `DebtEvolutionChart` is pinned to today by design.

**Known acceptable staleness:** `todayMonth` is memoized with `[]` in `DashboardPage`, so it drifts if the app runs across a month boundary. Acceptable for MVP.

**Pre-existing lint warnings in dashboard (not introduced by nav feature):**
- `DebtEvolutionChart.tsx:29` — `useMemo` missing `shortMonth` dep (`react-hooks/exhaustive-deps`)
- `DashboardContext.tsx:42` — `react-refresh/only-export-components` (hook exported alongside component)
- `ExceededBudgetsChart` — `makeShortMonth(t)` called without `useMemo`, causing `shortMonth` to be a new ref every render and the expensive `useMemo` to bust every render
