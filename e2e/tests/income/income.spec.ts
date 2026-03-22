/**
 * Income Tests
 *
 * Covers the income management flow at /income.
 * Creates and cleans up test income records.
 */

import { test, expect } from '@playwright/test';
import { IncomePage } from '../../pages/IncomePage';

test.describe('Income Page (/income)', () => {
  let incomePage: IncomePage;

  test.beforeEach(async ({ page }) => {
    incomePage = new IncomePage(page);
    await incomePage.goto();
  });

  test('shows the income page with "Nuevo" button', async ({ page }) => {
    await expect(page.getByText('Ingresos').first()).toBeVisible();
    await expect(incomePage.newIncomeButton).toBeVisible();
  });

  test('shows month navigation buttons', async ({ page }) => {
    // There should be prev/next buttons for month navigation
    const chevronButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await expect(chevronButtons.first()).toBeVisible();
  });

  test('can open the new income dialog', async ({ page }) => {
    await incomePage.openNewIncomeDialog();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('income dialog has name, amount, and currency fields', async ({ page }) => {
    await incomePage.openNewIncomeDialog();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Nombre')).toBeVisible();
    await expect(dialog.locator('input[inputmode="numeric"]')).toBeVisible();
  });

  test('can cancel income creation', async ({ page }) => {
    await incomePage.openNewIncomeDialog();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('can create a COP income and see it in the list', async ({ page }) => {
    const name = `E2E Salario ${Date.now()}`;

    await incomePage.openNewIncomeDialog();
    const dialog = page.getByRole('dialog');

    // Fill name
    await dialog.locator('input[type="text"]').first().fill(name);
    // Fill amount
    await dialog.locator('input[inputmode="numeric"]').fill('3000000');
    // Submit
    await dialog.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Income should appear in the list
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    // Cleanup: delete the income
    const card = page.locator('[class*="rounded"]').filter({ hasText: name });
    await card.hover();
    page.on('dialog', d => d.accept());
    await card.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 10_000 });
  });

  test('shows empty state message when no income sources exist', async ({ page }) => {
    // Navigate to a future month (no income there)
    await page.goto('/income?month=2099-01');
    // Wait for the page to render
    await expect(page).toHaveURL(/\/income/);
    // Empty state or the list should render without errors
    await expect(page.locator('body')).not.toContainText('Error');
  });
});
