import { describe, it, expect } from 'vitest';
import { es } from '@/shared/i18n/translations/es';
import { en } from '@/shared/i18n/translations/en';
import { memberSummary } from './memberSummary';

describe('memberSummary', () => {
  it('lists incomes and debts', () => {
    expect(memberSummary(es, { incomes: 2, debts: 2 })).toBe('Titular de 2 ingresos y 2 deudas');
    expect(memberSummary(en, { incomes: 2, debts: 1 })).toBe('Holder of 2 incomes and 1 debt');
  });

  it('uses the singular', () => {
    expect(memberSummary(es, { incomes: 1, debts: 0 })).toBe('Titular de 1 ingreso');
    expect(memberSummary(es, { incomes: 0, debts: 1 })).toBe('Titular de 1 deuda');
  });

  it('says so when the member holds nothing', () => {
    expect(memberSummary(es, { incomes: 0, debts: 0 })).toBe('Sin ingresos ni deudas a su nombre');
    expect(memberSummary(es, undefined)).toBe('Sin ingresos ni deudas a su nombre');
  });
});
