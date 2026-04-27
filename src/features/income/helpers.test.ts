import { describe, it, expect } from 'vitest';
import { computeSalaryTotal } from './helpers';

describe('computeSalaryTotal', () => {
  it('returns base minus deductions with no extra days', () => {
    expect(computeSalaryTotal(3_000_000, 200_000, 0)).toBe(2_800_000);
  });

  it('handles zero deductions', () => {
    expect(computeSalaryTotal(5_000_000, 0, 0)).toBe(5_000_000);
  });

  it('adds extra day pay (formula: extraDays * base * 12 / 260)', () => {
    // 5 extra days at 3_000_000 base = round(5 * 3_000_000 * 12 / 260) = round(692307.69…) = 692308
    expect(computeSalaryTotal(3_000_000, 0, 5)).toBe(3_000_000 + 692_308);
  });

  it('combines base, deductions, and extra days', () => {
    const extraAmount = Math.round(2 * 4_000_000 * 12 / 260);
    expect(computeSalaryTotal(4_000_000, 500_000, 2)).toBe(4_000_000 - 500_000 + extraAmount);
  });

  it('returns 0 when base is 0', () => {
    expect(computeSalaryTotal(0, 0, 10)).toBe(0);
  });

  it('handles fractional rounding consistently', () => {
    // 1 extra day at 1_000_000 = round(1 * 1_000_000 * 12 / 260) = round(46153.846…) = 46154
    expect(computeSalaryTotal(1_000_000, 0, 1)).toBe(1_000_000 + 46_154);
  });
});
