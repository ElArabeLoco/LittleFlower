/**
 * The bottom navigation's tabs and the paths each one owns.
 *
 *   Inicio    → /home
 *   Gráficas  → /dashboard
 *   Gastos    → /month   (Mes · Año switch, plus the month's list of expenses)
 *   Finanzas  → /finances (Patrimonio, Ingresos, Partidas, Deudas, Activos)
 *   Perfil    → /settings (with the household's members)
 */

export type NavTabKey = 'home' | 'dashboard' | 'spending' | 'finances' | 'profile';

export type NavPath = '/home' | '/dashboard' | '/month' | '/finances' | '/settings';

export interface NavTabDef {
  key: NavTabKey;
  to: NavPath;
  /** Paths, and everything under them, that mark this tab as the current one. */
  match: string[];
}

export const NAV_TABS: NavTabDef[] = [
  { key: 'home', to: '/home', match: ['/home'] },
  { key: 'dashboard', to: '/dashboard', match: ['/dashboard'] },
  { key: 'spending', to: '/month', match: ['/month', '/anual', '/transactions', '/budget'] },
  { key: 'finances', to: '/finances', match: ['/finances', '/net-worth', '/income', '/settings/budgets', '/debts', '/assets'] },
  { key: 'profile', to: '/settings', match: ['/members'] },
];

/** The tab that owns `pathname`, or null outside the app's sections. */
export function activeNavTab(pathname: string): NavTabKey | null {
  // /settings/budgets belongs to Finanzas, so Perfil owns /settings only by exact match.
  if (pathname === '/settings' || pathname === '/settings/') return 'profile';
  const tab = NAV_TABS.find(({ match }) => match.some(m => pathname === m || pathname.startsWith(m + '/')));
  return tab?.key ?? null;
}
