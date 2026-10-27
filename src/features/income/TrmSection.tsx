import { useState } from 'react';
import { TrendingUp, AlertTriangle, Check } from 'lucide-react';
import { useI18n } from '@/shared/i18n/useI18n';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/ui/cn';
import { useExchangeRateMutations } from '@/application/useExchangeRateMutations';
import type { ExchangeRateRow } from './types';

interface TrmSectionProps {
  month: string;
  householdId: string;
  userId: string;
  exchangeRate: ExchangeRateRow | null;
}

export function TrmSection({ month, householdId, userId, exchangeRate }: TrmSectionProps) {
  const { t } = useI18n();
  const { formatNumber } = useNumberFormat();
  const { upsertExchangeRate } = useExchangeRateMutations(householdId, userId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setValue(exchangeRate ? String(exchangeRate.rate) : '');
    setEditing(true);
  }

  async function handleSave() {
    const parsed = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) { setEditing(false); return; }
    setSaving(true);
    try {
      await upsertExchangeRate({
        id: exchangeRate?.id,
        from_currency: 'USD',
        to_currency: 'COP',
        month,
        rate: parsed,
        source: 'manual',
      });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  const hasTrm = exchangeRate !== null;

  return (
    <div className={cn('rounded-xl border p-4',
      hasTrm ? 'bg-[var(--bg-surface)] border-[var(--border-subtle)] shadow-sm' : 'bg-amber-50 border-amber-200')}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          {hasTrm
            ? <TrendingUp size={15} className="text-violet-500" />
            : <AlertTriangle size={15} className="text-amber-500" />}
          <span className="text-sm font-semibold text-gray-700">{t.income.trmTitle}</span>
          {hasTrm && exchangeRate.source === 'fallback' && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              {t.income.trmEstimated}
            </span>
          )}
        </div>

        {editing ? (
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Input
              className="h-8 w-36 text-sm text-right"
              inputMode="decimal"
              placeholder="ej: 4200"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
            <button onClick={handleSave} disabled={saving}
              className="shrink-0 p-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="shrink-0 text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1 justify-end">
            {hasTrm ? (
              <span className="text-base font-bold text-gray-800 tabular-nums">{formatNumber(exchangeRate.rate)}</span>
            ) : (
              <span className="text-xs text-amber-700">{t.income.noTrm}</span>
            )}
            <button onClick={startEdit}
              className="shrink-0 text-xs font-medium text-pink-600 hover:text-pink-700 hover:underline cursor-pointer">
              {hasTrm ? t.income.trmEdit : t.income.trmEnter}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
