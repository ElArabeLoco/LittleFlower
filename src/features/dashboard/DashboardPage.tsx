import { useAuth } from '@/features/auth/AuthContext';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { getCurrentMonth, makeShortMonth } from './helpers';
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
import { DailySpendChart } from './DailySpendChart';
import { EmptyState } from './EmptyState';

export function DashboardPage() {
  useAuth();
  const { t } = useI18n();
  const currentMonth = getCurrentMonth();
  const shortMonth = makeShortMonth(t);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        emoji="✨"
        title="Dashboard"
        subtitle={`${shortMonth(currentMonth)} ${currentMonth.slice(0, 4)}`}
        maxWidth="max-w-4xl"
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-5 space-y-5">
        <KpiStrip />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TrendChart />
          <BalanceChart />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <CategoryPieChart />
          <PaymentPieChart />
        </div>

        <TopBudgetsChart />
        <ExceededBudgetsChart />
        <RecentExpensesFeed />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <DebtProgressChart />
          <DebtEvolutionChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DailySpendChart
            categoryId="restaurants"
            title={`🍽️ ${t.dashboard.restaurantsThisMonth}`}
            subtitle={t.dashboard.restaurantsDailySpend}
            barColor="#fdba74"
            textColor="#fb923c"
          />
          <DailySpendChart
            categoryId="groceries"
            title={`🛍️ ${t.dashboard.groceriesThisMonth}`}
            subtitle={t.dashboard.groceriesDailySpend}
            barColor="#6ee7b7"
            textColor="#6ee7b7"
          />
        </div>

        <EmptyState />
      </main>

      <AppNav />
    </div>
  );
}
