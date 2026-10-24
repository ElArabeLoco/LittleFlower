/**
 * FinancesHubPage — /finances
 *
 * Hub de navegación para la configuración financiera:
 *   - Ingresos        → /income
 *   - Presupuestos    → /settings/budgets
 *   - Deudas          → /debts
 *   - Transacciones   → /transactions
 *   - Integrantes     → /members
 */

import { TrendingUp, LayoutList, CreditCard, Receipt, Users } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { HubLinkCard } from '@/shared/ui/HubLinkCard';
import { useI18n } from '@/shared/i18n/I18nContext';

export function FinancesHubPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader title={t.finances.title} subtitle={t.finances.subtitle} maxWidth="max-w-3xl" />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <p className="mb-6 max-w-prose text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {t.finances.description}
        </p>

        {/* Each card spans two rows of this grid (subgrid), so titles and
            descriptions stay aligned across the cards of a row. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <HubLinkCard
            to="/income"
            title={t.finances.incomeTitle}
            description={t.finances.incomeDesc}
            icon={TrendingUp}
            tone="leaf"
          />
          <HubLinkCard
            to="/settings/budgets"
            title={t.finances.budgetsTitle}
            description={t.finances.budgetsDesc}
            icon={LayoutList}
            tone="petal"
          />
          <HubLinkCard
            to="/debts"
            title={t.finances.debtsTitle}
            description={t.finances.debtsDesc}
            icon={CreditCard}
            tone="polen"
          />
          <HubLinkCard
            to="/transactions"
            title={t.finances.transactionsTitle}
            description={t.finances.transactionsDesc}
            icon={Receipt}
            tone="iris"
          />
          <HubLinkCard
            to="/members"
            title={t.finances.membersTitle}
            description={t.finances.membersDesc}
            icon={Users}
            tone="sky"
          />
        </div>
      </main>

      <AppNav />
    </div>
  );
}
