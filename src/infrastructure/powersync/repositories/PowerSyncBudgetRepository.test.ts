import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/infrastructure/powersync/client', () => ({
  db: {
    getAll: vi.fn(),
    get: vi.fn(),
  },
}));

import { db } from '@/infrastructure/powersync/client';
import { PowerSyncBudgetRepository } from './PowerSyncBudgetRepository';

const mockGetAll = db.getAll as Mock;
const mockGet = db.get as Mock;

function makeBudgetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'budget-1',
    household_id: 'hh-1',
    name: 'Arriendo',
    description: null,
    category_id: 'housing',
    start_month: '2025-01',
    default_amount: 1_500_000,
    payment_mode: 'cash',
    credit_card_id: null,
    debt_id: null,
    created_by: 'user-1',
    created_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
    last_edited_by: null,
    last_edited_at: null,
    ...overrides,
  };
}

function makeBudgetMonthRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bm-1',
    household_id: 'hh-1',
    budget_id: 'budget-1',
    month: '2025-03',
    amount: 1_500_000,
    is_executed: 0,
    notes: null,
    created_at: '2025-03-01T00:00:00Z',
    updated_at: '2025-03-01T00:00:00Z',
    last_edited_by: null,
    last_edited_at: null,
    ...overrides,
  };
}

describe('PowerSyncBudgetRepository', () => {
  let repo: PowerSyncBudgetRepository;

  beforeEach(() => {
    repo = new PowerSyncBudgetRepository();
    vi.clearAllMocks();
  });

  describe('listActive()', () => {
    it('calls db.getAll with SQL containing "deleted_at IS NULL"', async () => {
      mockGetAll.mockResolvedValue([]);
      await repo.listActive();
      expect(mockGetAll).toHaveBeenCalledOnce();
      const [sql] = mockGetAll.mock.calls[0] as [string, ...unknown[]];
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('returns mapped Budget domain objects (camelCase)', async () => {
      mockGetAll.mockResolvedValue([makeBudgetRow()]);
      const result = await repo.listActive();
      expect(result).toHaveLength(1);
      const budget = result[0];
      expect(budget.id).toBe('budget-1');
      expect(budget.householdId).toBe('hh-1');
      expect(budget.name).toBe('Arriendo');
      expect(budget.categoryId).toBe('housing');
      expect(budget.startMonth).toBe('2025-01');
      expect(budget.defaultAmount).toBe(1_500_000);
    });

    it("maps payment_mode: 'cash' → paymentMode: 'cash'", async () => {
      mockGetAll.mockResolvedValue([makeBudgetRow({ payment_mode: 'cash' })]);
      const [budget] = await repo.listActive();
      expect(budget.paymentMode).toBe('cash');
    });

    it("maps payment_mode: 'credit_card' → paymentMode: 'credit_card'", async () => {
      mockGetAll.mockResolvedValue([makeBudgetRow({ payment_mode: 'credit_card' })]);
      const [budget] = await repo.listActive();
      expect(budget.paymentMode).toBe('credit_card');
    });

    it("maps payment_mode: 'both' → paymentMode: 'both'", async () => {
      mockGetAll.mockResolvedValue([makeBudgetRow({ payment_mode: 'both' })]);
      const [budget] = await repo.listActive();
      expect(budget.paymentMode).toBe('both');
    });

    it('returns empty array when db.getAll returns []', async () => {
      mockGetAll.mockResolvedValue([]);
      const result = await repo.listActive();
      expect(result).toEqual([]);
    });
  });

  describe('listAll()', () => {
    it('calls db.getAll and returns mapped Budget objects including soft-deleted ones', async () => {
      const rows = [
        makeBudgetRow(),
        makeBudgetRow({ id: 'budget-2', deleted_at: '2025-02-01T00:00:00Z' }),
      ];
      mockGetAll.mockResolvedValue(rows);
      const result = await repo.listAll();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('budget-1');
      expect(result[1].id).toBe('budget-2');
    });
  });

  describe('getById(id)', () => {
    it('calls db.get with the id as parameter', async () => {
      mockGet.mockResolvedValue(null);
      await repo.getById('budget-1');
      expect(mockGet).toHaveBeenCalledOnce();
      const [, params] = mockGet.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('budget-1');
    });

    it('returns mapped Budget when row exists', async () => {
      mockGet.mockResolvedValue(makeBudgetRow());
      const result = await repo.getById('budget-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('budget-1');
      expect(result?.householdId).toBe('hh-1');
    });

    it('returns null when db.get returns null', async () => {
      mockGet.mockResolvedValue(null);
      const result = await repo.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('listMonthRows(month)', () => {
    it('calls db.getAll with the month as parameter', async () => {
      mockGetAll.mockResolvedValue([]);
      await repo.listMonthRows('2025-03');
      expect(mockGetAll).toHaveBeenCalledOnce();
      const [, params] = mockGetAll.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('2025-03');
    });

    it('returns mapped BudgetMonth domain objects', async () => {
      mockGetAll.mockResolvedValue([makeBudgetMonthRow()]);
      const result = await repo.listMonthRows('2025-03');
      expect(result).toHaveLength(1);
      const bm = result[0];
      expect(bm.id).toBe('bm-1');
      expect(bm.budgetId).toBe('budget-1');
      expect(bm.month).toBe('2025-03');
      expect(bm.amount).toBe(1_500_000);
    });

    it('maps is_executed: 0 → isExecuted: false', async () => {
      mockGetAll.mockResolvedValue([makeBudgetMonthRow({ is_executed: 0 })]);
      const [bm] = await repo.listMonthRows('2025-03');
      expect(bm.isExecuted).toBe(false);
    });

    it('maps is_executed: 1 → isExecuted: true', async () => {
      mockGetAll.mockResolvedValue([makeBudgetMonthRow({ is_executed: 1 })]);
      const [bm] = await repo.listMonthRows('2025-03');
      expect(bm.isExecuted).toBe(true);
    });
  });

  describe('getMonthRow(budgetId, month)', () => {
    it('calls db.get with both budgetId and month as parameters', async () => {
      mockGet.mockResolvedValue(null);
      await repo.getMonthRow('budget-1', '2025-03');
      expect(mockGet).toHaveBeenCalledOnce();
      const [, params] = mockGet.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('budget-1');
      expect(params).toContain('2025-03');
    });

    it('returns mapped BudgetMonth when row exists', async () => {
      mockGet.mockResolvedValue(makeBudgetMonthRow());
      const result = await repo.getMonthRow('budget-1', '2025-03');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('bm-1');
      expect(result?.budgetId).toBe('budget-1');
    });

    it('returns null when db.get returns null', async () => {
      mockGet.mockResolvedValue(null);
      const result = await repo.getMonthRow('non-existent', '2025-03');
      expect(result).toBeNull();
    });
  });
});
