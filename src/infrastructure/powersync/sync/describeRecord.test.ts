import { describe, it, expect, vi, afterEach } from 'vitest';
import { describeCrudEntry, describeRow, describedFields, type NameLookup } from './describeRecord';
import { labelCache } from './labelCache';
import type { SyncRecordChange } from './types';

const NAMES: Record<string, Record<string, string>> = {
  budgets: { 'b-1': 'Arriendo' },
  incomes: { 'i-1': 'Salario Ana' },
  debts: { 'd-1': 'Hipoteca' },
  assets: { 'a-1': 'Apartamento' },
};

const lookup: NameLookup = (table, id) => (typeof id === 'string' ? NAMES[table]?.[id] ?? null : null);
const noNames: NameLookup = () => null;

function change(overrides: Partial<SyncRecordChange>): SyncRecordChange {
  return {
    table: 'budgets',
    op: 'create',
    id: 'x-1',
    label: null,
    amount: null,
    currency: null,
    month: null,
    ...overrides,
  };
}

describe('describeCrudEntry() — op mapping', () => {
  it.each([
    { op: 'PUT', opData: { name: 'Arriendo' }, expected: 'create' },
    { op: 'PATCH', opData: { default_amount: 1 }, expected: 'update' },
    { op: 'PATCH', opData: { deleted_at: '2026-03-01T10:00:00Z' }, expected: 'delete' },
    { op: 'PATCH', opData: { deleted_at: null }, expected: 'update' },
    { op: 'PATCH', opData: { deleted_at: '  ' }, expected: 'update' },
    { op: 'DELETE', opData: undefined, expected: 'delete' },
  ])('$op $opData → $expected', ({ op, opData, expected }) => {
    expect(describeCrudEntry({ op, table: 'budgets', id: 'b-1', opData }, noNames).op).toBe(expected);
  });
});

describe('describeCrudEntry() — tables', () => {
  it('budgets: name, default amount in COP', () => {
    const result = describeCrudEntry(
      { op: 'PUT', table: 'budgets', id: 'b-1', opData: { name: ' Arriendo ', default_amount: 1_500_000, start_month: '2026-01' } },
      noNames,
    );

    expect(result).toEqual(change({ id: 'b-1', label: 'Arriendo', amount: 1_500_000, currency: 'COP' }));
  });

  it('budget_months: related budget name, amount in COP and month', () => {
    const result = describeCrudEntry(
      { op: 'PUT', table: 'budget_months', id: 'bm-1', opData: { budget_id: 'b-1', amount: 250_000, month: '2026-03' } },
      lookup,
    );

    expect(result).toEqual(
      change({ table: 'budget_months', id: 'bm-1', label: 'Arriendo', amount: 250_000, currency: 'COP', month: '2026-03' }),
    );
  });

  it('expenses: note first, signed amount in COP', () => {
    const result = describeCrudEntry(
      { op: 'PUT', table: 'expenses', id: 'e-1', opData: { budget_id: 'b-1', amount: -50_000, note: 'Mercado' } },
      lookup,
    );

    expect(result).toEqual(change({ table: 'expenses', id: 'e-1', label: 'Mercado', amount: -50_000, currency: 'COP' }));
  });

  it('expenses: falls back to the budget name without a note', () => {
    const result = describeCrudEntry(
      { op: 'PUT', table: 'expenses', id: 'e-1', opData: { budget_id: 'b-1', amount: 80_000, note: null } },
      lookup,
    );

    expect(result.label).toBe('Arriendo');
  });

  it('incomes: name, default amount and its currency', () => {
    const result = describeCrudEntry(
      { op: 'PUT', table: 'incomes', id: 'i-1', opData: { name: 'Salario Ana', default_amount: 5_000, currency: 'USD' } },
      noNames,
    );

    expect(result).toEqual(change({ table: 'incomes', id: 'i-1', label: 'Salario Ana', amount: 5_000, currency: 'USD' }));
  });

  it('income_months: related income name first, real amount, currency and month', () => {
    const result = describeCrudEntry(
      {
        op: 'PUT',
        table: 'income_months',
        id: 'im-1',
        opData: { income_id: 'i-1', real_amount: 5_200, currency: 'USD', month: '2026-03', note: 'bono' },
      },
      lookup,
    );

    expect(result).toEqual(
      change({ table: 'income_months', id: 'im-1', label: 'Salario Ana', amount: 5_200, currency: 'USD', month: '2026-03' }),
    );
  });

  it('income_months: falls back to the note when the income name is unknown', () => {
    const result = describeCrudEntry(
      { op: 'PUT', table: 'income_months', id: 'im-1', opData: { income_id: 'i-404', real_amount: 1, note: 'bono' } },
      lookup,
    );

    expect(result.label).toBe('bono');
  });

  it('exchange_rates: currency pair, rate, target currency and month', () => {
    const result = describeCrudEntry(
      {
        op: 'PUT',
        table: 'exchange_rates',
        id: 'fx-1',
        opData: { from_currency: 'USD', to_currency: 'COP', rate: 4_150.5, month: '2026-03' },
      },
      noNames,
    );

    expect(result).toEqual(
      change({ table: 'exchange_rates', id: 'fx-1', label: 'USD/COP', amount: 4_150.5, currency: 'COP', month: '2026-03' }),
    );
  });

  it('exchange_rates: no pair label when one side is missing', () => {
    const result = describeCrudEntry(
      { op: 'PATCH', table: 'exchange_rates', id: 'fx-1', opData: { rate: '4200.25' } },
      noNames,
    );

    expect(result).toEqual(change({ table: 'exchange_rates', op: 'update', id: 'fx-1', amount: 4_200.25 }));
  });

  it('debts: name, initial amount and currency', () => {
    const result = describeCrudEntry(
      { op: 'PUT', table: 'debts', id: 'd-1', opData: { name: 'Hipoteca', initial_amount: 50_000_000, currency: 'COP' } },
      noNames,
    );

    expect(result).toEqual(change({ table: 'debts', id: 'd-1', label: 'Hipoteca', amount: 50_000_000, currency: 'COP' }));
  });

  it('assets: name, value and currency; own-name fallback for partial patches', () => {
    const created = describeCrudEntry(
      { op: 'PUT', table: 'assets', id: 'a-2', opData: { name: 'CDT', value: 20_000_000, currency: 'COP' } },
      noNames,
    );
    const patched = describeCrudEntry(
      { op: 'PATCH', table: 'assets', id: 'a-1', opData: { value: 480_000_000 } },
      lookup,
    );

    expect(created).toEqual(change({ table: 'assets', id: 'a-2', label: 'CDT', amount: 20_000_000, currency: 'COP' }));
    expect(patched).toEqual(change({ table: 'assets', op: 'update', id: 'a-1', label: 'Apartamento', amount: 480_000_000 }));
  });

  it('debt_transactions: note first, then the related debt name; amount in COP', () => {
    const withNote = describeCrudEntry(
      { op: 'PUT', table: 'debt_transactions', id: 'dt-1', opData: { debt_id: 'd-1', amount: 300_000, note: 'Abono' } },
      lookup,
    );
    const withoutNote = describeCrudEntry(
      { op: 'PUT', table: 'debt_transactions', id: 'dt-2', opData: { debt_id: 'd-1', amount: 300_000 } },
      lookup,
    );

    expect(withNote).toEqual(
      change({ table: 'debt_transactions', id: 'dt-1', label: 'Abono', amount: 300_000, currency: 'COP' }),
    );
    expect(withoutNote.label).toBe('Hipoteca');
  });

  it('household_members: the member name', () => {
    const result = describeCrudEntry(
      { op: 'PUT', table: 'household_members', id: 'm-1', opData: { name: ' Sofía ', tone: 'iris' } },
      noNames,
    );

    expect(result).toEqual(change({ table: 'household_members', id: 'm-1', label: 'Sofía' }));
  });

  it('holders: the name of the income or debt they belong to', () => {
    const income = describeCrudEntry(
      { op: 'PUT', table: 'holders', id: 'h-1', opData: { subject_type: 'income', subject_id: 'i-1', member_id: 'm-1' } },
      lookup,
    );
    const debt = describeCrudEntry(
      { op: 'PUT', table: 'holders', id: 'h-2', opData: { subject_type: 'debt', subject_id: 'd-1', member_id: 'm-1' } },
      lookup,
    );

    const asset = describeCrudEntry(
      { op: 'PUT', table: 'holders', id: 'h-5', opData: { subject_type: 'asset', subject_id: 'a-1', member_id: 'm-1' } },
      lookup,
    );

    expect(income).toEqual(change({ table: 'holders', id: 'h-1', label: 'Salario Ana' }));
    expect(debt).toEqual(change({ table: 'holders', id: 'h-2', label: 'Hipoteca' }));
    expect(asset).toEqual(change({ table: 'holders', id: 'h-5', label: 'Apartamento' }));
  });

  it('holders: no label for an unknown subject type or a DELETE without data', () => {
    const unknown = describeCrudEntry(
      { op: 'PUT', table: 'holders', id: 'h-3', opData: { subject_type: 'budget', subject_id: 'b-1' } },
      lookup,
    );
    const deleted = describeCrudEntry({ op: 'DELETE', table: 'holders', id: 'h-4' }, lookup);

    expect(unknown.label).toBeNull();
    expect(deleted).toEqual(change({ table: 'holders', op: 'delete', id: 'h-4' }));
  });

  it.each(['households', 'users'])('%s: name only', (table) => {
    const result = describeCrudEntry({ op: 'PUT', table, id: 'h-1', opData: { name: 'Casa', join_code: '123456' } }, noNames);

    expect(result).toEqual(change({ table, id: 'h-1', label: 'Casa' }));
  });

  it('unknown table: only table, op and id', () => {
    const result = describeCrudEntry({ op: 'PUT', table: 'mystery', id: 'm-1', opData: { name: 'x', amount: 5 } }, lookup);

    expect(result).toEqual(change({ table: 'mystery', id: 'm-1' }));
  });
});

describe('describeCrudEntry() — partial data', () => {
  it('partial PATCH describes only the columns it carries', () => {
    const result = describeCrudEntry(
      { op: 'PATCH', table: 'budget_months', id: 'bm-1', opData: { amount: '900000', last_edited_by: 'u-1' } },
      lookup,
    );

    expect(result).toEqual(change({ table: 'budget_months', op: 'update', id: 'bm-1', amount: 900_000, currency: 'COP' }));
  });

  it('soft delete of a budget is labelled with its cached name', () => {
    const result = describeCrudEntry(
      { op: 'PATCH', table: 'budgets', id: 'b-1', opData: { deleted_at: '2026-03-01T10:00:00Z' } },
      lookup,
    );

    expect(result).toMatchObject({ op: 'delete', label: 'Arriendo', amount: null });
  });

  it('DELETE without data is labelled with the cached name of its own row', () => {
    expect(describeCrudEntry({ op: 'DELETE', table: 'debts', id: 'd-1' }, lookup)).toMatchObject({
      op: 'delete',
      label: 'Hipoteca',
    });
  });

  it('asks the lookup with the related table and raw id', () => {
    const spy = vi.fn<NameLookup>(() => null);

    describeCrudEntry({ op: 'PUT', table: 'income_months', id: 'im-1', opData: { income_id: 'i-1' } }, spy);

    expect(spy).toHaveBeenCalledWith('incomes', 'i-1');
  });
});

describe('describeRow()', () => {
  afterEach(() => {
    labelCache.setNames('budgets', new Map());
  });

  it('uses the given op as-is', () => {
    const result = describeRow('budgets', 'update', 'b-1', { name: 'Arriendo', deleted_at: '2026-03-01' }, noNames);

    expect(result.op).toBe('update');
  });

  it('coerces numeric strings, trims text and turns empty values into null', () => {
    const result = describeRow(
      'incomes',
      'create',
      'i-1',
      { name: '   ', default_amount: ' 1200 ', currency: ' USD ' },
      noNames,
    );

    expect(result).toMatchObject({ label: null, amount: 1_200, currency: 'USD' });
  });

  it('ignores non-numeric amounts', () => {
    expect(describeRow('expenses', 'create', 'e-1', { amount: 'abc' }, noNames).amount).toBeNull();
    expect(describeRow('expenses', 'create', 'e-1', { amount: '' }, noNames).amount).toBeNull();
  });

  it('handles a missing row', () => {
    expect(describeRow('expenses', 'delete', 'e-1', null, noNames)).toEqual(
      change({ table: 'expenses', op: 'delete', id: 'e-1', currency: 'COP' }),
    );
  });

  it('defaults to the label cache for related names', () => {
    expect(describeRow('budget_months', 'update', 'bm-1', { budget_id: 'b-1' }).label).toBeNull();

    labelCache.setNames('budgets', new Map([['b-1', 'Arriendo']]));

    expect(describeRow('budget_months', 'update', 'bm-1', { budget_id: 'b-1' }).label).toBe('Arriendo');
  });
});

describe('describedFields()', () => {
  /** Full rows, every column of the schema (values only matter where described). */
  const FULL_ROWS: Record<string, Record<string, unknown>> = {
    budgets: { id: 'b-1', household_id: 'h', name: 'Arriendo', description: 'x', category_id: 'c', start_month: '2026-01', end_month: null, default_amount: 1_500_000, payment_mode: 'cash', credit_card_id: null, created_by: 'u', created_at: 't', deleted_at: null, last_edited_by: 'u', last_edited_at: 't', debt_id: null },
    budget_months: { id: 'bm-1', household_id: 'h', budget_id: 'b-1', month: '2026-03', amount: 250_000, is_executed: 0, notes: 'n', created_at: 't', updated_at: 't', last_edited_by: 'u', last_edited_at: 't' },
    expenses: { id: 'e-1', household_id: 'h', budget_id: 'b-1', budget_month_id: 'bm-1', amount: -50_000, note: null, recorded_by: 'u', timestamp: 't', created_at: 't', linked_expense_id: 'e-0', deleted_at: null, paid_with_credit_card: 0 },
    incomes: { id: 'i-1', household_id: 'h', name: 'Salario', person: 'u', is_fixed: 1, category: 'Salario', default_amount: 5_000, currency: 'USD', start_month: '2026-01', end_month: null, created_by: 'u', created_at: 't', deleted_at: null },
    income_months: { id: 'im-1', household_id: 'h', income_id: 'i-1', month: '2026-03', real_amount: 5_200, currency: 'USD', note: 'bono', base_salary: 5_000, deductions: 0, extra_days: 0, updated_at: 't', last_edited_by: 'u', last_edited_at: 't' },
    exchange_rates: { id: 'fx-1', household_id: 'h', from_currency: 'USD', to_currency: 'COP', month: '2026-03', rate: 4_150.5, source: 'manual', updated_at: 't', last_edited_by: 'u', last_edited_at: 't' },
    debts: { id: 'd-1', household_id: 'h', name: 'Hipoteca', description: null, initial_amount: 50_000_000, currency: 'COP', disbursed_at: '2026-01-01', created_by: 'u', created_at: 't', deleted_at: null, updated_at: 't', last_edited_by: 'u', last_edited_at: 't' },
    debt_transactions: { id: 'dt-1', household_id: 'h', debt_id: 'd-1', amount: 300_000, original_amount: null, original_currency: null, exchange_rate: null, type: 'debit', note: null, date: '2026-03-01', source: 'manual', expense_id: null, created_by: 'u', created_at: 't', deleted_at: null },
    assets: { id: 'a-1', household_id: 'h', name: 'Apartamento', kind: 'real_estate', value: 450_000_000, currency: 'COP', created_by: 'u', created_at: 't', updated_at: 't', last_edited_by: 'u', last_edited_at: 't', deleted_at: null },
    households: { id: 'h', name: 'Casa', join_code: '123456', created_at: 't' },
    users: { id: 'u', household_id: 'h', name: 'Ana', email: 'a@x.co', color: '#fff', role: 'admin', created_at: 't' },
  };

  it.each(Object.entries(FULL_ROWS))('describes %s from the kept fields exactly like from the full row', (table, row) => {
    const lookup: NameLookup = (related, id) => `${related}:${String(id)}`;

    expect(describeRow(table, 'delete', 'x', describedFields(row), lookup)).toEqual(
      describeRow(table, 'delete', 'x', row, lookup),
    );
  });

  it('keeps deleted_at for soft deletes and drops everything else', () => {
    expect(describedFields({ id: 'b-1', name: 'Arriendo', created_by: 'u', deleted_at: '2026-03-01' })).toEqual({
      name: 'Arriendo',
      deleted_at: '2026-03-01',
    });
  });
});
