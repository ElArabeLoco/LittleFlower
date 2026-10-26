/**
 * Navigation Tests
 *
 * Verify bottom nav, the Gastos tab's Mes · Año switch, the Finanzas hub and route structure.
 * All run with saved auth state.
 */

import { test, expect } from '@playwright/test';
import { BasePage } from '../../pages/BasePage';

test.describe('Bottom navigation', () => {
  test('shows Inicio, Gráficas, Gastos, Finanzas and Perfil in the nav', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/home');
    await base.waitForAppReady();

    const nav = page.getByRole('navigation');
    await expect(nav.getByText('Inicio')).toBeVisible();
    await expect(nav.getByText('Gráficas')).toBeVisible();
    await expect(nav.getByText('Gastos')).toBeVisible();
    await expect(nav.getByText('Finanzas')).toBeVisible();
    await expect(nav.getByText('Perfil')).toBeVisible();
  });

  test('the Gastos tab opens the month view', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/dashboard');
    await base.waitForAppReady();
    await base.clickNavTab('Gastos');
    await expect(page).toHaveURL(/\/month/);
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

  test('each tab is the current page on the routes it owns', async ({ page }) => {
    const base = new BasePage(page);
    for (const [path, tab] of [
      ['/home', 'Inicio'], ['/dashboard', 'Gráficas'], ['/anual', 'Gastos'],
      ['/transactions', 'Gastos'], ['/net-worth', 'Finanzas'], ['/members', 'Perfil'],
    ]) {
      await page.goto(path);
      await base.waitForAppReady();
      await expect(page.getByRole('navigation').getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('navigates to /dashboard via nav tab', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/home');
    await base.waitForAppReady();
    await base.clickNavTab('Gráficas');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('home links to the year view', async ({ page }) => {
    const base = new BasePage(page);
    await page.goto('/home');
    await base.waitForAppReady();
    await page.getByRole('link', { name: /Presupuesto del año/i }).click();
    await expect(page).toHaveURL(/\/anual/, { timeout: 10_000 });
  });
});

test.describe('Gastos tab: Mes · Año switch', () => {
  test('/budget, the old hub, opens the month view', async ({ page }) => {
    await page.goto('/budget');
    await expect(page).toHaveURL(/\/month/, { timeout: 15_000 });
  });

  test('switches from the month view to the year view and back', async ({ page }) => {
    await page.goto('/month');
    const views = page.getByRole('group', { name: 'Vista de gastos' });
    await expect(views.getByRole('link', { name: 'Mes' })).toHaveAttribute('aria-current', 'page', { timeout: 15_000 });
    await views.getByRole('link', { name: 'Año' }).click();
    await expect(page).toHaveURL(/\/anual/, { timeout: 10_000 });
    await page.getByRole('group', { name: 'Vista de gastos' }).getByRole('link', { name: 'Mes' }).click();
    await expect(page).toHaveURL(/\/month/, { timeout: 10_000 });
  });

  test('the month view links to the list of expenses', async ({ page }) => {
    await page.goto('/month');
    await page.getByRole('link', { name: /Ver la lista de gastos del mes/i }).click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });
  });
});

test.describe('Finances Hub (/finances)', () => {
  test('shows hub with Patrimonio, Ingresos, Partidas, Deudas options', async ({ page }) => {
    await page.goto('/finances');
    await expect(page.getByText('Patrimonio').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ingresos').first()).toBeVisible();
    await expect(page.getByText('Partidas').first()).toBeVisible();
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
