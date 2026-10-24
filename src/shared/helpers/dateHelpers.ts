/**
 * Date helpers for the Florecita app.
 *
 * All months use the 'YYYY-MM' string format (e.g. '2026-04').
 * These were previously duplicated across 6+ files; now centralised here.
 */

/** Today in the device's time zone as 'YYYY-MM-DD'. */
export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns the current month as 'YYYY-MM'. */
export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Returns the previous month as 'YYYY-MM'. */
export function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${String(mo - 1).padStart(2, '0')}`;
}

/** Returns the next month as 'YYYY-MM'. */
export function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  if (mo === 12) return `${y + 1}-01`;
  return `${y}-${String(mo + 1).padStart(2, '0')}`;
}

/**
 * Build an array of N months ending at `fromMonth`.
 *
 * @example prevNMonthsFrom(3, '2026-04') → ['2026-02', '2026-03', '2026-04']
 */
export function prevNMonthsFrom(n: number, fromMonth: string): string[] {
  const [y, m] = fromMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(y, m - 1 - i, 1);
    months.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}
