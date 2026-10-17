/**
 * BudgetHubPage — /budget
 *
 * Hub de navegación para las vistas de presupuesto:
 *   - Vista Mensual  → /month
 *   - Vista Anual    → /anual
 */

import { CalendarDays, CalendarRange } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { HubLinkCard } from '@/shared/ui/HubLinkCard';
import { useI18n } from '@/shared/i18n/I18nContext';

export function BudgetHubPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader title={t.budgetHub.title} subtitle={t.budgetHub.subtitle} maxWidth="max-w-2xl" />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <p className="mb-6 max-w-prose text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {t.budgetHub.description}
        </p>

        {/* Each card spans two rows of this grid (subgrid), so titles and
            descriptions stay aligned across cards. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <HubLinkCard
            to="/month"
            title={t.budgetHub.monthlyTitle}
            description={t.budgetHub.monthlyDesc}
            icon={CalendarDays}
            tone="petal"
          />
          <HubLinkCard
            to="/anual"
            title={t.budgetHub.yearlyTitle}
            description={t.budgetHub.yearlyDesc}
            icon={CalendarRange}
            tone="iris"
          />
        </div>
      </main>

      <AppNav />
    </div>
  );
}
