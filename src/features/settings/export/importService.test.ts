import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/infrastructure/powersync/client', () => ({
  db: { getAll: vi.fn(), execute: vi.fn() },
}));

import { db } from '@/infrastructure/powersync/client';
import { importFromLF } from './importService';

const mockExecute = db.execute as Mock;

function backupFile(data: Record<string, unknown>): File {
  const json = JSON.stringify({ _format: 'florecita-backup', _v: 1, _household_id: 'hh-1', ...data });
  return { text: async () => json } as unknown as File;
}

/** Column → value of the INSERT written for `table`. */
function inserted(table: string): Record<string, unknown> {
  const call = mockExecute.mock.calls.find(([sql]) => String(sql).startsWith(`INSERT INTO ${table} `));
  if (!call) throw new Error(`no insert into ${table}`);
  const cols = String(call[0]).match(/\(([^)]+)\)/)![1].split(', ');
  return Object.fromEntries(cols.map((c, i) => [c, (call[1] as unknown[])[i]]));
}

beforeEach(() => {
  vi.clearAllMocks();
  (db.getAll as Mock).mockResolvedValue([]);
  mockExecute.mockResolvedValue({});
});

describe('importFromLF — debts from backups that predate loan terms', () => {
  it('fills the loan-term defaults instead of NULL', async () => {
    await importFromLF(backupFile({
      debts: [{ id: 'd1', name: 'Préstamo', initial_amount: 1_000_000, currency: 'COP', disbursed_at: '2025-01-01' }],
      debt_transactions: [{ id: 't1', debt_id: 'd1', amount: 100_000, type: 'debit', date: '2025-02-01', source: 'manual' }],
    }), 'hh-1');

    expect(inserted('debts')).toMatchObject({
      kind: 'personal', interest_rate: 0, amortization: 'none', monthly_fees: 0, lender: null,
    });
    expect(inserted('debt_transactions')).toMatchObject({ interest_amount: 0, fees_amount: 0 });
  });

  it('keeps loan terms present in the backup', async () => {
    await importFromLF(backupFile({
      debts: [{
        id: 'd1', name: 'Hipoteca', initial_amount: 200_000_000, currency: 'COP', disbursed_at: '2026-01-01',
        kind: 'mortgage', interest_rate: 0.12, amortization: 'fixed_installment', term_months: 240, monthly_fees: 185_000,
      }],
    }), 'hh-1');

    expect(inserted('debts')).toMatchObject({
      kind: 'mortgage', interest_rate: 0.12, amortization: 'fixed_installment', term_months: 240, monthly_fees: 185_000,
    });
  });
});
