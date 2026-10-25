import type { ReactNode } from 'react';
import type { WidgetId } from '@/domain/dashboard/dashboardLayout';
import { getCategoryEmoji } from '@/domain/budget/categories';
import type { Translations } from '@/shared/i18n/translations/es';
import { ChartCard } from '../shared';
import { KpiStrip } from '../KpiStrip';
import { TrendChart } from '../TrendChart';
import { BalanceChart } from '../BalanceChart';
import { CategoryPieChart } from '../CategoryPieChart';
import { PaymentPieChart } from '../PaymentPieChart';
import { TopBudgetsChart } from '../TopBudgetsChart';
import { RecentExpensesFeed } from '../RecentExpensesFeed';
import { DebtProgressChart } from '../DebtProgressChart';
import { DebtEvolutionChart } from '../DebtEvolutionChart';
import { IncomeHistoryChart } from '../IncomeHistoryChart';
import { ExpenseHistoryChart } from '../ExpenseHistoryChart';
import { DailySpendChart } from '../DailySpendChart';
import { BudgetBurnUpChart } from '../BudgetBurnUpChart';
import { CreditCardBurnUpChart } from '../CreditCardBurnUpChart';
import { CashBurnUpChart } from '../CashBurnUpChart';
import { PendingPaymentsChart } from '../PendingPaymentsChart';

export interface WidgetContext {
  month: string;
  isCurrentMonth: boolean;
  householdId: string | null;
  t: Translations;
}

interface WidgetDefinition {
  title: (t: Translations) => string;
  subtitle: (t: Translations) => string;
  /** Color of the widget's thumbnail in the catalog. */
  accent: string;
  /** Renders the widget; null when it cannot show anything (e.g. no household yet). */
  render: (ctx: WidgetContext) => ReactNode;
}

/** Every catalog widget: the components of the original dashboard, with their original props. */
export const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  kpis: {
    title: t => t.dashboard.kpisTitle,
    subtitle: t => t.dashboard.kpisDesc,
    accent: '#f472b6',
    render: ({ t }) => (
      <ChartCard title={t.dashboard.kpisTitle} subtitle={t.dashboard.kpisDesc} bare>
        <KpiStrip />
      </ChartCard>
    ),
  },
  trend: {
    title: t => t.dashboard.trend6m,
    subtitle: t => t.dashboard.budgetedVsSpent,
    accent: '#f472b6',
    render: () => <TrendChart />,
  },
  balance: {
    title: t => t.dashboard.balanceOverTime,
    subtitle: t => t.dashboard.availableMinusCashSpent,
    accent: '#a78bfa',
    render: () => <BalanceChart />,
  },
  byCategory: {
    title: t => t.dashboard.spendByCategory,
    subtitle: t => t.dashboard.distributionThisMonth,
    accent: '#f472b6',
    render: () => <CategoryPieChart />,
  },
  byPayment: {
    title: t => t.dashboard.paymentTypeDistribution,
    subtitle: t => t.dashboard.cardVsCash,
    accent: '#a78bfa',
    render: () => <PaymentPieChart />,
  },
  dailyDelivery: {
    title: t => t.dashboard.restaurantsThisMonth,
    subtitle: t => t.dashboard.restaurantsDailySpend,
    accent: '#fdba74',
    render: ({ month, t }) => (
      <DailySpendChart
        month={month}
        categoryId="restaurants"
        title={`${getCategoryEmoji('restaurants')} ${t.dashboard.restaurantsThisMonth}`}
        subtitle={t.dashboard.restaurantsDailySpend}
        barColor="#fdba74"
        textColor="#fb923c"
      />
    ),
  },
  dailyGroceries: {
    title: t => t.dashboard.groceriesThisMonth,
    subtitle: t => t.dashboard.groceriesDailySpend,
    accent: '#6ee7b7',
    render: ({ month, t }) => (
      <DailySpendChart
        month={month}
        categoryId="groceries"
        title={`${getCategoryEmoji('groceries')} ${t.dashboard.groceriesThisMonth}`}
        subtitle={t.dashboard.groceriesDailySpend}
        barColor="#6ee7b7"
        textColor="#6ee7b7"
      />
    ),
  },
  burnDelivery: {
    title: t => t.dashboard.burnUpDomiciliosTitle,
    subtitle: t => t.dashboard.burnUpDomiciliosDesc,
    accent: '#f472b6',
    render: ({ month, isCurrentMonth, householdId, t }) =>
      householdId && (
        <BudgetBurnUpChart
          month={month}
          isCurrentMonth={isCurrentMonth}
          budgetName="Domicilios"
          title={`${getCategoryEmoji('restaurants')} ${t.dashboard.burnUpDomiciliosTitle}`}
          subtitle={t.dashboard.burnUpDomiciliosDesc}
          color="#f472b6"
          householdId={householdId}
        />
      ),
  },
  burnGroceries: {
    title: t => t.dashboard.burnUpMercadoTitle,
    subtitle: t => t.dashboard.burnUpMercadoDesc,
    accent: '#34d399',
    render: ({ month, isCurrentMonth, householdId, t }) =>
      householdId && (
        <BudgetBurnUpChart
          month={month}
          isCurrentMonth={isCurrentMonth}
          budgetName="Mercado"
          title={`${getCategoryEmoji('groceries')} ${t.dashboard.burnUpMercadoTitle}`}
          subtitle={t.dashboard.burnUpMercadoDesc}
          color="#34d399"
          householdId={householdId}
        />
      ),
  },
  burnHealth: {
    title: t => t.dashboard.burnUpSaludTitle,
    subtitle: t => t.dashboard.burnUpSaludDesc,
    accent: '#60a5fa',
    render: ({ month, isCurrentMonth, householdId, t }) =>
      householdId && (
        <BudgetBurnUpChart
          month={month}
          isCurrentMonth={isCurrentMonth}
          budgetName="Cosas de Salud"
          title={`${getCategoryEmoji('health')} ${t.dashboard.burnUpSaludTitle}`}
          subtitle={t.dashboard.burnUpSaludDesc}
          color="#60a5fa"
          householdId={householdId}
        />
      ),
  },
  burnCard: {
    title: t => t.dashboard.burnUpCreditCardTitle,
    subtitle: t => t.dashboard.burnUpCreditCardDesc,
    accent: '#a78bfa',
    render: ({ month, isCurrentMonth, householdId }) =>
      householdId && <CreditCardBurnUpChart month={month} isCurrentMonth={isCurrentMonth} householdId={householdId} />,
  },
  burnCash: {
    title: t => t.dashboard.burnUpCashTitle,
    subtitle: t => t.dashboard.burnUpCashDesc,
    accent: '#fbbf24',
    render: ({ month, isCurrentMonth, householdId }) =>
      householdId && <CashBurnUpChart month={month} isCurrentMonth={isCurrentMonth} householdId={householdId} />,
  },
  pending: {
    title: t => t.dashboard.pendingPayments,
    subtitle: t => t.dashboard.pendingDesc,
    accent: '#fbbf24',
    render: ({ householdId }) => householdId && <PendingPaymentsChart />,
  },
  topBudgets: {
    title: t => t.dashboard.topBudgets,
    subtitle: t => t.dashboard.executionLabel,
    accent: '#6ee7b7',
    render: () => <TopBudgetsChart />,
  },
  recent: {
    title: t => t.dashboard.recentExpenses,
    subtitle: t => t.dashboard.recentExpensesDesc,
    accent: '#c4b5fd',
    render: ({ month }) => <RecentExpensesFeed month={month} />,
  },
  debtProgress: {
    title: t => t.dashboard.debtProgress,
    subtitle: t => t.dashboard.debtProgressDesc,
    accent: '#f472b6',
    render: () => <DebtProgressChart />,
  },
  debtEvolution: {
    title: t => t.dashboard.debtEvolution,
    subtitle: t => t.dashboard.debtEvolutionDesc,
    accent: '#f472b6',
    render: () => <DebtEvolutionChart />,
  },
  incomeHistory: {
    title: t => t.dashboard.incomeHistory,
    subtitle: t => t.dashboard.incomeHistoryDesc,
    accent: '#a78bfa',
    render: () => <IncomeHistoryChart />,
  },
  histDelivery: {
    title: t => t.dashboard.expenseHistoryDomicilios,
    subtitle: t => t.dashboard.expenseHistoryDomiciliosDesc,
    accent: '#fdba74',
    render: ({ householdId, t }) =>
      householdId && (
        <ExpenseHistoryChart
          budgetName="Domicilios"
          title={t.dashboard.expenseHistoryDomicilios}
          subtitle={t.dashboard.expenseHistoryDomiciliosDesc}
          label={t.dashboard.expenseHistoryDomiciliosLabel}
          householdId={householdId}
        />
      ),
  },
  histGroceries: {
    title: t => t.dashboard.expenseHistoryMercado,
    subtitle: t => t.dashboard.expenseHistoryMercadoDesc,
    accent: '#6ee7b7',
    render: ({ householdId, t }) =>
      householdId && (
        <ExpenseHistoryChart
          budgetName="Mercado"
          title={t.dashboard.expenseHistoryMercado}
          subtitle={t.dashboard.expenseHistoryMercadoDesc}
          label={t.dashboard.expenseHistoryMercadoLabel}
          householdId={householdId}
        />
      ),
  },
  histFiados: {
    title: t => t.dashboard.expenseHistoryFiados,
    subtitle: t => t.dashboard.expenseHistoryFiadosDesc,
    accent: '#f9a8d4',
    render: ({ householdId, t }) =>
      householdId && (
        <ExpenseHistoryChart
          budgetName="Cuenta Fiados Cactus"
          title={t.dashboard.expenseHistoryFiados}
          subtitle={t.dashboard.expenseHistoryFiadosDesc}
          label={t.dashboard.expenseHistoryFiadosLabel}
          householdId={householdId}
        />
      ),
  },
  histHealth: {
    title: t => t.dashboard.expenseHistorySalud,
    subtitle: t => t.dashboard.expenseHistorySaludDesc,
    accent: '#93c5fd',
    render: ({ householdId, t }) =>
      householdId && (
        <ExpenseHistoryChart
          budgetName="Cosas de Salud"
          title={t.dashboard.expenseHistorySalud}
          subtitle={t.dashboard.expenseHistorySaludDesc}
          label={t.dashboard.expenseHistorySaludLabel}
          householdId={householdId}
        />
      ),
  },
};
