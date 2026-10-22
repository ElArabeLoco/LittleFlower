/**
 * AppShell — layout principal de la app post-login.
 *
 * Muestra:
 *   - Header con navegación de mes y botón de logout
 *   - Métricas del mes (tarjetas de resumen)
 *   - Tabla de presupuesto (grupos: Tarjeta de Crédito | Efectivo)
 *
 * Usa PowerSync hooks para queries reactivas — se actualiza automáticamente
 * cuando los datos locales cambian (online u offline).
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useStatus } from '@powersync/react';
import { ChevronLeft, ChevronRight, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { FlowerMark } from '@/shared/ui/FlowerMark';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useAppShellData } from '@/application/useAppShellData';
import { getCurrentMonth, prevMonth, nextMonth } from '@/shared/helpers';
import type { BudgetWithExpenseTotalsRow } from '@/infrastructure/powersync/queries/useBudgetQueries';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Sync status indicator
// ---------------------------------------------------------------------------

function SyncIndicator() {
  const { t } = useI18n();
  const status = useStatus();
  const connected = status.connected;
  return (
    <span className={cn('flex items-center gap-1 text-xs', connected ? 'text-green-600' : 'text-gray-400')}>
      {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
      {connected ? t.appShell.synced : t.appShell.offline}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Budget table row
// ---------------------------------------------------------------------------

type BudgetRowData = BudgetWithExpenseTotalsRow;

function BudgetRow({ row }: { row: BudgetRowData }) {
  const budgeted = row.bm_amount ?? row.default_amount;
  const executed = row.total_expenses;
  const pending = budgeted - executed;
  const isExecuted = row.bm_is_executed === 1;

  return (
    <tr className={cn('border-b border-pink-50 hover:bg-pink-50/40 transition-colors', isExecuted && 'opacity-60')}>
      <td className="py-2.5 px-4 text-sm text-gray-800">{row.name}</td>
      <td className="py-2.5 px-4 text-sm text-right tabular-nums">{formatCOP(budgeted)}</td>
      <td className="py-2.5 px-4 text-sm text-right tabular-nums text-violet-700">{formatCOP(executed)}</td>
      <td className={cn('py-2.5 px-4 text-sm text-right tabular-nums font-medium', pending < 0 ? 'text-red-600' : 'text-green-700')}>
        {formatCOP(pending)}
      </td>
      <td className="py-2.5 px-4 text-center">
        <span className={cn('inline-block w-2 h-2 rounded-full', isExecuted ? 'bg-green-400' : 'bg-gray-200')} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Budget group section
// ---------------------------------------------------------------------------

function BudgetGroup({ title, rows, totalBudgeted, totalExecuted, headers }: {
  title: string;
  rows: BudgetRowData[];
  totalBudgeted: number;
  totalExecuted: number;
  headers: { item: string; budget: string; executed: string; pending: string };
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 py-2 bg-pink-100/60 rounded-t-lg">
        <span className="text-sm font-semibold text-pink-800">{title}</span>
        <span className="text-xs text-pink-600">
          {formatCOP(totalExecuted)} / {formatCOP(totalBudgeted)}
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-pink-100">
            <th className="py-2 px-4 text-left font-medium">{headers.item}</th>
            <th className="py-2 px-4 text-right font-medium">{headers.budget}</th>
            <th className="py-2 px-4 text-right font-medium">{headers.executed}</th>
            <th className="py-2 px-4 text-right font-medium">{headers.pending}</th>
            <th className="py-2 px-4 text-center font-medium">✓</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => <BudgetRow key={row.id} row={row} />)}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({ label, amount, highlight }: { label: string; amount: number; highlight?: 'positive' | 'negative' | 'neutral' }) {
  return (
    <div className="bg-white rounded-xl border border-pink-100 p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums',
        highlight === 'positive' && 'text-green-600',
        highlight === 'negative' && 'text-red-600',
        highlight === 'neutral' && 'text-gray-800',
        !highlight && 'text-gray-800',
      )}>
        {formatCOP(amount)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export function AppShell() {
  const { logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [month, setMonth] = useState(getCurrentMonth());

  const {
    creditCardRows,
    cashRows,
    availableIncome,
    totalBudgeted,
    budgetedBalance,
    realBalance,
    missingTrm,
    ccBudgeted,
    cashBudgeted,
    ccExecuted,
    cashExecuted,
  } = useAppShellData(month);

  async function handleLogout() {
    await logout();
    await navigate({ to: '/login' });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-violet-50">
      {/* Header */}
      <header className="bg-white border-b border-pink-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-semibold text-pink-700 flex items-center gap-1.5">
            <FlowerMark className="size-6" />
            Florecita
          </span>
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <Button variant="ghost" size="icon" onClick={handleLogout} title={t.appShell.signOut}>
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => setMonth(prevMonth(month))}>
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-lg font-semibold text-gray-800 capitalize">
            {formatMonth(month)}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setMonth(nextMonth(month))}>
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label={t.appShell.availableIncome} amount={availableIncome} highlight="neutral" />
          <MetricCard label={t.appShell.totalBudgeted} amount={totalBudgeted} highlight="neutral" />
          <MetricCard label={t.appShell.budgetBalance} amount={budgetedBalance} highlight={budgetedBalance >= 0 ? 'positive' : 'negative'} />
          <MetricCard label={t.appShell.realBalance} amount={realBalance} highlight={realBalance >= 0 ? 'positive' : 'negative'} />
        </div>

        {/* Budget table */}
        <div className="bg-white rounded-xl border border-pink-100 shadow-sm overflow-hidden">
          {creditCardRows.length === 0 && cashRows.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm">{t.appShell.noItems}</p>
              <p className="text-xs mt-1">{t.appShell.addFromSettings}</p>
            </div>
          ) : (
            <>
              <BudgetGroup
                title={`💳 ${t.appShell.creditCardGroup}`}
                rows={creditCardRows}
                totalBudgeted={ccBudgeted}
                totalExecuted={ccExecuted}
                headers={{ item: t.appShell.itemHeader, budget: t.appShell.budgetHeader, executed: t.appShell.executedHeader, pending: t.appShell.pendingHeader }}
              />
              <BudgetGroup
                title={`💵 ${t.appShell.cashGroup}`}
                rows={cashRows}
                totalBudgeted={cashBudgeted}
                totalExecuted={cashExecuted}
                headers={{ item: t.appShell.itemHeader, budget: t.appShell.budgetHeader, executed: t.appShell.executedHeader, pending: t.appShell.pendingHeader }}
              />
            </>
          )}
        </div>

        {missingTrm && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-2">
            ⚠️ {t.appShell.noTrmWarning(formatMonth(month))}
          </p>
        )}
      </main>
    </div>
  );
}
