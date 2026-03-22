import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for LittleFlower.
 *
 * Architecture:
 *   1. "setup" project logs in once and saves localStorage to e2e/.auth/user.json
 *   2. All spec projects reuse that saved auth state — no re-login per test
 *   3. Tests run against the local Vite dev server (already has COOP/COEP headers
 *      required for PowerSync WASM + SharedArrayBuffer)
 *
 * Required env vars (in .env.e2e.local, never committed):
 *   E2E_EMAIL      — email of the dedicated E2E test user in Supabase
 *   E2E_PASSWORD   — password for that user
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests in parallel — each worker gets its own browser context */
  fullyParallel: false, // Keep serial for now: PowerSync local SQLite is shared
  workers: 1,

  /* Retry on CI to handle transient flakiness */
  retries: process.env.CI ? 1 : 0,

  /* Reporters */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',

    /* Force Spanish locale so navigator.language === 'es-CO' → app uses Spanish UI */
    locale: 'es-CO',

    /* Capture traces / screenshots on failure */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',

    /* Longer timeout — WASM init + PowerSync can take ~3s */
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  /* Global test timeout */
  timeout: 60_000,
  expect: { timeout: 15_000 },

  projects: [
    /* ── Step 1: auth setup ────────────────────────────────────────────────── */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    /* ── Step 2: authenticated specs (require E2E_EMAIL + E2E_PASSWORD) ───── */
    {
      name: 'authenticated',
      testMatch: /tests\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        /* Re-use saved auth: restores Supabase localStorage token */
        storageState: 'e2e/.auth/user.json',
      },
    },

    /* ── No-auth project: login form & redirect tests (no credentials needed) */
    {
      name: 'no-auth',
      testMatch: /tests\/auth\/login\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],

  /* Spin up the Vite dev server before running tests */
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
