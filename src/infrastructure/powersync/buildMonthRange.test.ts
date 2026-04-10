import { describe, it, expect } from 'vitest';
import { buildMonthRange } from './mutationWrappers';

describe('buildMonthRange', () => {
  it('returns a single month when from === to', () => {
    expect(buildMonthRange('2025-06', '2025-06')).toEqual(['2025-06']);
  });

  it('returns months within the same year', () => {
    expect(buildMonthRange('2025-03', '2025-06')).toEqual([
      '2025-03', '2025-04', '2025-05', '2025-06',
    ]);
  });

  it('crosses year boundary', () => {
    expect(buildMonthRange('2025-11', '2026-02')).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02',
    ]);
  });

  it('returns a full year when Jan–Dec', () => {
    const result = buildMonthRange('2025-01', '2025-12');
    expect(result).toHaveLength(12);
    expect(result[0]).toBe('2025-01');
    expect(result[11]).toBe('2025-12');
  });

  it('returns empty array when from is after to', () => {
    expect(buildMonthRange('2025-06', '2025-03')).toEqual([]);
  });

  it('returns empty array when from year is after to year', () => {
    expect(buildMonthRange('2026-01', '2025-12')).toEqual([]);
  });

  it('pads single-digit months with leading zero', () => {
    const result = buildMonthRange('2025-01', '2025-09');
    expect(result).toEqual([
      '2025-01', '2025-02', '2025-03', '2025-04',
      '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
    ]);
  });
});
