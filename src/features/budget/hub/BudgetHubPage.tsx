/**
 * BudgetHubPage — /budget
 *
 * Hub de navegación para las vistas de presupuesto:
 *   - Vista Mensual  → /month
 *   - Vista Anual    → /anual
 */

import { useNavigate } from '@tanstack/react-router';
import { CalendarDays, CalendarRange, ChevronRight } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { cn } from '@/shared/ui/cn';

interface HubCard {
  emoji: string;
  title: string;
  desc: string;
  to: string;
  icon: React.ReactNode;
  gradient: string;
  border: string;
}

const CARDS: HubCard[] = [
  {
    emoji: '🗓️',
    title: 'Vista Mensual',
    desc: 'Revisa y registra gastos del mes. Tarjetas por presupuesto con ejecución real y acceso a cada gasto.',
    to: '/month',
    icon: <CalendarDays size={22} />,
    gradient: 'from-pink-400 to-rose-400',
    border: 'border-pink-100 dark:border-pink-900/30',
  },
  {
    emoji: '📅',
    title: 'Vista Anual',
    desc: 'Spreadsheet de los 12 meses. Edita presupuestos por mes, ve totales y balance real del año completo.',
    to: '/anual',
    icon: <CalendarRange size={22} />,
    gradient: 'from-violet-400 to-purple-400',
    border: 'border-violet-100 dark:border-violet-900/30',
  },
];

export function BudgetHubPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader emoji="📊" title="Presupuesto" subtitle="Elige tu vista" />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 space-y-4">

        <p className="text-xs text-[var(--text-muted)] px-1 mb-2">
          Dos formas de ver tu presupuesto. Escoge la que mejor se adapte a lo que necesitas ahora.
        </p>

        {CARDS.map(card => (
          <button
            key={card.to}
            onClick={() => navigate({ to: card.to })}
            className={cn(
              'w-full text-left bg-[var(--bg-surface)] rounded-2xl border shadow-sm p-5 cursor-pointer',
              'hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.99]',
              card.border,
            )}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={cn(
                'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm shrink-0',
                card.gradient,
              )}>
                {card.icon}
              </div>

              {/* Copy */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    {card.emoji} {card.title}
                  </h2>
                  <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {card.desc}
                </p>
              </div>
            </div>
          </button>
        ))}
      </main>

      <AppNav />
    </div>
  );
}
