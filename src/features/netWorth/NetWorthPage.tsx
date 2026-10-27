/**
 * NetWorthPage — /net-worth
 *
 * Container: reads the net worth through the application hook and owns the
 * selected scope (whole household, one member or the records without
 * holders). All markup lives in NetWorthView.
 */

import { useState } from 'react';
import { useNetWorth } from '@/application/useNetWorth';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNav } from '@/shared/ui/AppNav';
import { useI18n } from '@/shared/i18n/useI18n';
import { NetWorthView, type NetWorthScope } from './NetWorthView';

export function NetWorthPage() {
  const { t } = useI18n();
  const data = useNetWorth();
  const [selected, setSelected] = useState<NetWorthScope>('household');

  // A member deleted elsewhere while selected: back to the whole household.
  const scope: NetWorthScope =
    typeof selected === 'object' && !data.members.some(m => m.member.id === selected.memberId)
      ? 'household'
      : selected;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)] text-[var(--text-primary)]">
      <AppHeader title={t.netWorth.title} subtitle={t.netWorth.subtitle} maxWidth="max-w-6xl" />
      <NetWorthView data={data} scope={scope} onScopeChange={setSelected} />
      <AppNav />
    </div>
  );
}
