import { describe, it, expect, vi } from 'vitest';

vi.mock('@/infrastructure/powersync/client', () => ({
  db: { getAll: vi.fn() },
}));

import { buildActivosSheet, buildDeudasSheet, buildIngresosSheet } from './exportService';
import type { FlorecitaExport } from './types';

function backup(overrides: Partial<FlorecitaExport>): FlorecitaExport {
  return {
    _format: 'florecita-backup',
    _v: 1,
    _exported_at: '2026-10-23T00:00:00Z',
    _app_version: 'test',
    _household_id: 'hh-1',
    households: [],
    users: [{ id: 'u1', name: 'Jaime' }],
    budgets: [],
    budget_months: [],
    expenses: [],
    incomes: [],
    income_months: [],
    exchange_rates: [],
    debts: [],
    debt_transactions: [],
    ...overrides,
  };
}

const members = [
  { id: 'm-luis', name: 'Luis', deleted_at: null },
  { id: 'm-ana', name: 'Ana', deleted_at: null },
  { id: 'm-gone', name: 'Eva', deleted_at: '2026-09-01T00:00:00Z' },
];

const income = (id: string) => ({ id, name: `Ingreso ${id}`, person: 'u1', currency: 'COP' });
const debt = (id: string) => ({
  id, name: `Deuda ${id}`, initial_amount: 1_000, currency: 'COP', disbursed_at: '2026-01-01', description: null,
});
const holder = (subject_type: string, subject_id: string, member_id: string) => ({
  id: `${subject_type}:${subject_id}:${member_id}`, subject_type, subject_id, member_id,
});

describe('buildIngresosSheet — Titulares column', () => {
  const sheet = buildIngresosSheet(backup({
    incomes: [income('i1'), income('i2'), income('i3'), income('i4')],
    household_members: members,
    holders: [
      holder('income', 'i1', 'm-luis'),
      holder('income', 'i1', 'm-ana'),
      holder('income', 'i2', 'm-ana'),
      holder('income', 'i3', 'm-gone'),
      holder('debt', 'i4', 'm-ana'),
    ],
  }));

  it('replaces Persona with Titulares', () => {
    expect(sheet[1].slice(0, 3)).toEqual(['Fuente', 'Titulares', 'Moneda']);
  });

  it('lists active holder names, alphabetical, or Hogar when there are none', () => {
    const byName = Object.fromEntries(sheet.slice(2, -1).map(row => [row[0], row[1]]));
    expect(byName).toEqual({
      'Ingreso i1': 'Ana, Luis',
      'Ingreso i2': 'Ana',
      'Ingreso i3': 'Hogar', // its only holder is a deleted member
      'Ingreso i4': 'Hogar', // a debt holder with the same id is not an income holder
    });
  });

  it('works on backups made before members existed', () => {
    const old = buildIngresosSheet(backup({ incomes: [income('i1')] }));
    expect(old[2][1]).toBe('Hogar');
  });
});

describe('buildDeudasSheet — Titulares in the debt header', () => {
  const sheet = buildDeudasSheet(backup({
    debts: [debt('d1'), debt('d2'), debt('d3')],
    household_members: members,
    holders: [
      holder('debt', 'd1', 'm-luis'),
      holder('debt', 'd1', 'm-ana'),
      holder('debt', 'd2', 'm-gone'),
    ],
  }));

  const headers = sheet.filter(row => String(row[0]).startsWith('DEUDA:'));

  it('adds the holders to each debt header row', () => {
    expect(headers.map(row => [row[0], row[4]])).toEqual([
      ['DEUDA: Deuda d1', 'Titulares: Ana, Luis'],
      ['DEUDA: Deuda d2', 'Titulares: Hogar'],
      ['DEUDA: Deuda d3', 'Titulares: Hogar'],
    ]);
  });
});

describe('buildActivosSheet', () => {
  const asset = (id: string, extra: Record<string, unknown> = {}) => ({
    id, name: `Activo ${id}`, kind: 'savings', value: 1_000, currency: 'COP', deleted_at: null, ...extra,
  });

  it('lists active assets alphabetically with type, value, currency and holders', () => {
    const sheet = buildActivosSheet(backup({
      assets: [
        asset('b', { kind: 'vehicle', value: 80_000_000 }),
        asset('a', { kind: 'real_estate', value: 450_000_000 }),
        asset('c', { kind: 'savings', value: 5_000, currency: 'USD' }),
        asset('gone', { deleted_at: '2026-09-01T00:00:00Z' }),
      ],
      household_members: members,
      holders: [holder('asset', 'a', 'm-luis'), holder('asset', 'a', 'm-ana'), holder('debt', 'b', 'm-ana')],
    }));

    expect(sheet[1]).toEqual(['Nombre', 'Tipo', 'Valor', 'Moneda', 'Titulares']);
    expect(sheet.slice(2)).toEqual([
      ['Activo a', 'Inmueble', 450_000_000, 'COP', 'Ana, Luis'],
      ['Activo b', 'Vehículo', 80_000_000, 'COP', 'Hogar'],
      ['Activo c', 'Ahorros', 5_000, 'USD', 'Hogar'],
    ]);
  });

  it('adds the value history of the assets with more than one value, oldest first', () => {
    const valuation = (id: string, assetId: string, value: number, valued_on: string, extra: Record<string, unknown> = {}) => ({
      id, asset_id: assetId, value, currency: 'COP', valued_on, note: null,
      created_at: `${valued_on}T00:00:00Z`, deleted_at: null, ...extra,
    });
    const sheet = buildActivosSheet(backup({
      assets: [asset('a', { value: 120 }), asset('b')],
      asset_valuations: [
        valuation('a2', 'a', 120, '2026-06-01', { note: 'Avalúo' }),
        valuation('a1', 'a', 100, '2025-01-01'),
        valuation('a3', 'a', 999, '2026-07-01', { deleted_at: '2026-07-02T00:00:00Z' }),
        valuation('b1', 'b', 1_000, '2026-01-01'),
      ],
    }));

    expect(sheet.slice(4)).toEqual([
      [],
      ['HISTORIAL DE VALOR', '', '', '', ''],
      ['Activo', 'Fecha', 'Valor', 'Moneda', 'Nota'],
      ['Activo a', '2025-01-01', 100, 'COP', ''],
      ['Activo a', '2026-06-01', 120, 'COP', 'Avalúo'],
    ]);
  });

  it('works on backups made before assets existed', () => {
    expect(buildActivosSheet(backup({})).slice(2)).toEqual([['Sin activos registrados']]);
  });
});
