import { describe, expect, it } from 'vitest';
import { activeNavTab } from './navTabs';

describe('activeNavTab', () => {
  it.each([
    ['/home', 'home'],
    ['/dashboard', 'dashboard'],
    ['/month', 'spending'],
    ['/anual', 'spending'],
    ['/transactions', 'spending'],
    ['/budget', 'spending'],
    ['/finances', 'finances'],
    ['/net-worth', 'finances'],
    ['/income', 'finances'],
    ['/settings/budgets', 'finances'],
    ['/debts', 'finances'],
    ['/debts/abc-123', 'finances'],
    ['/assets', 'finances'],
    ['/settings', 'profile'],
    ['/settings/', 'profile'],
    ['/members', 'profile'],
  ])('%s highlights the %s tab', (pathname, tab) => {
    expect(activeNavTab(pathname)).toBe(tab);
  });

  it('highlights no tab outside the app sections', () => {
    expect(activeNavTab('/login')).toBeNull();
  });

  it('does not match a path that only shares a prefix', () => {
    expect(activeNavTab('/monthly')).toBeNull();
  });
});
