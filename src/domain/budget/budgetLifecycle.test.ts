import { describe, it, expect } from 'vitest';
import { isFinished, rangeViolation, finishBounds, BudgetExpenseRangeError } from './budgetLifecycle';

const span = { first: '2025-03', last: '2025-08' };

describe('isFinished', () => {
  it('is false without an end month', () => expect(isFinished(null, '2025-10')).toBe(false));
  it('is true for a past end month', () => expect(isFinished('2025-09', '2025-10')).toBe(true));
  it('is false when ending this month', () => expect(isFinished('2025-10', '2025-10')).toBe(false));
  it('is false for a future end month', () => expect(isFinished('2025-12', '2025-10')).toBe(false));
});

describe('rangeViolation', () => {
  it('allows anything without a span', () => {
    expect(rangeViolation('2030-01', '2030-02', null)).toBeNull();
  });
  it('flags a start after the first expense month', () => {
    expect(rangeViolation('2025-04', null, span)).toEqual({ field: 'start', limit: '2025-03' });
  });
  it('flags an end before the last expense month', () => {
    expect(rangeViolation('2025-01', '2025-07', span)).toEqual({ field: 'end', limit: '2025-08' });
  });
  it('allows an open end', () => {
    expect(rangeViolation('2025-01', null, span)).toBeNull();
  });
  it('allows boundaries equal to the span', () => {
    expect(rangeViolation('2025-03', '2025-08', span)).toBeNull();
  });
  it('checks start first', () => {
    expect(rangeViolation('2025-04', '2025-05', span)?.field).toBe('start');
  });
});

describe('finishBounds', () => {
  it('uses start as min and current month as initial without a span', () => {
    expect(finishBounds('2025-01', null, '2025-10')).toEqual({ min: '2025-01', initial: '2025-10' });
  });
  it('uses the last expense month as min when it is after the current month', () => {
    expect(finishBounds('2025-01', { first: '2025-02', last: '2025-12' }, '2025-10'))
      .toEqual({ min: '2025-12', initial: '2025-12' });
  });
  it('lifts both to a future start', () => {
    expect(finishBounds('2026-02', null, '2025-10')).toEqual({ min: '2026-02', initial: '2026-02' });
  });
});

describe('BudgetExpenseRangeError', () => {
  it('carries kind and limit', () => {
    const e = new BudgetExpenseRangeError('end', '2025-08');
    expect(e).toBeInstanceOf(Error);
    expect(e.kind).toBe('end');
    expect(e.limit).toBe('2025-08');
  });
});
