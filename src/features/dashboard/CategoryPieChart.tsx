import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/shared/i18n/I18nContext';
import { CATEGORY_MAP } from '@/domain/budget/categories';
import { ChartCard, PieTooltip, PieLabel } from './shared';
import { useMonthlyData } from './useMonthlyData';

export function CategoryPieChart() {
  const { t } = useI18n();
  const { budgets, bmIdMap, expenseByBmId, currentMonth } = useMonthlyData();

  const categoryPieData = useMemo(() => {
    const catSpend = new Map<string, number>();
    for (const b of budgets) {
      if (b.start_month > currentMonth) continue;
      if (b.end_month && b.end_month < currentMonth) continue;
      const bmRow = bmIdMap.get(`${b.id}|${currentMonth}`);
      if (!bmRow) continue;
      const spent = expenseByBmId.get(bmRow.id) ?? 0;
      if (spent <= 0) continue;
      const cat = b.category_id;
      catSpend.set(cat, (catSpend.get(cat) ?? 0) + spent);
    }
    return Array.from(catSpend.entries())
      .map(([cat, value]) => ({
        name: CATEGORY_MAP.get(cat)?.name ?? 'Otro',
        value,
        color: CATEGORY_MAP.get(cat)?.color ?? '#cbd5e1',
        emoji: CATEGORY_MAP.get(cat)?.emoji ?? '•',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [budgets, bmIdMap, expenseByBmId, currentMonth]);

  const hasSpend = categoryPieData.reduce((s, d) => s + d.value, 0) > 0;

  return (
    <ChartCard
      title={t.dashboard.spendByCategory}
      subtitle={hasSpend ? t.dashboard.distributionThisMonth : t.dashboard.noDataThisMonth}
    >
      {hasSpend && categoryPieData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryPieData}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={88}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={PieLabel}
              >
                {categoryPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 justify-center">
            {categoryPieData.map((d, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                {d.emoji} {d.name}
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
