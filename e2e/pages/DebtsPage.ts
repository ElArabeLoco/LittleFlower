import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DebtsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/debts');
    await this.waitForAppReady();
  }

  get title() {
    return this.page.getByText('Deudas').first();
  }

  /** "Nueva deuda" button */
  get newDebtButton() {
    return this.page.getByRole('button', { name: 'Nueva deuda' });
  }

  async openNewDebtDialog() {
    await this.newDebtButton.click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  /** Create a new debt */
  async createDebt(opts: { name: string; amount: string }) {
    await this.openNewDebtDialog();

    const dialog = this.page.getByRole('dialog');
    // Name field
    await dialog.locator('input[id*="d-name"], input[placeholder*="Banco"]').fill(opts.name);
    // Amount
    await dialog.locator('input[id*="d-amount"], input[inputmode="numeric"]').fill(opts.amount);
    // Disbursed date (required) — use today
    const today = new Date().toISOString().slice(0, 10);
    await dialog.locator('input[type="date"]').fill(today);

    await dialog.getByRole('button', { name: 'Crear' }).click();
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  }

  /** Find a debt card by name */
  getDebtCard(name: string) {
    return this.page.locator('[class*="rounded"]').filter({ hasText: name }).first();
  }

  /** Click "Agregar transacción" on a debt card */
  async openTransactionDialog(debtName: string) {
    const card = this.getDebtCard(debtName);
    await card.getByRole('button', { name: 'Agregar transacción' }).click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  /** Record a payment on a debt */
  async recordPayment(opts: { debtName: string; amount: string }) {
    await this.openTransactionDialog(opts.debtName);
    const dialog = this.page.getByRole('dialog');
    await dialog.locator('input[inputmode="numeric"]').fill(opts.amount);
    await dialog.getByRole('button', { name: 'Registrar' }).click();
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  }

  /** Delete a debt */
  async deleteDebt(debtName: string) {
    const card = this.getDebtCard(debtName);
    this.page.on('dialog', dialog => dialog.accept());
    await card.getByRole('button', { name: 'Eliminar' }).click();
  }

  get noDebtsMessage() {
    return this.page.getByText('Sin deudas registradas');
  }
}
