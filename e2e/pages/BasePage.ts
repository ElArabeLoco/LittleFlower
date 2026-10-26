import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Base class for all Page Object Models.
 * Provides shared helpers used across all pages.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /** Wait until the bottom nav bar is visible — confirms the app shell is mounted. */
  async waitForAppReady() {
    await expect(this.page.getByRole('navigation')).toBeVisible({ timeout: 20_000 });
  }

  /** Click a nav tab by its label text. */
  async clickNavTab(label: 'Inicio' | 'Gráficas' | 'Gastos' | 'Finanzas' | 'Perfil') {
    await this.page.getByRole('navigation').getByText(label, { exact: true }).click();
  }

  /** Returns the current pathname. */
  get pathname() {
    return new URL(this.page.url()).pathname;
  }
}
