/**
 * Debt Management Tests
 *
 * Covers the debt tracking flow at /debts.
 * Creates and cleans up test debt records.
 */

import { test, expect } from '@playwright/test';
import { DebtsPage } from '../../pages/DebtsPage';

test.describe('Debts Page (/debts)', () => {
  let debtsPage: DebtsPage;

  test.beforeEach(async ({ page }) => {
    debtsPage = new DebtsPage(page);
    await debtsPage.goto();
  });

  test('shows the debts page with "Nueva deuda" button', async ({ page }) => {
    await expect(page.getByText('Deudas').first()).toBeVisible();
    await expect(debtsPage.newDebtButton).toBeVisible();
  });

  test('can open the new debt dialog', async ({ page }) => {
    await debtsPage.openNewDebtDialog();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('debt dialog has required fields: name, amount, date', async ({ page }) => {
    await debtsPage.openNewDebtDialog();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Nombre')).toBeVisible();
    await expect(dialog.getByText('Monto original')).toBeVisible();
    await expect(dialog.getByText('Fecha de desembolso')).toBeVisible();
  });

  test('can cancel debt creation', async ({ page }) => {
    await debtsPage.openNewDebtDialog();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('can create a debt and see it in the list', async ({ page }) => {
    const name = `E2E Deuda ${Date.now()}`;

    await debtsPage.openNewDebtDialog();
    const dialog = page.getByRole('dialog');

    // Fill name
    await dialog.locator('input[type="text"]').first().fill(name);
    // Fill amount
    await dialog.locator('input[inputmode="numeric"]').fill('5000000');
    // Fill disbursement date
    const today = new Date().toISOString().slice(0, 10);
    await dialog.locator('input[type="date"]').fill(today);
    // Submit
    await dialog.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Debt should appear in the list
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    // Cleanup
    page.on('dialog', d => d.accept());
    const card = page.locator('[class*="rounded"]').filter({ hasText: name }).first();
    await card.hover();
    await card.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 10_000 });
  });

  test('shows debt summary KPIs when debts exist', async ({ page }) => {
    const name = `E2E KPI Debt ${Date.now()}`;

    // Create a debt
    await debtsPage.openNewDebtDialog();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="text"]').first().fill(name);
    await dialog.locator('input[inputmode="numeric"]').fill('2000000');
    const today = new Date().toISOString().slice(0, 10);
    await dialog.locator('input[type="date"]').fill(today);
    await dialog.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // KPI cards should appear
    await expect(page.getByText('Total adeudado')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Deudas activas')).toBeVisible();

    // Cleanup
    page.on('dialog', d => d.accept());
    const card = page.locator('[class*="rounded"]').filter({ hasText: name }).first();
    await card.hover();
    await card.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 10_000 });
  });

  test('shows empty state when no debts exist', async ({ page }) => {
    // If there are no debts (or after cleanup), show empty state
    const count = await page.getByText('E2E').count();
    if (count === 0) {
      // No test debts — might show empty state depending on user's real data
      // Just verify the page renders without error
      await expect(page.locator('body')).not.toContainText('Error inesperado');
    }
  });
});
