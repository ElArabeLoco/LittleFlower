/**
 * FinancesHubPage — /finances
 *
 * Hub de navegación para la configuración financiera:
 *   - Ingresos        → /income
 *   - Presupuestos    → /settings/budgets
 *   - Deudas          → /debts
 */

import { useNavigate } from '@tanstack/react-router';
import { TrendingUp, LayoutList, CreditCard, ChevronRight } from 'lucide-react';
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
  soon?: boolean;
}

const CARDS: HubCard[] = [
  {
    emoji: '💰',
    title: 'Ingresos',
    desc: 'Gestiona las fuentes de ingreso del hogar. Soporta salarios en COP y USD con conversión TRM automática.',
    to: '/income',
    icon: <TrendingUp size={22} />,
    gradient: 'from-emerald-400 to-teal-400',
    border: 'border-emerald-100 dark:border-emerald-900/30',
  },
  {
    emoji: '📋',
    title: 'Presupuestos',
    desc: 'Define y gestiona las categorías de gasto del hogar. Crea, edita y organiza por tipo de pago.',
    to: '/settings/budgets',
    icon: <LayoutList size={22} />,
    gradient: 'from-violet-400 to-purple-400',
    border: 'border-violet-100 dark:border-violet-900/30',
  },
  {
    emoji: '💳',
    title: 'Deudas',
    desc: 'Registra y haz seguimiento de tus deudas. Vincula presupuestos para abonos automáticos.',
    to: '/debts',
    icon: <CreditCard size={22} />,
    gradient: 'from-amber-400 to-orange-400',
    border: 'border-amber-100 dark:border-amber-900/30',
  },
];

export function FinancesHubPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader emoji="💳" title="Finanzas" subtitle="Ingresos · Presupuestos · Deudas" />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 space-y-4">

        <p className="text-xs text-[var(--text-muted)] px-1 mb-2">
          Configura y gestiona el lado financiero del hogar: de dónde viene la plata y cómo la organizas.
        </p>

        {CARDS.map(card => (
          <button
            key={card.to}
            onClick={() => navigate({ to: card.to })}
            className={cn(
              'w-full text-left bg-[var(--bg-surface)] rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]',
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
