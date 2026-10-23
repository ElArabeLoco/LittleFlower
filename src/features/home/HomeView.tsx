/**
 * HomeView — presentational layout of the Home page.
 *
 *   Greeting + date (large title)
 *   ┌──── month summary ────────────┐┌ record ┐   lg: side by side
 *   └───────────────────────────────┘└────────┘   below lg: stacked
 *   Sections: 8 tiles (2 columns on phones, 4 from md)
 *   ┌ pending this month ┐┌ recent expenses ┐     lg: side by side
 */

import type { HomeData } from '@/application/useHomeData';
import type { MonthBudget } from '@/application/homeSummary';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNav } from '@/shared/ui/AppNav';
import { MonthSummaryCard } from './components/MonthSummaryCard';
import { PendingBudgetsCard } from './components/PendingBudgetsCard';
import { QuickActionsCard } from './components/QuickActionsCard';
import { RecentExpensesCard } from './components/RecentExpensesCard';
import { SectionTiles, type SectionLines } from './components/SectionTiles';

const PENDING_LIMIT = 5;

export interface HomeViewProps {
  greeting: string;
  dateLine: string;
  monthLabel: string;
  data: HomeData;
  trmText: string | null;
  sectionLines: SectionLines;
  pendingTotalText: string;
  busyId: string | null;
  mutationError: string | null;
  onRecordExpense: () => void;
  onMarkExecuted: (item: MonthBudget) => void;
  /** Dialogs owned by the container. */
  children?: React.ReactNode;
}

export function HomeView({
  greeting,
  dateLine,
  monthLabel,
  data,
  trmText,
  sectionLines,
  pendingTotalText,
  busyId,
  mutationError,
  onRecordExpense,
  onMarkExecuted,
  children,
}: HomeViewProps) {
  const { pending } = data.budgets;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)] text-[var(--text-primary)]">
      <AppHeader title={greeting} subtitle={dateLine} maxWidth="max-w-6xl" />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-10 pt-2">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <MonthSummaryCard monthLabel={monthLabel} balance={data.balance} hasMissingTrm={data.hasMissingTrm} />
          <QuickActionsCard onRecordExpense={onRecordExpense} trmText={trmText} />
        </div>

        <SectionTiles lines={sectionLines} />

        <div className="grid gap-4 lg:grid-cols-2">
          <PendingBudgetsCard
            items={pending.slice(0, PENDING_LIMIT)}
            moreCount={Math.max(0, pending.length - PENDING_LIMIT)}
            totalText={pendingTotalText}
            busyId={busyId}
            error={mutationError}
            onMarkExecuted={onMarkExecuted}
          />
          <RecentExpensesCard expenses={data.recentExpenses} />
        </div>
      </main>

      {children}

      <AppNav />
    </div>
  );
}
