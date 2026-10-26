import { describe, it, expect } from 'vitest';
import { paginateByMonth, initialPageIndex } from './expenseHistory';

const row = (month: string, amount = 100) => ({ month, amount });
const rows = (month: string, n: number) => Array.from({ length: n }, () => row(month));
const pageMonths = (pages: ReturnType<typeof paginateByMonth>) => pages.map(p => p.map(g => g.month));

describe('paginateByMonth', () => {
  it('returns no pages without rows', () => {
    expect(paginateByMonth([], 20)).toEqual([]);
  });

  it('groups rows by month, oldest first, keeping their order within the month', () => {
    const [page] = paginateByMonth([row('2026-02', 50), row('2026-01', 100), row('2026-02', -20)], 20);
    expect(page.map(g => [g.month, g.rows.map(r => r.amount)])).toEqual([
      ['2026-01', [100]],
      ['2026-02', [50, -20]],
    ]);
  });

  it('never splits a month and fills pages from the newest month backwards', () => {
    const pages = paginateByMonth([...rows('2026-01', 3), ...rows('2026-02', 4), ...rows('2026-03', 3)], 7);
    expect(pageMonths(pages)).toEqual([['2026-01'], ['2026-02', '2026-03']]);
  });

  it('keeps a month bigger than the page size on its own page', () => {
    const pages = paginateByMonth([...rows('2026-01', 2), ...rows('2026-02', 9), ...rows('2026-03', 2)], 5);
    expect(pageMonths(pages)).toEqual([['2026-01'], ['2026-02'], ['2026-03']]);
  });
});

describe('initialPageIndex', () => {
  const pages = paginateByMonth([...rows('2026-01', 5), ...rows('2026-05', 5), ...rows('2026-09', 5)], 5);

  it('opens on the page with the current month', () => {
    expect(initialPageIndex(pages, '2026-05')).toBe(1);
  });

  it('opens on the closest earlier page when the current month has no expenses', () => {
    expect(initialPageIndex(pages, '2026-07')).toBe(1);
    expect(initialPageIndex(pages, '2027-01')).toBe(2);
  });

  it('opens on the first page when every expense is later', () => {
    expect(initialPageIndex(pages, '2025-12')).toBe(0);
  });

  it('is 0 without pages', () => {
    expect(initialPageIndex([], '2026-05')).toBe(0);
  });
});
