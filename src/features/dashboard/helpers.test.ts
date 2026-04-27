import { describe, it, expect } from 'vitest';
import { formatK, buildDailyChartData, makeShortMonth, getPreviousMonth, makeFullMonthLabel, buildBurnUpData } from './helpers';
import type { DailyExpenseRow, BurnUpExpenseRow } from './types';

// ── formatK ──────────────────────────────────────────────────────────────────

describe('formatK', () => {
  it('formats values under 1k as-is', () => {
    expect(formatK(500)).toBe('$500');
    expect(formatK(0)).toBe('$0');
  });

  it('formats thousands with K suffix', () => {
    expect(formatK(1_000)).toBe('$1K');
    expect(formatK(25_000)).toBe('$25K');
    expect(formatK(999_999)).toBe('$1000K');
  });

  it('formats millions with M suffix (1 decimal)', () => {
    expect(formatK(1_000_000)).toBe('$1.0M');
    expect(formatK(2_500_000)).toBe('$2.5M');
  });

  it('handles negative values', () => {
    expect(formatK(-1_500)).toBe('$-2K');
    expect(formatK(-2_000_000)).toBe('$-2.0M');
  });
});

// ── buildDailyChartData ───────────────────────────────────────────────────────

describe('buildDailyChartData', () => {
  it('produces one entry per day in the month', () => {
    const result = buildDailyChartData([], '2024-01');
    expect(result).toHaveLength(31);
    expect(result[0]).toEqual({ day: 1, label: '1', total: 0 });
    expect(result[30]).toEqual({ day: 31, label: '31', total: 0 });
  });

  it('correctly counts days in a 28-day February', () => {
    expect(buildDailyChartData([], '2023-02')).toHaveLength(28);
  });

  it('correctly counts days in a leap-year February', () => {
    expect(buildDailyChartData([], '2024-02')).toHaveLength(29);
  });

  it('fills in totals from raw rows by day number', () => {
    const rows: DailyExpenseRow[] = [
      { day: '2024-01-05', total: 100_000 },
      { day: '2024-01-15', total: 250_000 },
    ];
    const result = buildDailyChartData(rows, '2024-01');
    expect(result[4].total).toBe(100_000);   // day 5
    expect(result[14].total).toBe(250_000);  // day 15
    expect(result[0].total).toBe(0);         // day 1 — no data
  });
});

// ── makeShortMonth ────────────────────────────────────────────────────────────

describe('makeShortMonth', () => {
  const t = { months: { short: { '01': 'ene', '07': 'jul', '12': 'dic' } } };
  const shortMonth = makeShortMonth(t);

  it('returns the short month name for a known month', () => {
    expect(shortMonth('2024-01')).toBe('ene');
    expect(shortMonth('2024-07')).toBe('jul');
    expect(shortMonth('2024-12')).toBe('dic');
  });

  it('falls back to the raw month string for unknown months', () => {
    expect(shortMonth('2024-03')).toBe('03');
  });
});

// ── getPreviousMonth ──────────────────────────────────────────────────────────

describe('getPreviousMonth', () => {
  it('returns the previous month in the same year', () => {
    expect(getPreviousMonth('2024-05')).toBe('2024-04');
  });

  it('wraps from January back to December of the prior year', () => {
    expect(getPreviousMonth('2024-01')).toBe('2023-12');
  });

  it('handles end-of-year correctly', () => {
    expect(getPreviousMonth('2023-12')).toBe('2023-11');
  });
});

// ── makeFullMonthLabel ────────────────────────────────────────────────────────

describe('makeFullMonthLabel', () => {
  const t = { months: { full: { '03': 'Marzo', '11': 'Noviembre' } } };
  const fullLabel = makeFullMonthLabel(t);

  it('returns the full month name for a known month', () => {
    expect(fullLabel('2024-03')).toBe('Marzo');
    expect(fullLabel('2024-11')).toBe('Noviembre');
  });

  it('falls back to raw month string for unknown months', () => {
    expect(fullLabel('2024-07')).toBe('07');
  });
});

// ── buildBurnUpData ───────────────────────────────────────────────────────────

describe('buildBurnUpData', () => {
  const month = '2024-01'; // 31 days

  it('produces one point per day in the month', () => {
    expect(buildBurnUpData([], [], month, 1_000_000)).toHaveLength(31);
  });

  it('computes ideal spend as (day / daysInMonth) * target, rounded', () => {
    const result = buildBurnUpData([], [], month, 3_100_000);
    // day 1: round(1/31 * 3_100_000) = round(100000) = 100000
    expect(result[0].ideal).toBe(100_000);
    // day 31: round(31/31 * 3_100_000) = 3_100_000
    expect(result[30].ideal).toBe(3_100_000);
  });

  it('accumulates current-month spend cumulatively', () => {
    const curRows: BurnUpExpenseRow[] = [
      { day: '2024-01-01', total: 100_000 },
      { day: '2024-01-02', total: 50_000 },
    ];
    // Pass a past month so todayDay = daysInMonth and all days have current data
    const result = buildBurnUpData(curRows, [], '2023-01', 1_000_000);
    expect(result[0].current).toBe(100_000);
    expect(result[1].current).toBe(150_000);  // cumulative
    expect(result[2].current).toBe(150_000);  // no new spend on day 3
  });

  it('sets current to null for future days within the current month', () => {
    // Use a future month so todayDay resolves to some past day
    // Use a past month instead: all days get current data
    const curRows: BurnUpExpenseRow[] = [{ day: '2023-06-01', total: 500 }];
    const result = buildBurnUpData(curRows, [], '2023-06', 10_000);
    // For past months, todayDay = daysInMonth, so no null entries
    expect(result.every(p => p.current !== null)).toBe(true);
  });

  it('sets previous to null when no previous spend exists', () => {
    const result = buildBurnUpData([], [], month, 1_000_000);
    expect(result.every(p => p.previous === null)).toBe(true);
  });

  it('accumulates previous-month spend cumulatively', () => {
    const prevRows: BurnUpExpenseRow[] = [
      { day: '2023-12-05', total: 200_000 },
      { day: '2023-12-10', total: 100_000 },
    ];
    const result = buildBurnUpData([], prevRows, '2023-12', 1_000_000);
    expect(result[9].previous).toBe(300_000);  // day 10 cumulative
    expect(result[11].previous).toBe(300_000); // no spend after day 10
  });
});
