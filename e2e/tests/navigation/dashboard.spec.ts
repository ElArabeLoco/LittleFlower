/**
 * Dashboard Tests
 *
 * Verify the dashboard renders correctly: KPI strip, charts, recent expenses.
 */

import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('Dashboard (/dashboard)', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
  });

  test('loads the dashboard without errors', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).not.toContainText('Error inesperado');
  });

  test('shows the bottom navigation bar', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('shows Dashboard as active nav tab', async ({ page }) => {
    const dashText = page.getByRole('navigation').getByText('Dashboard');
    await expect(dashText).toBeVisible();
  });

  test('shows "Gastos recientes" section', async ({ page }) => {
    await expect(dashboard.recentExpensesHeading).toBeVisible({ timeout: 15_000 });
  });

  test('shows balance-related text in KPI area', async ({ page }) => {
    // KPI strip shows one of: "Balance real", "Disponible", "Presupuestado", "Ejecutado"
    await expect(
      page.getByText('Balance real')
        .or(page.getByText('Disponible'))
        .or(page.getByText('Presupuestado'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows charts or empty state — no unhandled crash', async ({ page }) => {
    // Either charts render or the "no data" empty state shows
    const hasCharts = await page.locator('svg.recharts-surface').count() > 0;
    const hasEmptyState = await page.getByText('Aún no hay datos').isVisible().catch(() => false);

    // At least one of these should be true
    expect(hasCharts || hasEmptyState).toBe(true);
  });

  test('shows "Tendencia" section heading for 6-month chart', async ({ page }) => {
    await expect(
      page.getByText('Tendencia de los últimos 6 meses')
        .or(page.getByText('Presupuestado vs. gastado real'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
