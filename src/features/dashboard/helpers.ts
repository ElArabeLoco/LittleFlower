import type { DailyExpenseRow, BurnUpExpenseRow, BurnUpDataPoint } from './types';

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function prevNMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export function formatK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export function buildDailyChartData(
  rawRows: DailyExpenseRow[],
  currentMonth: string,
): { day: number; label: string; total: number }[] {
  const [y, m] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const rawMap = new Map(rawRows.map(r => [parseInt(r.day.slice(8, 10), 10), r.total]));
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return { day: d, label: String(d), total: rawMap.get(d) ?? 0 };
  });
}

export function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  } catch { return iso.slice(0, 10); }
}

export function makeShortMonth(t: { months: { short: Record<string, string> } }) {
  return (ym: string): string => t.months.short[ym.slice(5, 7)] ?? ym.slice(5, 7);
}

export function getPreviousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // m-2 because months are 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function buildBurnUpData(
  curRows: BurnUpExpenseRow[],
  prevRows: BurnUpExpenseRow[],
  curMonth: string,
  target: number,
): BurnUpDataPoint[] {
  const [y, m] = curMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date();
  const todayDay = today.getFullYear() === y && today.getMonth() + 1 === m
    ? today.getDate()
    : daysInMonth;

  const curMap = new Map(curRows.map(r => [parseInt(r.day.slice(8, 10), 10), r.total]));
  const prevMap = new Map(prevRows.map(r => [parseInt(r.day.slice(8, 10), 10), r.total]));

  let curCumulative = 0;
  let prevCumulative = 0;

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    curCumulative += curMap.get(day) ?? 0;
    prevCumulative += prevMap.get(day) ?? 0;
    const ideal = Math.round((day / daysInMonth) * target);
    return {
      day,
      label: String(day),
      ideal,
      current: day <= todayDay ? curCumulative : null,
      previous: prevCumulative > 0 || prevMap.has(day) ? prevCumulative : null,
    };
  });
}
