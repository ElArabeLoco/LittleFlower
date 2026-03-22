import { describe, it, expect } from 'vitest';
import { computeDebtBalance } from './Debt';
import type { DebtTransaction } from './Debt';

type TxInput = Pick<DebtTransaction, 'type' | 'amount'>;

function makeTx(type: 'debit' | 'credit', amount: number): TxInput {
  return { type, amount };
}

describe('computeDebtBalance', () => {
  it('returns initialAmount when there are no transactions', () => {
    expect(computeDebtBalance(50_000_000, [])).toBe(50_000_000);
  });

  it('credit transactions increase the balance', () => {
    const txs = [makeTx('credit', 1_000_000)];
    expect(computeDebtBalance(50_000_000, txs)).toBe(51_000_000);
  });

  it('debit transactions decrease the balance', () => {
    const txs = [makeTx('debit', 2_000_000)];
    expect(computeDebtBalance(50_000_000, txs)).toBe(48_000_000);
  });

  it('multiple mixed transactions compute correctly', () => {
    const txs = [
      makeTx('credit', 1_000_000),
      makeTx('debit', 5_000_000),
      makeTx('credit', 500_000),
      makeTx('debit', 1_500_000),
    ];
    // 50M + 1M - 5M + 500K - 1.5M = 45M
    expect(computeDebtBalance(50_000_000, txs)).toBe(45_000_000);
  });

  it('balance can go negative when fully paid off with extra payments', () => {
    const txs = [makeTx('debit', 60_000_000)];
    expect(computeDebtBalance(50_000_000, txs)).toBe(-10_000_000);
  });

  it('handles large COP amounts (10 billion) without overflow', () => {
    const large = 10_000_000_000;
    const txs = [makeTx('debit', 1_000_000_000)];
    expect(computeDebtBalance(large, txs)).toBe(9_000_000_000);
  });

  it('zero initialAmount with only transactions', () => {
    const txs = [makeTx('credit', 5_000_000)];
    expect(computeDebtBalance(0, txs)).toBe(5_000_000);
  });

  it('zero amount transactions do not change the balance', () => {
    const txs = [makeTx('debit', 0), makeTx('credit', 0)];
    expect(computeDebtBalance(10_000_000, txs)).toBe(10_000_000);
  });
});
