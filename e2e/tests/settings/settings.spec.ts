/**
 * Settings Tests
 *
 * Covers the /settings page: profile, household, theme, number format, logout.
 */

import { test, expect } from '@playwright/test';
import { SettingsPage } from '../../pages/SettingsPage';

test.describe('Settings Page (/settings)', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('shows user email in profile card', async ({ page }) => {
    // Profile section should display an email or name
    await expect(page.locator('[class*="truncate"]').filter({ hasText: /@/ }).first())
      .toBeVisible({ timeout: 15_000 });
  });

  test('shows the household section', async ({ page }) => {
    await settingsPage.expectHouseholdVisible();
  });

  test('shows the join code section', async ({ page }) => {
    await expect(settingsPage.joinCodeSection).toBeVisible();
  });

  test('shows theme options: Claro, Oscuro, Automático', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Claro' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Oscuro' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Automático' })).toBeVisible();
  });

  test('can switch to dark theme', async ({ page }) => {
    await settingsPage.selectTheme('Oscuro');
    // Dark mode class should be on the <html> element
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5_000 });
  });

  test('can switch to light theme', async ({ page }) => {
    // First set dark to ensure we can switch back
    await settingsPage.selectTheme('Oscuro');
    await settingsPage.selectTheme('Claro');
    await expect(page.locator('html')).not.toHaveClass(/dark/, { timeout: 5_000 });
  });

  test('theme persists after page reload', async ({ page }) => {
    await settingsPage.selectTheme('Oscuro');
    await page.reload();
    await settingsPage.waitForAppReady();
    // Dark mode should still be active
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 10_000 });

    // Restore to auto
    await settingsPage.selectTheme('Automático');
  });

  test('shows number format options: Abreviado, Completo', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Abreviado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completo' })).toBeVisible();
  });

  test('can switch number format to Completo', async ({ page }) => {
    await settingsPage.selectNumberFormat('Completo');
    // The "Completo" radio should be selected (has the primary border)
    const btn = page.getByRole('button', { name: 'Completo' });
    await expect(btn).toHaveClass(/border-\[var\(--color-primary\)\]/, { timeout: 5_000 });
  });

  test('can switch number format back to Abreviado', async ({ page }) => {
    await settingsPage.selectNumberFormat('Completo');
    await settingsPage.selectNumberFormat('Abreviado');
    const btn = page.getByRole('button', { name: 'Abreviado' });
    await expect(btn).toHaveClass(/border-\[var\(--color-primary\)\]/, { timeout: 5_000 });
  });

  test('shows the "Cerrar sesión" logout button', async ({ page }) => {
    await expect(settingsPage.logoutButton).toBeVisible();
  });

});

test.describe('Logout', () => {
  test('user can log out from settings', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.logout();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
