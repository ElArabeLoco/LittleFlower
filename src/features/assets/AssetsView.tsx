/**
 * AssetsView — the body of the assets page (presentational).
 *
 *   intro
 *   ┌ Total en activos  $1.2B · 4 activos     Ver patrimonio > ┐
 *   Ahorros · $20M
 *   ┌ [icon] CDT Bancolombia          $20M ┐
 *   │        ↗ Se valorizó +5% desde …     │
 *   │        Ana  Luis  compartido         │
 *   │  [Actualizar valor] [Historial] [Editar] [Eliminar]
 *   Inmueble · …
 *   Cambios de valor (only when some asset has more than one value)
 *   ┌ En total se valorizaron $50M                              ┐
 *   │ Apartamento   De $400M (1 Ene 2025) a $450M (1 Jun 2026)  │
 *   │ ↗ Se valorizó +$50M · +12,5%             [Ver historial]  │
 *
 * Props only, no hooks beyond i18n and number format: the container
 * (AssetsPage) owns data and dialog state, and previews can render this
 * with fixture props.
 */

import { Link } from '@tanstack/react-router';
import { AlertTriangle, ChevronRight, History, Pencil, Plus, RefreshCw, Trash2, Wallet } from 'lucide-react';
import { ASSET_KINDS } from '@/domain/asset/Asset';
import type { AssetItem } from '@/application/useAssets';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { useI18n } from '@/shared/i18n/useI18n';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { HolderChips } from '@/features/members/components/HolderChips';
import { ASSET_KIND_STYLES } from './assetKinds';
import { useValuationFormat } from './valuationFormat';
import { ValueChangeBadge } from './ValueChangeBadge';

export interface AssetsViewProps {
  assets: AssetItem[];
  totalCOP: number;
  hasMissingTrm: boolean;
  /** Assets with more than one value: the value changes report. */
  changedAssets: AssetItem[];
  /** Sum of their changes in COP. */
  totalChangeCOP: number;
  /** Whether the household has any active member. */
  hasMembers: boolean;
  onAdd: () => void;
  onEdit: (asset: AssetItem) => void;
  onDelete: (asset: AssetItem) => void;
  onUpdateValue: (asset: AssetItem) => void;
  onShowHistory: (asset: AssetItem) => void;
}

export function AssetsView({
  assets,
  totalCOP,
  hasMissingTrm,
  changedAssets,
  totalChangeCOP,
  hasMembers,
  onAdd,
  onEdit,
  onDelete,
  onUpdateValue,
  onShowHistory,
}: AssetsViewProps) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();

  const groups = ASSET_KINDS
    .map(kind => {
      const items = assets.filter(asset => asset.kind === kind);
      return { kind, items, total: items.reduce((sum, asset) => sum + asset.valueCOP, 0) };
    })
    .filter(group => group.items.length > 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
      <p className="max-w-prose text-[15px] leading-relaxed text-[var(--text-secondary)]">{t.assets.intro}</p>

      {assets.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-[var(--border-medium)] bg-[var(--bg-surface)] px-6 py-14 text-center">
          <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
            <Wallet size={26} />
          </span>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t.assets.emptyTitle}</h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{t.assets.emptyBody}</p>
          <Button className="mt-2 h-11 gap-1.5 sm:h-10" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />
            {t.assets.addLong}
          </Button>
        </section>
      ) : (
        <>
          <section className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">{t.assets.totalLabel}</p>
              <p className="mt-1 text-[32px] font-[820] leading-none tracking-[-0.03em] tabular-nums text-[var(--text-primary)] sm:text-[40px]">
                <AbbreviatedAmount value={totalCOP} />
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{t.assets.count(assets.length)}</p>
            </div>
            <Link
              to="/net-worth"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-[var(--text-brand)] hover:underline"
            >
              {t.assets.seeNetWorth}
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </section>

          {hasMissingTrm && <MissingTrmNotice />}

          {groups.map(group => (
            <section key={group.kind} aria-labelledby={`assets-${group.kind}`} className="space-y-3">
              <h2 id={`assets-${group.kind}`} className="flex flex-wrap items-baseline gap-x-2 px-1 text-sm font-semibold text-[var(--text-secondary)]">
                <span className="text-base text-[var(--text-primary)]">{t.assets.kinds[group.kind]}</span>
                <span className="tabular-nums">{formatCOP(group.total)}</span>
              </h2>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {group.items.map(asset => (
                  <li key={asset.id}>
                    <AssetCard
                      asset={asset}
                      hasMembers={hasMembers}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onUpdateValue={onUpdateValue}
                      onShowHistory={onShowHistory}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {changedAssets.length > 0 && (
            <ValueChangesReport assets={changedAssets} totalChangeCOP={totalChangeCOP} onShowHistory={onShowHistory} />
          )}
        </>
      )}
    </main>
  );
}

function MissingTrmNotice() {
  const { t } = useI18n();
  return (
    <p className="flex items-start gap-2 rounded-[10px] bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" className="mt-px shrink-0" />
      <span>
        {t.assets.missingTrmNotice}{' '}
        <Link to="/income" className="font-semibold underline">{t.home.addTrm}</Link>
      </span>
    </p>
  );
}

interface ValueChangesReportProps {
  assets: AssetItem[];
  totalChangeCOP: number;
  onShowHistory: (asset: AssetItem) => void;
}

/** First value against the current one, for every asset with more than one value. */
function ValueChangesReport({ assets, totalChangeCOP, onShowHistory }: ValueChangesReportProps) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();
  const { money, date } = useValuationFormat();
  const total =
    totalChangeCOP > 0
      ? t.assets.report.totalUp(formatCOP(totalChangeCOP))
      : totalChangeCOP < 0
        ? t.assets.report.totalDown(formatCOP(-totalChangeCOP))
        : t.assets.report.totalFlat;

  return (
    <section aria-labelledby="assets-value-changes" className="space-y-3">
      <div className="px-1">
        <h2 id="assets-value-changes" className="text-xl font-[760] tracking-[-0.02em] text-[var(--text-primary)]">
          {t.assets.report.title}
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-[var(--text-secondary)]">{t.assets.report.hint}</p>
      </div>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <p className="border-b border-[var(--border-subtle)] px-4 py-3 text-base font-semibold tabular-nums text-[var(--text-primary)]">
          {total}
        </p>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {assets.map(asset => {
            const change = asset.change!;
            return (
              <li key={asset.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-[var(--text-primary)]">{asset.name}</span>
                    <span className="text-sm text-[var(--text-secondary)]">
                      {t.assets.kinds[asset.kind]} · {t.assets.report.valuesCount(asset.history.length)}
                    </span>
                  </p>
                  <p className="text-sm tabular-nums text-[var(--text-secondary)]">
                    {t.assets.report.fromTo(
                      money(change.from.value, change.from.currency),
                      date(change.from.valuedOn),
                      money(change.to.value, change.to.currency),
                      date(change.to.valuedOn),
                    )}
                  </p>
                  <ValueChangeBadge change={change} since={false} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 gap-1.5 self-start sm:h-9 sm:self-auto"
                  aria-label={t.assets.historyAria(asset.name)}
                  onClick={() => onShowHistory(asset)}
                >
                  <History size={14} aria-hidden="true" />
                  {t.assets.report.seeHistory}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

interface AssetCardProps {
  asset: AssetItem;
  hasMembers: boolean;
  onEdit: (asset: AssetItem) => void;
  onDelete: (asset: AssetItem) => void;
  onUpdateValue: (asset: AssetItem) => void;
  onShowHistory: (asset: AssetItem) => void;
}

function AssetCard({ asset, hasMembers, onEdit, onDelete, onUpdateValue, onShowHistory }: AssetCardProps) {
  const { t } = useI18n();
  const { formatCOP, formatUSD } = useNumberFormat();
  const style = ASSET_KIND_STYLES[asset.kind];
  const Icon = style.icon;
  const isUSD = asset.currency === 'USD';

  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', style.soft)}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{asset.name}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{t.assets.kinds[asset.kind]}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold tabular-nums text-[var(--text-primary)]">
            {isUSD ? formatUSD(asset.value) : formatCOP(asset.value)}
          </p>
          {isUSD && (
            <p className="text-xs tabular-nums text-[var(--text-secondary)]">
              {asset.missingTrm ? t.assets.missingTrm : t.assets.approxCOP(formatCOP(asset.valueCOP))}
            </p>
          )}
        </div>
      </div>

      {asset.change && <ValueChangeBadge change={asset.change} compact />}

      <HolderChips holders={asset.holders} hasMembers={hasMembers} subject="asset" />

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-1.5 sm:h-9"
          aria-label={t.assets.updateValueAria(asset.name)}
          onClick={() => onUpdateValue(asset)}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t.assets.updateValueAction}
        </Button>
        {asset.history.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="h-11 gap-1.5 sm:h-9"
            aria-label={t.assets.historyAria(asset.name)}
            onClick={() => onShowHistory(asset)}
          >
            <History size={14} aria-hidden="true" />
            {t.assets.historyAction}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-1.5 sm:h-9"
          aria-label={t.assets.editAria(asset.name)}
          onClick={() => onEdit(asset)}
        >
          <Pencil size={14} aria-hidden="true" />
          {t.assets.editAction}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-1.5 text-[var(--text-negative)] sm:h-9"
          aria-label={t.assets.deleteAria(asset.name)}
          onClick={() => onDelete(asset)}
        >
          <Trash2 size={14} aria-hidden="true" />
          {t.assets.deleteAction}
        </Button>
      </div>
    </article>
  );
}
