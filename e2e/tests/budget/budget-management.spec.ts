/**
 * Budget Management Tests
 *
 * CRUD operations on budgets via /settings/budgets.
 * Each test cleans up after itself to avoid leaving test data.
 */

import { test, expect } from '@playwright/test';
import { BudgetManagementPage } from '../../pages/BudgetManagementPage';

test.describe('Budget Management (/settings/budgets)', () => {
  let budgetPage: BudgetManagementPage;

  test.beforeEach(async ({ page }) => {
    budgetPage = new BudgetManagementPage(page);
    await budgetPage.goto();
  });

  test('shows the budget management page with "Nuevo" button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Partidas' })
      .or(page.getByText('Partidas').first())).toBeVisible();
    await expect(budgetPage.newBudgetButton).toBeVisible();
  });

  test('can open the new budget dialog', async ({ page }) => {
    await budgetPage.openNewBudgetDialog();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Nuevo presupuesto')).toBeVisible();
  });

  test('shows validation error when name is empty', async ({ page }) => {
    await budgetPage.openNewBudgetDialog();
    // Submit without filling name
    await page.getByRole('button', { name: 'Crear' }).click();
    // Dialog should stay open (or show error) — name is required HTML attribute
    // The form has "required" on the name input, so browser prevents submission
    // OR the app shows a custom error
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
  });

  test('can create a cash budget and see it in the list', async ({ page }) => {
    const name = `E2E Cash ${Date.now()}`;

    await budgetPage.createBudget({
      name,
      amount: '500000',
      paymentMethod: 'cash',
    });

    await budgetPage.waitForBudget(name);
    await expect(page.getByText(name)).toBeVisible();

    // Cleanup
    await budgetPage.deleteBudget(name);
    await budgetPage.waitForBudgetGone(name);
  });

  test('can create a credit card budget', async ({ page }) => {
    const name = `E2E Card ${Date.now()}`;

    await budgetPage.createBudget({
      name,
      amount: '1000000',
      paymentMethod: 'credit',
    });

    await budgetPage.waitForBudget(name);
    await expect(page.getByText(name)).toBeVisible();
    // Credit card budgets show in the "Tarjeta de Crédito" section
    await expect(page.getByText('Tarjeta de Crédito')).toBeVisible();

    // Cleanup
    await budgetPage.deleteBudget(name);
    await budgetPage.waitForBudgetGone(name);
  });

  test('budget dialog closes after creating a budget', async ({ page }) => {
    const name = `E2E Close ${Date.now()}`;

    await budgetPage.openNewBudgetDialog();
    await budgetPage.fillBudgetForm({ name, amount: '100000' });
    await page.getByRole('button', { name: 'Crear' }).click();

    // Dialog must close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Cleanup
    await budgetPage.waitForBudget(name);
    await budgetPage.deleteBudget(name);
  });

  test('can cancel the budget dialog without creating a budget', async ({ page }) => {
    const name = `E2E Cancel ${Date.now()}`;

    await budgetPage.openNewBudgetDialog();
    await page.locator('#b-name').fill(name);
    // Click cancel
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    // Budget should NOT be in the list
    await expect(page.getByText(name)).not.toBeVisible();
  });
});
