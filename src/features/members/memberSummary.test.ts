import { describe, it, expect } from 'vitest';
import { es } from '@/shared/i18n/translations/es';
import { en } from '@/shared/i18n/translations/en';
import { memberSummary } from './memberSummary';

describe('memberSummary', () => {
  it('lists incomes and debts', () => {
    expect(memberSummary(es, { incomes: 2, debts: 2, assets: 0 })).toBe('Titular de 2 ingresos y 2 deudas');
    expect(memberSummary(en, { incomes: 2, debts: 1, assets: 0 })).toBe('Holder of 2 incomes and 1 debt');
  });

  it('lists three kinds with commas and a final "and"', () => {
    expect(memberSummary(es, { incomes: 2, debts: 1, assets: 3 })).toBe('Titular de 2 ingresos, 1 deuda y 3 activos');
    expect(memberSummary(en, { incomes: 1, debts: 1, assets: 1 })).toBe('Holder of 1 income, 1 debt and 1 asset');
  });

  it('uses the singular', () => {
    expect(memberSummary(es, { incomes: 1, debts: 0, assets: 0 })).toBe('Titular de 1 ingreso');
    expect(memberSummary(es, { incomes: 0, debts: 1, assets: 0 })).toBe('Titular de 1 deuda');
    expect(memberSummary(es, { incomes: 0, debts: 0, assets: 1 })).toBe('Titular de 1 activo');
  });

  it('says so when the member holds nothing', () => {
    expect(memberSummary(es, { incomes: 0, debts: 0, assets: 0 })).toBe('Sin ingresos, deudas ni activos a su nombre');
    expect(memberSummary(es, undefined)).toBe('Sin ingresos, deudas ni activos a su nombre');
  });
});
