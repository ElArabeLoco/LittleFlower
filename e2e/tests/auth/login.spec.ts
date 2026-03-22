/**
 * Auth Tests
 *
 * Cover the login / logout flow.
 *
 * The "Login page" group tests public behavior (no credentials needed).
 * The "Authenticated: logout flow" group needs saved auth state.
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Login page', () => {
  test('shows the login form at /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('nobody@invalid.test', 'wrongpassword');

    await expect(page.locator('p.text-red-600')).toBeVisible({ timeout: 15_000 });
    // Still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects unauthenticated user from /dashboard to /login', async ({ page }) => {
    // Fresh context (no auth) → protected route should redirect
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/(login|)$/, { timeout: 15_000 });
  });

  test('redirects unauthenticated user from /settings to /login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/(login|)$/, { timeout: 15_000 });
  });

  test('redirects unauthenticated user from /income to /login', async ({ page }) => {
    await page.goto('/income');
    await expect(page).toHaveURL(/\/(login|)$/, { timeout: 15_000 });
  });

  test('can switch between login and register mode', async ({ page }) => {
    await page.goto('/login');
    // Switch to register
    await page.getByRole('button', { name: 'Regístrate' }).click();
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeVisible();
    // Switch back
    await page.getByRole('button', { name: 'Inicia sesión' }).click();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('shows "LittleFlower" branding on login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('LittleFlower')).toBeVisible();
    await expect(page.getByText('Tu presupuesto familiar')).toBeVisible();
  });

  test('email field rejects non-email input via HTML5 validation', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('not-an-email');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    // HTML5 email validation prevents submission — still on login page
    await expect(page).toHaveURL(/\/login/);
  });
});

