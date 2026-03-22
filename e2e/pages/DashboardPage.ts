import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.waitForAppReady();
  }

  /** The KPI strip containing balance / income / expense metrics */
  get kpiStrip() {
    return this.page.locator('[class*="grid"][class*="cols"]').first();
  }

  async expectToBeOnDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  /** Wait for the "Sin datos" empty state OR for real chart content */
  async waitForCharts() {
    // Either "no data" message or recharts SVG rendered
    await this.page.waitForSelector('text="Sin datos este mes", svg.recharts-surface', {
      timeout: 15_000,
    });
  }

  /** Recent expenses section heading */
  get recentExpensesHeading() {
    return this.page.getByText('Gastos recientes');
  }
}
