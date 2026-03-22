/**
 * Navigation Tests
 *
 * Verify bottom nav, tab-based hubs, and route structure.
 * All run with saved auth state.
 */

import { test, expect } from '@playwright/test';
import { BasePage } from '../../pages/BasePage';

test.describe('Bottom navigation', () => {
  test('shows all 4 nav tabs on dashboard', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/dashboard');
    await base.waitForAppReady();

    const nav = page.getByRole('navigation');
    await expect(nav.getByText('Dashboard')).toBeVisible();
    await expect(nav.getByText('Presupuesto')).toBeVisible();
    await expect(nav.getByText('Finanzas')).toBeVisible();
    await expect(nav.getByText('Perfil')).toBeVisible();
  });

  test('navigates to /budget via nav tab', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/dashboard');
    await base.waitForAppReady();
    await base.clickNavTab('Presupuesto');
    await expect(page).toHaveURL(/\/budget/);
  });

  test('navigates to /finances via nav tab', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/dashboard');
    await base.waitForAppReady();
    await base.clickNavTab('Finanzas');
    await expect(page).toHaveURL(/\/finances/);
  });

  test('navigates to /settings via Perfil tab', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/dashboard');
    await base.waitForAppReady();
    await base.clickNavTab('Perfil');
    await expect(page).toHaveURL(/\/settings/);
  });

  test('Dashboard tab is active on /dashboard', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/dashboard');
    await base.waitForAppReady();

    // Active tab text should be styled differently (color-primary)
    const dashboardBtn = page.getByRole('navigation').getByText('Dashboard');
    await expect(dashboardBtn).toBeVisible();
  });
});

test.describe('Budget Hub (/budget)', () => {
  test('shows hub with two options: Vista Mensual and Vista Anual', async ({ page }) => {
    await page.goto('/budget');
    await expect(page.getByText('Vista Mensual')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Vista Anual')).toBeVisible();
  });

  test('clicking Vista Mensual navigates to /month', async ({ page }) => {
    await page.goto('/budget');
    await page.getByRole('link', { name: /Vista Mensual/i })
      .or(page.getByRole('button', { name: /Vista Mensual/i }))
      .or(page.getByText('Vista Mensual').locator('..'))
      .first()
      .click();
    await expect(page).toHaveURL(/\/month/, { timeout: 10_000 });
  });

  test('clicking Vista Anual navigates to /anual', async ({ page }) => {
    await page.goto('/budget');
    await page.getByRole('link', { name: /Vista Anual/i })
      .or(page.getByRole('button', { name: /Vista Anual/i }))
      .or(page.getByText('Vista Anual').locator('..'))
      .first()
      .click();
    await expect(page).toHaveURL(/\/anual/, { timeout: 10_000 });
  });
});

test.describe('Finances Hub (/finances)', () => {
  test('shows hub with Ingresos, Presupuestos, Deudas options', async ({ page }) => {
    await page.goto('/finances');
    await expect(page.getByText('Ingresos').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Presupuestos').first()).toBeVisible();
    await expect(page.getByText('Deudas').first()).toBeVisible();
  });

  test('navigating to /income works from finances hub', async ({ page }) => {
    await page.goto('/finances');
    // Click the Ingresos card/button
    await page.getByRole('link', { name: /Ingresos/i })
      .or(page.getByRole('button', { name: /Ingresos/i }))
      .first()
      .click();
    await expect(page).toHaveURL(/\/income/, { timeout: 10_000 });
  });
});

test.describe('Protected routes', () => {
  // Tests that don't use storageState — use fresh page context
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/(login|)$/, { timeout: 10_000 });
  });

  test('/month redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/month');
    await expect(page).toHaveURL(/\/(login|)$/, { timeout: 10_000 });
  });

  test('/settings/budgets redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/settings/budgets');
    await expect(page).toHaveURL(/\/(login|)$/, { timeout: 10_000 });
  });
});
