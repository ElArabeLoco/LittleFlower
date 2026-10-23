/**
 * Auth Setup — runs ONCE before all test specs.
 *
 * Logs in to Supabase using E2E_EMAIL + E2E_PASSWORD from .env.e2e.local,
 * then saves the full browser localStorage (Supabase auth token) to
 * e2e/.auth/user.json so every test can reuse it without re-logging in.
 *
 * Setup:
 *   1. Create a dedicated test user in your Supabase project
 *   2. Make sure that user belongs to a household (run through onboarding once)
 *   3. Add E2E_EMAIL + E2E_PASSWORD to .env.e2e.local (gitignored)
 */

import { test as setup, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AUTH_FILE = join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_EMAIL and E2E_PASSWORD must be set in .env.e2e.local\n' +
      'See .env.e2e.example for reference.',
    );
  }

  await page.goto('/login');

  // Fill in login form
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Wait for redirect to home (app fully loaded + household present)
  await page.waitForURL('/', { timeout: 30_000 });
  // The app redirects / → /home after checking auth
  await page.waitForURL(/\/(home|onboarding)/, { timeout: 30_000 });

  // If we landed on onboarding, the test user has no household — abort clearly
  const url = page.url();
  if (url.includes('/onboarding')) {
    throw new Error(
      'E2E test user has no household. ' +
      'Log in manually as this user and complete onboarding first.',
    );
  }

  // Wait for the app shell to render (nav bar = app is ready)
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 20_000 });

  // Persist auth state
  await page.context().storageState({ path: AUTH_FILE });
});
