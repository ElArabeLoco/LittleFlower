import { ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/useI18n';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useDebtProjection, type DebtProjection } from '@/application/useDebtProjection';
import { ratePercents, type AmortizationMethod, type DebtKind } from '@/application/debtPlan';

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 min-w-0">
      <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
      <p className={cn('font-bold text-[var(--text-primary)] tabular-nums truncate', strong ? 'text-lg' : 'text-base')}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{hint}</p>}
    </div>
  );
}

function Notice({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'danger' | 'success' }) {
  return (
    <p className={cn('rounded-xl px-4 py-3 text-sm',
      tone === 'danger' && 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      tone === 'success' && 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      tone === 'muted' && 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)]')}>
      {children}
    </p>
  );
}

export type DebtProjectionViewProps = Pick<DebtProjection,
  'debt' | 'balance' | 'isFinancial' | 'projection' | 'paid' | 'budgetPace'>;

/** Container: loads the projection of one debt. */
export function DebtProjectionPage({ debtId }: { debtId: string }) {
  return <DebtProjectionView {...useDebtProjection(debtId)} />;
}

export function DebtProjectionView({ debt, balance, isFinancial, projection, paid, budgetPace }: DebtProjectionViewProps) {
  const { t } = useI18n();
  // Summary tiles follow the user's number format; the schedule always shows full figures
  const { formatCOP, formatNumber } = useNumberFormat();

  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return `${t.months.short[mo] ?? mo} ${y}`;
  };

  const backButton = (
    <Button asChild variant="outline" size="sm" className="gap-1.5">
      <Link to="/debts"><ArrowLeft size={14} /> {t.debts.backToDebts}</Link>
    </Button>
  );

  if (!debt) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)]">
        <AppHeader title={t.debts.projectionTitle} maxWidth="max-w-5xl" actions={backButton} />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <Notice>{t.debts.notFound}</Notice>
        </main>
        <AppNav />
      </div>
    );
  }

  const rows = projection?.rows ?? [];
  const totals = projection?.totals;
  const scheduled = projection?.status === 'scheduled';
  const hasFees = debt.monthly_fees > 0 || paid.fees > 0;
  const endMonth = rows.at(-1)?.month;

  const terms = [
    t.debts.kinds[debt.kind as DebtKind],
    debt.lender,
    isFinancial && t.debts.rateShort(ratePercents(debt.interest_rate).ea.toLocaleString('es-CO', { maximumFractionDigits: 2 })),
    isFinancial && t.debts.amortizations[debt.amortization as AmortizationMethod],
    isFinancial && debt.term_months && t.debts.termMonths(debt.term_months),
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <AppHeader title={debt.name} subtitle={t.debts.projectionTitle} maxWidth="max-w-5xl" actions={backButton} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <ul className="flex flex-wrap gap-1.5">
          {terms.map(term => (
            <li key={String(term)}
              className="text-xs px-2 py-1 rounded-full bg-[var(--bg-surface-2)] text-[var(--text-secondary)]">
              {term}
            </li>
          ))}
        </ul>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t.debts.currentBalance} value={formatCOP(Math.max(0, balance))} strong />
          {scheduled && totals && (
            <>
              <Stat
                label={t.debts.installmentsLeft}
                value={String(rows.length)}
                hint={endMonth && `${t.debts.estimatedEnd} ${fmtMonth(endMonth)}`}
                strong
              />
              <Stat label={t.debts.futureInterest} value={formatCOP(totals.interest)} strong />
              <Stat label={t.debts.futureTotal} value={formatCOP(totals.paid)} strong />
              <Stat label={t.debts.futurePrincipal} value={formatCOP(totals.principal)} />
              {hasFees && <Stat label={t.debts.futureFees} value={formatCOP(totals.fees)} />}
            </>
          )}
        </section>

        {projection?.status === 'paid_off' && <Notice tone="success">{t.debts.paidOffMessage}</Notice>}
        {projection?.status === 'no_plan' && <Notice>{t.debts.noPlan}</Notice>}
        {projection?.status === 'never_pays_off' && <Notice tone="danger">{t.debts.neverPaysOff}</Notice>}
        {scheduled && budgetPace && <Notice>{t.debts.budgetPaced(formatCOP(budgetPace))}</Notice>}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">{t.debts.paidSoFar}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t.debts.colPrincipal} value={formatCOP(paid.principal)} />
            <Stat label={t.debts.colInterest} value={formatCOP(paid.interest)} />
            {hasFees && <Stat label={t.debts.splitFees} value={formatCOP(paid.fees)} />}
            <Stat label={t.debts.paidTotal} value={formatCOP(paid.total)} />
          </div>
        </section>

        {rows.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">{t.debts.scheduleTitle}</h2>
            <div className="max-h-[70vh] overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <table className="w-full text-xs tabular-nums">
                <thead className="sticky top-0 bg-[var(--bg-surface-2)] text-[var(--text-muted)]">
                  <tr className="text-right [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                    <th className="text-left">{t.debts.colNumber}</th>
                    <th className="text-left">{t.debts.colMonth}</th>
                    <th>{t.debts.colPayment}</th>
                    <th>{t.debts.colInterest}</th>
                    <th>{t.debts.colPrincipal}</th>
                    {hasFees && <th>{t.debts.colFees}</th>}
                    <th>{t.debts.colBalance}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {rows.map(row => (
                    <tr key={row.number} className="text-right text-[var(--text-secondary)] [&>td]:px-3 [&>td]:py-1.5 whitespace-nowrap">
                      <td className="text-left text-[var(--text-muted)]">{row.number}</td>
                      <td className="text-left">{fmtMonth(row.month)}</td>
                      <td className="font-semibold text-[var(--text-primary)]">{formatNumber(row.payment)}</td>
                      <td>{formatNumber(row.interest)}</td>
                      <td>{formatNumber(row.principal)}</td>
                      {hasFees && <td>{formatNumber(row.fees)}</td>}
                      <td>{formatNumber(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <AppNav />
    </div>
  );
}
