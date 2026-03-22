import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/settings');
    await this.waitForAppReady();
  }

  get logoutButton() {
    return this.page.getByRole('button', { name: 'Cerrar sesión' });
  }

  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL(/\/login/, { timeout: 15_000 });
  }

  /** Select a theme: 'Claro' | 'Oscuro' | 'Automático' */
  async selectTheme(theme: 'Claro' | 'Oscuro' | 'Automático') {
    await this.page.getByRole('button', { name: theme }).click();
  }

  /** Select number format: 'Abreviado' | 'Completo' */
  async selectNumberFormat(format: 'Abreviado' | 'Completo') {
    await this.page.getByRole('button', { name: format }).click();
  }

  /** Verify the currently active theme button is highlighted */
  async expectActiveTheme(theme: 'Claro' | 'Oscuro' | 'Automático') {
    const btn = this.page.getByRole('button', { name: theme });
    // Active theme button has border-[var(--color-primary)] class
    await expect(btn).toHaveClass(/border-\[var\(--color-primary\)\]/);
  }

  /** Verify user email is shown in the profile card */
  async expectEmailVisible(email: string) {
    await expect(this.page.getByText(email)).toBeVisible();
  }

  /** Verify household name is shown */
  async expectHouseholdVisible() {
    await expect(this.page.getByText('Nombre del hogar')).toBeVisible();
  }

  get joinCodeSection() {
    return this.page.getByText('Código de unión');
  }
}
