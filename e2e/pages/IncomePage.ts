import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class IncomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/income');
    await this.waitForAppReady();
  }

  get title() {
    return this.page.getByText('Ingresos').first();
  }

  /** "Nuevo" button to open the income form dialog */
  get newIncomeButton() {
    return this.page.getByRole('button', { name: 'Nuevo' });
  }

  async openNewIncomeDialog() {
    await this.newIncomeButton.click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  /** Fill and submit the income form */
  async createIncome(opts: {
    name: string;
    amount: string;
    currency?: 'COP' | 'USD';
  }) {
    await this.openNewIncomeDialog();

    // Name field — look for label "Nombre *"
    const dialog = this.page.getByRole('dialog');
    await dialog.locator('input[id*="name"], input[placeholder*="Salario"]').fill(opts.name);

    // Amount
    await dialog.locator('input[id*="amount"], input[inputmode="numeric"]').fill(opts.amount);

    // Currency (only if USD)
    if (opts.currency === 'USD') {
      await dialog.getByRole('combobox').click();
      await this.page.getByRole('option', { name: 'USD' }).click();
    }

    // Submit
    await dialog.getByRole('button', { name: 'Crear' }).click();
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  }

  /** Find an income card by name */
  getIncomeCard(name: string) {
    return this.page.getByText(name).first();
  }

  /** Delete income (click delete icon on hover) */
  async deleteIncome(incomeName: string) {
    const card = this.page.locator('[class*="rounded"]').filter({ hasText: incomeName });
    await card.hover();
    this.page.on('dialog', dialog => dialog.accept());
    await card.getByRole('button', { name: 'Eliminar' }).click();
  }

  /** Navigate to previous month */
  async goToPrevMonth() {
    await this.page.getByRole('button').filter({ has: this.page.locator('svg') }).first().click();
  }

  /** Navigate to next month */
  async goToNextMonth() {
    await this.page.getByRole('button').filter({ has: this.page.locator('svg') }).last().click();
  }

  get noIncomesMessage() {
    return this.page.getByText('Sin fuentes de ingreso');
  }
}
