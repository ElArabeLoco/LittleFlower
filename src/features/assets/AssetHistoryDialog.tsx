/**
 * AssetHistoryDialog — every value an asset has had.
 *
 *   Historial de valor · Apartamento
 *   ↗ Se valorizó +$50M · +12,5%  desde el 1 Ene 2025
 *   Evolución del valor   (line, one point per recorded value)
 *   [+ Actualizar valor]
 *   Valores registrados   (newest first: date, value, change vs. previous,
 *                          note, [Eliminar])
 *
 * The chart uses a time axis, so points sit at their real distance in time.
 * Single series: the title names it, no legend. The list below is the same
 * data as a table, so nothing depends on the chart alone.
 *
 * Presentational: the container owns the asset and the delete action.
 */

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import type { AssetHistoryEntry, AssetItem } from '@/application/useAssets';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useI18n } from '@/shared/i18n/useI18n';
import { formatK } from '@/features/dashboard/helpers';
import { useValuationFormat } from './valuationFormat';
import { ValueChangeBadge } from './ValueChangeBadge';

export interface AssetHistoryDialogProps {
  /** The asset whose history is shown; null = closed. */
  asset: AssetItem | null;
  onClose: () => void;
  onUpdateValue: (asset: AssetItem) => void;
  onDeleteValue: (asset: AssetItem, entry: AssetHistoryEntry) => void;
}

export function AssetHistoryDialog({ asset, onClose, onUpdateValue, onDeleteValue }: AssetHistoryDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={asset !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {asset && (
          <>
            <DialogHeader>
              <DialogTitle>{t.assets.history.title(asset.name)}</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-5">
              {asset.change && <ValueChangeBadge change={asset.change} />}
              {asset.history.length > 1 && <HistoryChart asset={asset} />}
              <Button variant="outline" className="h-11 w-full gap-1.5 sm:h-10" onClick={() => onUpdateValue(asset)}>
                <Plus size={16} aria-hidden="true" />
                {t.assets.updateValueAction}
              </Button>
              <HistoryList asset={asset} onDelete={entry => onDeleteValue(asset, entry)} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Midday UTC of a YYYY-MM-DD date: a stable x position whatever the time zone. */
function toTime(valuedOn: string): number {
  return Date.parse(`${valuedOn}T12:00:00Z`);
}

function fromTime(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function HistoryChart({ asset }: { asset: AssetItem }) {
  const { t } = useI18n();
  const { money, date } = useValuationFormat();
  const data = asset.history
    .filter(entry => entry.inCurrent !== null)
    .map(entry => ({ time: toTime(entry.valuedOn), value: entry.inCurrent as number }));
  if (data.length < 2) return null;

  return (
    <section aria-labelledby={`history-chart-${asset.id}`} className="space-y-2">
      <div>
        <h3 id={`history-chart-${asset.id}`} className="text-sm font-semibold text-[var(--text-primary)]">
          {t.assets.history.chartTitle}
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">{t.assets.history.chartHint}</p>
      </div>
      {/* currentColor: the line and its points follow the theme's green in light and dark. */}
      <div className="text-green-600 dark:text-green-400" aria-hidden="true">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={time => date(fromTime(time))}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={formatK}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              width={56}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = active ? payload?.[0]?.payload as { time: number; value: number } | undefined : undefined;
                if (!point) return null;
                return (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold text-[var(--text-primary)]">{date(fromTime(point.time))}</p>
                    <p className="tabular-nums text-[var(--text-secondary)]">{money(point.value, asset.currency)}</p>
                  </div>
                );
              }}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke="currentColor"
              strokeWidth={2}
              dot={{ r: 4, fill: 'currentColor', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'currentColor', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function HistoryList({ asset, onDelete }: { asset: AssetItem; onDelete: (entry: AssetHistoryEntry) => void }) {
  const { t } = useI18n();
  const { money, signedMoney, date } = useValuationFormat();
  const newestFirst = [...asset.history].reverse();
  const canDelete = asset.history.length > 1;

  return (
    <section aria-labelledby={`history-list-${asset.id}`} className="space-y-2">
      <h3 id={`history-list-${asset.id}`} className="text-sm font-semibold text-[var(--text-primary)]">
        {t.assets.history.listTitle}
      </h3>
      <ol className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
        {newestFirst.map((entry, i) => {
          const isCurrent = i === 0;
          const isFirst = i === newestFirst.length - 1;
          return (
            <li key={entry.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold tabular-nums text-[var(--text-primary)]">{money(entry.value, entry.currency)}</span>
                  <span className="text-sm text-[var(--text-secondary)]">{date(entry.valuedOn)}</span>
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {[
                    isCurrent && t.assets.history.current,
                    isFirst && newestFirst.length > 1 && t.assets.history.first,
                    entry.fromPrevious !== null && t.assets.history.vsPrevious(signedMoney(entry.fromPrevious, asset.currency)),
                    entry.currency !== asset.currency && t.assets.history.otherCurrency,
                  ].filter(Boolean).join(' · ')}
                </p>
                {entry.note && <p className="mt-0.5 text-sm text-[var(--text-primary)]">{entry.note}</p>}
              </div>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 shrink-0 gap-1.5 text-[var(--text-negative)] sm:h-9"
                  aria-label={t.assets.history.deleteAria(date(entry.valuedOn))}
                  onClick={() => onDelete(entry)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {t.assets.history.deleteAction}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      {!canDelete && <p className="text-xs text-[var(--text-secondary)]">{t.assets.history.onlyOne}</p>}
    </section>
  );
}
