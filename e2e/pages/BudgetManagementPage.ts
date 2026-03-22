import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class BudgetManagementPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/settings/budgets');
    await this.waitForAppReady();
  }

  /** "Nuevo" button that opens the budget form dialog */
  get newBudgetButton() {
    return this.page.getByRole('button', { name: 'Nuevo' });
  }

  /** Open the "Nuevo presupuesto" dialog */
  async openNewBudgetDialog() {
    await this.newBudgetButton.click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  /** Fill the budget form */
  async fillBudgetForm(opts: {
    name: string;
    amount: string;
    paymentMethod?: 'cash' | 'credit';
  }) {
    await this.page.locator('#b-name').fill(opts.name);
    await this.page.locator('#b-amount').fill(opts.amount);

    if (opts.paymentMethod === 'credit') {
      await this.page.getByRole('button', { name: 'Tarjeta' }).click();
    } else {
      // Default is cash — explicitly click to ensure
      await this.page.getByRole('button', { name: 'Efectivo' }).click();
    }
  }

  /** Submit the budget form (create or edit) */
  async submitBudgetForm(mode: 'create' | 'edit' = 'create') {
    const label = mode === 'create' ? 'Crear' : 'Guardar';
    await this.page.getByRole('button', { name: label }).click();
    // Wait for dialog to close
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  }

  /** Create a budget end-to-end, returns the name used */
  async createBudget(opts: {
    name: string;
    amount: string;
    paymentMethod?: 'cash' | 'credit';
  }) {
    await this.openNewBudgetDialog();
    await this.fillBudgetForm(opts);
    await this.submitBudgetForm('create');
  }

  /** Find a budget list item by name text */
  getBudgetItem(name: string) {
    return this.page.locator(`text="${name}"`).first();
  }

  /** Click "Editar" for a specific budget (hover to reveal actions) */
  async openEditDialog(budgetName: string) {
    const row = this.page.getByText(budgetName).locator('..').locator('..');
    await row.hover();
    await row.getByRole('button', { name: 'Editar' }).click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  /** Click "Eliminar" and confirm the native confirm dialog */
  async deleteBudget(budgetName: string) {
    const row = this.page.getByText(budgetName).locator('..').locator('..');
    await row.hover();
    this.page.on('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: 'Eliminar' }).click();
  }

  /** Wait until a budget name appears in the list */
  async waitForBudget(name: string) {
    await expect(this.getBudgetItem(name)).toBeVisible({ timeout: 10_000 });
  }

  /** Wait until a budget name is gone from the list */
  async waitForBudgetGone(name: string) {
    await expect(this.getBudgetItem(name)).not.toBeVisible({ timeout: 10_000 });
  }

  get emptState() {
    return this.page.getByText('Sin presupuestos aún');
  }
}
