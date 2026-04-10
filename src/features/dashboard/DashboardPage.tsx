import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { getCurrentMonth, getPreviousMonth, nextMonth, makeFullMonthLabel } from './helpers';
import { getCategoryEmoji } from '@/domain/budget/categories';
import { KpiStrip } from './KpiStrip';
import { TrendChart } from './TrendChart';
import { BalanceChart } from './BalanceChart';
import { CategoryPieChart } from './CategoryPieChart';
import { PaymentPieChart } from './PaymentPieChart';
import { TopBudgetsChart } from './TopBudgetsChart';
import { ExceededBudgetsChart } from './ExceededBudgetsChart';
import { RecentExpensesFeed } from './RecentExpensesFeed';
import { DebtProgressChart } from './DebtProgressChart';
import { DebtEvolutionChart } from './DebtEvolutionChart';
import { IncomeHistoryChart } from './IncomeHistoryChart';
import { DailySpendChart } from './DailySpendChart';
import { BudgetBurnUpChart } from './BudgetBurnUpChart';
import { CreditCardBurnUpChart } from './CreditCardBurnUpChart';
import { EmptyState } from './EmptyState';
import { DashboardDataProvider } from './DashboardContext';

export function DashboardPage() {
  const { session } = useAuth();
  const { t } = useI18n();
  const [todayMonth] = useState(getCurrentMonth);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);

  const fullMonth = useMemo(() => makeFullMonthLabel(t), [t]);
  const isAtCurrentMonth = selectedMonth >= todayMonth;

  const goToPrevMonth = useCallback(
    () => setSelectedMonth(m => getPreviousMonth(m)),
    [],
  );
  const goToNextMonth = useCallback(
    () => setSelectedMonth(m => {
      const next = nextMonth(m);
      return next > todayMonth ? m : next;
    }),
    [todayMonth],
  );

  return (
    <DashboardDataProvider selectedMonth={selectedMonth}>
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        emoji="✨"
        title="Dashboard"
        maxWidth="max-w-7xl"
      />

      {/* Month navigation bar */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sticky top-14 z-10">
        <div className="max-w-7xl mx-auto w-full px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex-1 text-center">
            <span className="text-base font-bold text-[var(--text-primary)]">
              {fullMonth(selectedMonth)}
            </span>
            <span className="text-base font-bold text-[var(--text-muted)] ml-2">
              {selectedMonth.slice(0, 4)}
            </span>
          </div>

          <button
            onClick={goToNextMonth}
            disabled={isAtCurrentMonth}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5 space-y-5">
        <KpiStrip />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TrendChart />
          <BalanceChart />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <CategoryPieChart />
          <PaymentPieChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DailySpendChart
            month={selectedMonth}
            categoryId="restaurants"
            title={`${getCategoryEmoji('restaurants')} ${t.dashboard.restaurantsThisMonth}`}
            subtitle={t.dashboard.restaurantsDailySpend}
            barColor="#fdba74"
            textColor="#fb923c"
          />
          <DailySpendChart
            month={selectedMonth}
            categoryId="groceries"
            title={`${getCategoryEmoji('groceries')} ${t.dashboard.groceriesThisMonth}`}
            subtitle={t.dashboard.groceriesDailySpend}
            barColor="#6ee7b7"
            textColor="#6ee7b7"
          />
        </div>

        {session?.householdId && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <BudgetBurnUpChart
                month={selectedMonth}
                isCurrentMonth={isAtCurrentMonth}
                budgetName="Domicilios"
                title={`${getCategoryEmoji('restaurants')} ${t.dashboard.burnUpDomiciliosTitle}`}
                subtitle={t.dashboard.burnUpDomiciliosDesc}
                color="#f472b6"
                householdId={session.householdId}
              />
              <BudgetBurnUpChart
                month={selectedMonth}
                isCurrentMonth={isAtCurrentMonth}
                budgetName="Mercado"
                title={`${getCategoryEmoji('groceries')} ${t.dashboard.burnUpMercadoTitle}`}
                subtitle={t.dashboard.burnUpMercadoDesc}
                color="#34d399"
                householdId={session.householdId}
              />
              <BudgetBurnUpChart
                month={selectedMonth}
                isCurrentMonth={isAtCurrentMonth}
                budgetName="Cosas de Salud"
                title={`${getCategoryEmoji('health')} ${t.dashboard.burnUpSaludTitle}`}
                subtitle={t.dashboard.burnUpSaludDesc}
                color="#60a5fa"
                householdId={session.householdId}
              />
            </div>
            <CreditCardBurnUpChart month={selectedMonth} isCurrentMonth={isAtCurrentMonth} householdId={session.householdId} />
          </>
        )}

        <TopBudgetsChart />
        <ExceededBudgetsChart />
        <RecentExpensesFeed month={selectedMonth} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <DebtProgressChart />
          <DebtEvolutionChart />
        </div>

        <IncomeHistoryChart />

        <EmptyState />
      </main>

      <AppNav />
    </div>
    </DashboardDataProvider>
  );
}
