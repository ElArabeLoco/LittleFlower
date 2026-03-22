import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class MonthViewPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/month');
    await this.waitForAppReady();
  }

  get title() {
    return this.page.getByText('Vista Mensual');
  }

  /** Button to go to the previous month */
  get prevMonthButton() {
    return this.page.getByRole('button', { name: 'Mes anterior' });
  }

  /** Button to go to the next month */
  get nextMonthButton() {
    return this.page.getByRole('button', { name: 'Mes siguiente' });
  }

  /**
   * Open the expense dialog for a given budget name.
   * Finds the "Ver o registrar gastos" button on that budget card.
   */
  async openExpenseDialog(budgetName: string) {
    // Find the card containing the budget name and click the expense button
    const card = this.page.locator('[class*="rounded"]').filter({ hasText: budgetName });
    await card.getByRole('button', { name: 'Ver o registrar gastos' }).click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  /** Add an expense from within the dialog */
  async addExpense(opts: { amount: string; note?: string }) {
    await this.page.locator('#exp-amount').fill(opts.amount);
    if (opts.note) {
      await this.page.locator('#exp-note').fill(opts.note);
    }
    await this.page.getByRole('button', { name: 'Registrar' }).click();
  }

  /** Close the expense dialog */
  async closeExpenseDialog() {
    await this.page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
  }

  get noBudgetsMessage() {
    return this.page.getByText('Sin presupuestos activos');
  }
}
