/** Expenses of one month in a history page, with their net total (reversals included). */
export interface MonthGroup<T> {
  month: string;
  rows: T[];
  total: number;
}

/**
 * Splits expenses into pages of whole months, oldest month first. A page holds at most
 * `pageSize` rows unless one month alone has more. Pages fill from the newest month
 * backwards, so the oldest page is the short one. Rows keep their order within a month.
 */
export function paginateByMonth<T extends { month: string; amount: number }>(
  rows: T[],
  pageSize: number,
): MonthGroup<T>[][] {
  const byMonth = new Map<string, MonthGroup<T>>();
  for (const r of rows) {
    const group = byMonth.get(r.month) ?? { month: r.month, rows: [], total: 0 };
    group.rows.push(r);
    group.total += r.amount;
    byMonth.set(r.month, group);
  }
  const groups = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));

  const pages: MonthGroup<T>[][] = [];
  let page: MonthGroup<T>[] = [];
  let count = 0;
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (page.length > 0 && count + group.rows.length > pageSize) {
      pages.unshift(page);
      page = [];
      count = 0;
    }
    page.unshift(group);
    count += group.rows.length;
  }
  if (page.length > 0) pages.unshift(page);
  return pages;
}

/** The page with the current month, else the closest earlier one, else the first. */
export function initialPageIndex(pages: MonthGroup<unknown>[][], currentMonth: string): number {
  for (let i = pages.length - 1; i >= 0; i--) {
    if (pages[i][0].month <= currentMonth) return i;
  }
  return 0;
}
