import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CreditCard, Banknote } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { ChartCard, PieTooltip, PieLabel } from './shared';
import { useMonthlyData } from './useMonthlyData';

export function PaymentPieChart() {
  const { t } = useI18n();
  const { budgets, bmIdMap, expenseByBmId, currentMonth } = useMonthlyData();

  const paymentPieData = useMemo(() => {
    let cc = 0, cash = 0;
    for (const b of budgets) {
      if (b.start_month > currentMonth) continue;
      if (b.end_month && b.end_month < currentMonth) continue;
      const bmRow = bmIdMap.get(`${b.id}|${currentMonth}`);
      const spent = bmRow ? (expenseByBmId.get(bmRow.id) ?? 0) : 0;
      if (b.payment_mode !== 'cash') cc += spent;
      else cash += spent;
    }
    const data = [];
    if (cc > 0) data.push({ name: t.dashboard.card, value: cc, color: '#a78bfa' });
    if (cash > 0) data.push({ name: t.dashboard.cash, value: cash, color: '#34d399' });
    return data;
  }, [budgets, bmIdMap, expenseByBmId, currentMonth, t]);

  const hasSpend = paymentPieData.reduce((s, d) => s + d.value, 0) > 0;

  return (
    <ChartCard
      title={t.dashboard.cardVsCash}
      subtitle={hasSpend ? t.dashboard.paymentTypeDistribution : t.dashboard.noDataThisMonth}
    >
      {hasSpend && paymentPieData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={paymentPieData}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={88}
                paddingAngle={3}
                dataKey="value"
                labelLine={false}
                label={PieLabel}
              >
                {paymentPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            {paymentPieData.map((d, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                {d.name === t.dashboard.card ? <CreditCard size={12} /> : <Banknote size={12} />}
                {d.name} — <AbbreviatedAmount value={d.value} className="font-semibold text-[var(--text-secondary)]" />
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-[var(--text-muted)] text-sm">
          {t.dashboard.noExpensesRecorded}
        </div>
      )}
    </ChartCard>
  );
}
