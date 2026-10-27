/**
 * FinancesHubPage — /finances
 *
 * Hub for the household plan and where it stands. Day-to-day spending lives
 * in the Gastos tab; the household's members, in Perfil.
 *   Cómo vamos      → Patrimonio (/net-worth)
 *   Plan del hogar  → Ingresos (/income), Partidas (/settings/budgets),
 *                     Deudas (/debts), Activos (/assets)
 */

import { TrendingUp, LayoutList, CreditCard, PiggyBank, Scale } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { HubLinkCard } from '@/shared/ui/HubLinkCard';
import { useI18n } from '@/shared/i18n/useI18n';

function GroupTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 text-lg font-[700] tracking-[-0.01em] text-[var(--text-primary)]">
      {children}
    </h2>
  );
}

export function FinancesHubPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader title={t.finances.title} subtitle={t.finances.subtitle} maxWidth="max-w-3xl" />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
        <p className="max-w-prose text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {t.finances.description}
        </p>

        <section aria-labelledby="finances-status-title">
          <GroupTitle id="finances-status-title">{t.finances.statusTitle}</GroupTitle>
          <div className="grid grid-cols-1 gap-4">
            <HubLinkCard
              to="/net-worth"
              title={t.finances.netWorthTitle}
              description={t.finances.netWorthDesc}
              icon={Scale}
              tone="iris"
            />
          </div>
        </section>

        <section aria-labelledby="finances-plan-title">
          <GroupTitle id="finances-plan-title">{t.finances.planTitle}</GroupTitle>
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
              to="/assets"
              title={t.finances.assetsTitle}
              description={t.finances.assetsDesc}
              icon={PiggyBank}
              tone="leaf"
            />
          </div>
        </section>
      </main>

      <AppNav />
    </div>
  );
}
