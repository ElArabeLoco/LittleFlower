/**
 * FinancesHubPage — /finances
 *
 * Hub de navegación para la configuración financiera:
 *   - Ingresos        → /income
 *   - Presupuestos    → /settings/budgets
 *   - Deudas          → /debts
 */

import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TrendingUp, LayoutList, CreditCard, Receipt } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';

interface HubCard {
  emoji: string;
  title: string;
  desc: string;
  to: string;
  icon: React.ReactNode;
  gradient: string;
  border: string;
  soon?: boolean;
}

export function FinancesHubPage() {
  const navigate = useNavigate();
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
      <AppHeader emoji="💳" title={t.finances.title} subtitle={t.finances.subtitle} maxWidth="max-w-3xl" />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">

        <p className="text-xs text-[var(--text-muted)] px-1 mb-4">
          {t.finances.description}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map(card => (
          <button
            key={card.to}
            onClick={() => navigate({ to: card.to })}
            className={cn(
              'w-full text-left bg-[var(--bg-surface)] rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]',
              card.border,
            )}
          >
            <div className="flex flex-col gap-3">
              {/* Icon */}
              <div className={cn(
                'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm shrink-0',
                card.gradient,
              )}>
                {card.icon}
              </div>

              {/* Copy */}
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                  {card.title}
                </h2>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {card.desc}
                </p>
              </div>
            </div>
          </button>
        ))}
        </div>
      </main>

      <AppNav />
    </div>
  );
}
