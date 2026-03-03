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
import { useQuery, useStatus } from '@powersync/react';
import { ChevronLeft, ChevronRight, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { Logo } from '@/shared/ui/Logo';
import { useI18n } from '@/shared/i18n/I18nContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
}

function prevMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 2, 1);
  return d.toISOString().slice(0, 7);
}

function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m, 1);
  return d.toISOString().slice(0, 7);
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

interface BudgetRowData {
  id: string;
  name: string;
  category_id: string;
  paid_with_credit_card: number;
  default_amount: number;
  // from budget_months join (may be null if no override exists)
  bm_amount: number | null;
  bm_id: string | null;
  bm_is_executed: number | null;
  // total expenses for this budget_month
  total_expenses: number;
}

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

  // Reactive query: budgets + budget_months + expense totals for the month
  const { data: budgetRows } = useQuery<BudgetRowData>(`
    SELECT
      b.id,
      b.name,
      b.category_id,
      b.paid_with_credit_card,
      b.default_amount,
      bm.id        AS bm_id,
      bm.amount    AS bm_amount,
      bm.is_executed AS bm_is_executed,
      COALESCE((
        SELECT SUM(e.amount)
        FROM expenses e
        WHERE e.budget_month_id = bm.id
          AND e.deleted_at IS NULL
      ), 0) AS total_expenses
    FROM budgets b
    LEFT JOIN budget_months bm
      ON bm.budget_id = b.id AND bm.month = ?
    WHERE b.deleted_at IS NULL
    ORDER BY b.paid_with_credit_card DESC, b.name ASC
  `, [month]);

  // Exchange rates for the month (for income conversion)
  const { data: rateRows } = useQuery<{ rate: number }>(
    `SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'COP' AND month = ? LIMIT 1`,
    [month],
  );

  // Income months for this month
  const { data: incomeRows } = useQuery<{ real_amount: number; currency: string }>(
    `SELECT im.real_amount, im.currency
     FROM income_months im
     WHERE im.month = ?`,
    [month],
  );

  const trm = rateRows?.[0]?.rate ?? null;

  // Compute available income (COP)
  const availableIncome = (incomeRows ?? []).reduce((sum, row) => {
    if (row.currency === 'COP') return sum + row.real_amount;
    if (row.currency === 'USD' && trm) return sum + Math.round(row.real_amount * trm);
    return sum;
  }, 0);

  const creditCardRows = (budgetRows ?? []).filter(r => r.paid_with_credit_card === 1);
  const cashRows = (budgetRows ?? []).filter(r => r.paid_with_credit_card === 0);

  const totalBudgeted = (budgetRows ?? []).reduce((s, r) => s + (r.bm_amount ?? r.default_amount), 0);
  const totalExecuted = (budgetRows ?? []).reduce((s, r) => s + r.total_expenses, 0);
  const realBalance = availableIncome - totalExecuted;
  const budgetedBalance = availableIncome - totalBudgeted;

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
            <Logo size={24} />
            LittleFlower
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
          {(budgetRows ?? []).length === 0 ? (
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
                totalBudgeted={creditCardRows.reduce((s, r) => s + (r.bm_amount ?? r.default_amount), 0)}
                totalExecuted={creditCardRows.reduce((s, r) => s + r.total_expenses, 0)}
                headers={{ item: t.appShell.itemHeader, budget: t.appShell.budgetHeader, executed: t.appShell.executedHeader, pending: t.appShell.pendingHeader }}
              />
              <BudgetGroup
                title={`💵 ${t.appShell.cashGroup}`}
                rows={cashRows}
                totalBudgeted={cashRows.reduce((s, r) => s + (r.bm_amount ?? r.default_amount), 0)}
                totalExecuted={cashRows.reduce((s, r) => s + r.total_expenses, 0)}
                headers={{ item: t.appShell.itemHeader, budget: t.appShell.budgetHeader, executed: t.appShell.executedHeader, pending: t.appShell.pendingHeader }}
              />
            </>
          )}
        </div>

        {trm === null && incomeRows && incomeRows.some(r => r.currency !== 'COP') && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-2">
            ⚠️ {t.appShell.noTrmWarning(formatMonth(month))}
          </p>
        )}
      </main>
    </div>
  );
}
