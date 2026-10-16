/**
 * BudgetHubPage — /budget
 *
 * Hub de navegación para las vistas de presupuesto:
 *   - Vista Mensual  → /month
 *   - Vista Anual    → /anual
 */

import { Link } from '@tanstack/react-router';
import { CalendarDays, CalendarRange, ChevronRight } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';

interface HubCard {
  emoji: string;
  title: string;
  desc: string;
  to: '/month' | '/anual';
  icon: React.ReactNode;
  gradient: string;
  border: string;
}

export function BudgetHubPage() {
  const { t } = useI18n();

  const CARDS: HubCard[] = [
    {
      emoji: '🗓️',
      title: t.budgetHub.monthlyTitle,
      desc: t.budgetHub.monthlyDesc,
      to: '/month',
      icon: <CalendarDays size={22} />,
      gradient: 'from-pink-400 to-rose-400',
      border: 'border-pink-100 dark:border-pink-900/30',
    },
    {
      emoji: '📅',
      title: t.budgetHub.yearlyTitle,
      desc: t.budgetHub.yearlyDesc,
      to: '/anual',
      icon: <CalendarRange size={22} />,
      gradient: 'from-violet-400 to-purple-400',
      border: 'border-violet-100 dark:border-violet-900/30',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader emoji="📊" title={t.budgetHub.title} subtitle={t.budgetHub.subtitle} maxWidth="max-w-2xl" />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">

        <p className="text-xs text-[var(--text-muted)] px-1 mb-4">
          {t.budgetHub.description}
        </p>

        {/* Each card spans two rows of the parent grid and adopts them via
            subgrid, so titles and descriptions share the same rows across
            cards and stay aligned regardless of copy length. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(card => (
          <Link
            key={card.to}
            to={card.to}
            className={cn(
              'row-span-2 grid grid-rows-subgrid grid-cols-[auto_1fr] gap-x-4 gap-y-1',
              'text-left bg-[var(--bg-surface)] rounded-2xl border shadow-sm p-5',
              'hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.99]',
              card.border,
            )}
          >
            {/* Icon */}
            <div className={cn(
              'row-span-2 self-start w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm shrink-0',
              card.gradient,
            )}>
              {card.icon}
            </div>

            {/* Title row */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {card.emoji} {card.title}
              </h2>
              <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
            </div>

            {/* Description row */}
            <p className="text-xs text-[var(--text-muted)] leading-relaxed min-w-0">
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
