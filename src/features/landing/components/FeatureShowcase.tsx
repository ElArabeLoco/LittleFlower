/**
 * FeatureShowcase — what the app does, each told with a small sample of the
 * real interface instead of an icon and a slogan.
 *
 *   lg:  ┌──── month (7) ─────┐┌── offline (5) ──┐
 *        └────────────────────┘└─────────────────┘
 *        ┌ currency (4) ┐┌ ledger (4) ┐┌ year (4) ┐
 *   md:  month across both columns, then pairs.  phone: one column.
 *
 * Sample amounts are illustrative and always shown in COP formatting.
 */

import { CircleCheck, WifiOff } from 'lucide-react';
import { useI18n } from '@/shared/i18n/useI18n';
import { cn } from '@/shared/ui/cn';

type SampleBudgetKey = 'sampleRent' | 'sampleGroceries' | 'sampleTransport' | 'sampleUtilities' | 'sampleRestaurants';

interface SampleRow {
  key: SampleBudgetKey;
  ratio: number;
  state: 'paid' | 'progress' | 'over';
  spent?: string;
  budget?: string;
  over?: string;
}

const MONTH_ROWS: SampleRow[] = [
  { key: 'sampleRent', ratio: 1, state: 'paid' },
  { key: 'sampleGroceries', ratio: 0.46, state: 'progress', spent: '$412.000', budget: '$900.000' },
  { key: 'sampleTransport', ratio: 0.55, state: 'progress', spent: '$138.000', budget: '$250.000' },
  { key: 'sampleUtilities', ratio: 0.83, state: 'progress', spent: '$315.400', budget: '$380.000' },
  { key: 'sampleRestaurants', ratio: 1, state: 'over', over: '$36.000' },
];

const BAR_TONE: Record<SampleRow['state'], string> = {
  paid: 'bg-green-600',
  progress: 'bg-pink-400',
  over: 'bg-red-700 dark:bg-red-500',
};

const YEAR_MONTHS = ['08', '09', '10', '11'];
const CURRENT_SAMPLE_MONTH = '10';
const YEAR_ROWS: { key: SampleBudgetKey; values: string[] }[] = [
  { key: 'sampleRent', values: ['2,1 M', '2,1 M', '2,1 M', '2,1 M'] },
  { key: 'sampleGroceries', values: ['0,9 M', '0,8 M', '0,4 M', '0,9 M'] },
  { key: 'sampleUtilities', values: ['0,4 M', '0,4 M', '0,3 M', '0,4 M'] },
];

function FeatureCard({ title, description, className, children }: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col gap-6 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8',
        className,
      )}
    >
      <div>
        <h3 className="text-[22px] font-[730] leading-tight tracking-[-0.02em] text-[var(--text-primary)]">{title}</h3>
        <p className="mt-2 max-w-[36em] text-[15px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
      </div>
      {children}
    </article>
  );
}

/** Inset "screen" that holds each sample. */
const SAMPLE_CLASS = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)]';

export function FeatureShowcase() {
  const { t } = useI18n();
  const l = t.landing;

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-12">
      <FeatureCard title={l.monthTitle} description={l.monthDesc} className="md:col-span-2 lg:col-span-7">
        <div className={cn(SAMPLE_CLASS, 'mt-auto flex flex-col gap-4 p-4 sm:p-5')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-bold text-[var(--text-primary)]">{l.sampleMonth}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
              {l.currentMonth}
            </span>
          </div>
          <ul className="flex flex-col gap-3.5">
            {MONTH_ROWS.map(row => (
              <li key={row.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">{l[row.key]}</span>
                  {row.state === 'paid' && <span className="font-semibold text-[var(--text-positive)]">{l.paid}</span>}
                  {row.state === 'progress' && (
                    <span className="tabular-nums text-[var(--text-secondary)]">{l.amountOf(row.spent ?? '', row.budget ?? '')}</span>
                  )}
                  {row.state === 'over' && <span className="font-semibold text-[var(--text-negative)]">{l.overBy(row.over ?? '')}</span>}
                </div>
                <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-[var(--bg-surface-2)]">
                  <span className={cn('block h-full rounded-full', BAR_TONE[row.state])} style={{ width: `${row.ratio * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </FeatureCard>

      <FeatureCard title={l.offlineTitle} description={l.offlineDesc} className="lg:col-span-5">
        <div className="mt-auto flex flex-col">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-900 dark:bg-amber-950/50">
            <WifiOff size={20} strokeWidth={2} aria-hidden="true" className="shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-sm leading-snug">
              <strong className="block font-bold text-[var(--text-primary)]">{l.offlineState}</strong>
              <span className="text-[var(--text-secondary)]">{l.offlineDetail}</span>
            </p>
          </div>
          <span aria-hidden="true" className="mx-auto h-5 w-0.5 rounded-full bg-[var(--border-medium)]" />
          <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3.5 dark:border-green-900 dark:bg-green-950/50">
            <CircleCheck size={20} strokeWidth={2} aria-hidden="true" className="shrink-0 text-green-700 dark:text-green-300" />
            <p className="text-sm leading-snug">
              <strong className="block font-bold text-[var(--text-primary)]">{l.syncedState}</strong>
              <span className="text-[var(--text-secondary)]">{l.syncedDetail}</span>
            </p>
          </div>
        </div>
      </FeatureCard>

      <FeatureCard title={l.currencyTitle} description={l.currencyDesc} className="lg:col-span-4">
        <dl className={cn(SAMPLE_CLASS, 'mt-auto grid grid-cols-[1fr_auto] gap-y-2.5 p-4 text-sm sm:p-5')}>
          <dt className="text-[var(--text-secondary)]">{l.usdIncome}</dt>
          <dd className="text-right font-semibold tabular-nums text-[var(--text-primary)]">US$2.500</dd>
          <dt className="text-[var(--text-secondary)]">{l.monthTrm}</dt>
          <dd className="text-right font-semibold tabular-nums text-[var(--text-primary)]">$4.180</dd>
          <dt className="border-t border-[var(--border-medium)] pt-2.5 font-semibold text-[var(--text-primary)]">{l.availableCop}</dt>
          <dd className="border-t border-[var(--border-medium)] pt-2.5 text-right font-bold tabular-nums text-[var(--text-positive)]">$10.450.000</dd>
        </dl>
      </FeatureCard>

      <FeatureCard title={l.ledgerTitle} description={l.ledgerDesc} className="lg:col-span-4">
        <ul className={cn(SAMPLE_CLASS, 'mt-auto divide-y divide-[var(--border-subtle)] overflow-hidden text-sm')}>
          <li className="flex justify-between gap-3 px-4 py-3 text-[var(--text-primary)]">
            <span>{l.sampleGroceries}</span>
            <span className="font-semibold tabular-nums">$184.500</span>
          </li>
          <li className="flex justify-between gap-3 px-4 py-3 text-violet-700 dark:text-violet-300">
            <span>{l.correctionOf(l.sampleGroceries)}</span>
            <span className="font-semibold tabular-nums">−$184.500</span>
          </li>
          <li className="flex justify-between gap-3 px-4 py-3 text-[var(--text-primary)]">
            <span>{l.sampleGroceries}</span>
            <span className="font-semibold tabular-nums">$148.500</span>
          </li>
        </ul>
      </FeatureCard>

      <FeatureCard title={l.yearTitle} description={l.yearDesc} className="lg:col-span-4">
        <div className="mt-auto overflow-x-auto rounded-xl border border-[var(--border-cell)]">
          <table className="w-full border-collapse text-xs tabular-nums text-[var(--text-primary)]" aria-label={l.yearTableLabel}>
            <thead>
              <tr className="bg-[var(--bg-surface-2)]">
                <td className="border-r border-[var(--border-cell)] p-2" />
                {YEAR_MONTHS.map(m => (
                  <th
                    key={m}
                    scope="col"
                    className={cn(
                      'px-1.5 py-2 font-semibold',
                      m === CURRENT_SAMPLE_MONTH && 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
                    )}
                  >
                    {t.months.short[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {YEAR_ROWS.map(row => (
                <tr key={row.key} className="border-t border-[var(--border-cell)]">
                  <th scope="row" className="border-r border-[var(--border-cell)] p-2 text-left font-semibold">{l[row.key]}</th>
                  {row.values.map((value, index) => {
                    const month = YEAR_MONTHS[index];
                    return (
                      <td
                        key={month}
                        className={cn(
                          'px-1.5 py-2 text-right',
                          month === CURRENT_SAMPLE_MONTH && 'bg-amber-50 dark:bg-amber-950/40',
                          month > CURRENT_SAMPLE_MONTH && 'text-[var(--text-muted)]',
                        )}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FeatureCard>
    </div>
  );
}
