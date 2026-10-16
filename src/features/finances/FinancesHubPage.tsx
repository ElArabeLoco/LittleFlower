/**
 * FinancesHubPage — /finances
 *
 * Hub de navegación para la configuración financiera:
 *   - Ingresos        → /income
 *   - Presupuestos    → /settings/budgets
 *   - Deudas          → /debts
 */

import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { TrendingUp, LayoutList, CreditCard, Receipt } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';

interface HubCard {
  emoji: string;
  title: string;
  desc: string;
  to: '/income' | '/settings/budgets' | '/debts' | '/transactions';
  icon: React.ReactNode;
  gradient: string;
  border: string;
  soon?: boolean;
}

export function FinancesHubPage() {
  const { t } = useI18n();

  const cards: HubCard[] = useMemo(() => [
    {
      emoji: '💰',
      title: t.finances.incomeTitle,
      desc: t.finances.incomeDesc,
      to: '/income',
      icon: <TrendingUp size={22} className="shrink-0" />,
      gradient: 'from-emerald-400 to-teal-400',
      border: 'border-emerald-100 dark:border-emerald-900/30',
    },
    {
      emoji: '📋',
      title: t.finances.budgetsTitle,
      desc: t.finances.budgetsDesc,
      to: '/settings/budgets',
      icon: <LayoutList size={22} className="shrink-0" />,
      gradient: 'from-violet-400 to-purple-400',
      border: 'border-violet-100 dark:border-violet-900/30',
    },
    {
      emoji: '💳',
      title: t.finances.debtsTitle,
      desc: t.finances.debtsDesc,
      to: '/debts',
      icon: <CreditCard size={24} className="shrink-0" />,
      gradient: 'from-amber-400 to-orange-400',
      border: 'border-amber-100 dark:border-amber-900/30',
    },
    {
      emoji: '🧾',
      title: t.finances.transactionsTitle,
      desc: t.finances.transactionsDesc,
      to: '/transactions',
      icon: <Receipt size={24} className="shrink-0" />,
      gradient: 'from-sky-400 to-blue-400',
      border: 'border-sky-100 dark:border-sky-900/30',
    },
  ], [t]);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader title={t.finances.title} subtitle={t.finances.subtitle} maxWidth="max-w-3xl" />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">

        <p className="text-xs text-[var(--text-muted)] px-1 mb-4">
          {t.finances.description}
        </p>

        {/* Each card spans three rows of the parent grid (icon, title,
            description) and adopts them via subgrid, so every title and
            description in a row of cards starts at the same height. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map(card => (
          <Link
            key={card.to}
            to={card.to}
            className={cn(
              'row-span-3 grid grid-rows-subgrid gap-y-0',
              'text-left bg-[var(--bg-surface)] rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]',
              card.border,
            )}
          >
            {/* Icon */}
            <div className={cn(
              'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm shrink-0',
              card.gradient,
            )}>
              {card.icon}
            </div>

            {/* Title */}
            <h2 className="mt-3 text-sm font-bold text-[var(--text-primary)] min-w-0">
              {card.title}
            </h2>

            {/* Description */}
            <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed min-w-0">
              {card.desc}
            </p>
          </Link>
        ))}
        </div>
      </main>

      <AppNav />
    </div>
  );
}
