/**
 * NetWorthView — the body of the net worth page (presentational).
 *
 *   Ver el patrimonio de: (Todo el hogar) (Ana) (Luis) (Sin titular)
 *   ┌ Patrimonio neto · Todo el hogar ─────────────────────────┐
 *   │ +$350M                                                    │
 *   │ Activos  ████████████████████████████████  $500M          │
 *   │ Deudas   ██████████                         $150M          │
 *   │ Las deudas equivalen al 30% de los activos.               │
 *   └───────────────────────────────────────────────────────────┘
 *   ┌ Activos $500M ───────────┐┌ Deudas $150M ──────────────┐
 *   │ ███████|████|██ by type  ││ Hipoteca ██████  $120M      │
 *   │ • Inmueble $400M 80%     ││ Tarjeta  ██       $30M      │
 *   │ lines…                   ││                             │
 *   Por integrante (whole household only)
 *   ┌ Ana +$197M ┐┌ Luis +$200M ┐┌ Sin titular … ┐
 *
 * Color: green = assets, brick red = debts (the theme's positive / negative
 * hues; their colorblind separation is in the 6–8 band, legal only because
 * every bar has its label and value written next to it). Asset types use
 * ASSET_KIND_STYLES. Every bar is decorative.
 *
 * Props only, no hooks beyond i18n and number format: the container
 * (NetWorthPage) owns data and the selected scope, and previews can render
 * this with fixture props.
 */

import { Link } from '@tanstack/react-router';
import { AlertTriangle, ChevronRight, House, Landmark, Scale, UsersRound } from 'lucide-react';
import { ASSET_KINDS, toAssetKind } from '@/domain/asset/Asset';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import type { NetWorthData, WorthGroup, WorthLine, WorthTotals } from '@/application/useNetWorth';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { MemberAvatar } from '@/features/members/components/MemberAvatar';
import { ASSET_KIND_STYLES } from '@/features/assets/assetKinds';

/** Whole household, the records without holders, or one member (by id). */
export type NetWorthScope = 'household' | 'shared' | { memberId: string };

const ASSETS_FILL = 'bg-green-600';
const DEBTS_FILL = 'bg-red-600';

export interface NetWorthViewProps {
  data: NetWorthData;
  scope: NetWorthScope;
  onScopeChange: (scope: NetWorthScope) => void;
}

function sameScope(a: NetWorthScope, b: NetWorthScope): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.memberId === b.memberId;
}

/** Ledger ink: negative amounts in brick, everything else in plum ink. */
function inkFor(value: number) {
  return value < 0 ? 'text-[var(--text-negative)]' : 'text-[var(--text-primary)]';
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function NetWorthView({ data, scope, onScopeChange }: NetWorthViewProps) {
  const { t } = useI18n();
  const hasMembers = data.members.length > 0;
  const isEmpty = data.household.assets.length === 0 && data.household.liabilities.length === 0;

  const memberWorth = typeof scope === 'string' ? null : data.members.find(m => m.member.id === scope.memberId) ?? null;
  const group: WorthGroup = scope === 'shared' ? data.shared : memberWorth?.group ?? data.household;
  const scopeName =
    scope === 'shared' ? t.netWorth.scopeShared : memberWorth?.member.name ?? t.netWorth.scopeHousehold;

  if (isEmpty) return <EmptyState />;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-10 pt-4">
      {hasMembers && (
        <ScopePicker
          members={data.members.map(m => m.member)}
          showShared={data.shared.assets.length + data.shared.liabilities.length > 0}
          scope={scope}
          onScopeChange={onScopeChange}
        />
      )}

      <HeroCard totals={group.totals} scopeName={scopeName} />

      {data.hasMissingTrm && (
        <p className="flex items-start gap-2 rounded-[10px] bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" className="mt-px shrink-0" />
          <span>
            {t.netWorth.missingTrm}{' '}
            <Link to="/income" className="font-semibold underline">{t.home.addTrm}</Link>
          </span>
        </p>
      )}

      {scope === 'shared' && (
        <p className="flex items-center gap-2 px-1 text-sm text-[var(--text-secondary)]">
          <House size={16} aria-hidden="true" className="shrink-0" />
          {t.netWorth.sharedHint}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <AssetsCard group={group} />
        <DebtsCard group={group} />
      </div>

      {hasMembers && scope === 'household' && (
        <section aria-labelledby="networth-members-title" className="flex flex-col gap-3">
          <h2 id="networth-members-title" className="text-2xl font-[760] tracking-[-0.02em] text-[var(--text-primary)]">
            {t.netWorth.byMemberTitle}
          </h2>
          <p className="max-w-prose text-sm leading-relaxed text-[var(--text-secondary)]">{t.netWorth.byMemberHint}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.members.map(({ member, group: memberGroup }) => (
              <li key={member.id} className="flex">
                <PersonCard
                  title={member.name}
                  badge={<MemberAvatar name={member.name} tone={member.tone} size={40} />}
                  totals={memberGroup.totals}
                  onOpen={() => onScopeChange({ memberId: member.id })}
                />
              </li>
            ))}
            {data.shared.assets.length + data.shared.liabilities.length > 0 && (
              <li className="flex">
                <PersonCard
                  title={t.netWorth.scopeShared}
                  subtitle={t.netWorth.sharedHint}
                  badge={
                    <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-[var(--bg-surface-2)] text-[var(--text-secondary)]">
                      <House size={18} />
                    </span>
                  }
                  totals={data.shared.totals}
                  onOpen={() => onScopeChange('shared')}
                />
              </li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Scope picker
// ---------------------------------------------------------------------------

interface ScopePickerProps {
  members: MemberRef[];
  showShared: boolean;
  scope: NetWorthScope;
  onScopeChange: (scope: NetWorthScope) => void;
}

function ScopePicker({ members, showShared, scope, onScopeChange }: ScopePickerProps) {
  const { t } = useI18n();

  const options: { key: string; value: NetWorthScope; label: string; badge: React.ReactNode }[] = [
    {
      key: 'household',
      value: 'household',
      label: t.netWorth.scopeHousehold,
      badge: <UsersRound size={16} aria-hidden="true" />,
    },
    ...members.map(member => ({
      key: member.id,
      value: { memberId: member.id } as NetWorthScope,
      label: member.name,
      badge: <MemberAvatar name={member.name} tone={member.tone} size={24} />,
    })),
    ...(showShared
      ? [{ key: 'shared', value: 'shared' as NetWorthScope, label: t.netWorth.scopeShared, badge: <House size={16} aria-hidden="true" /> }]
      : []),
  ];

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 px-1 text-sm font-semibold text-[var(--text-secondary)]">{t.netWorth.scopeLabel}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const selected = sameScope(option.value, scope);
          return (
            <label
              key={option.key}
              className={cn(
                'inline-flex h-11 max-w-full cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors sm:h-10',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--bg-app)]',
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--border-medium)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)]',
              )}
            >
              <input
                type="radio"
                name="networth-scope"
                checked={selected}
                onChange={() => onScopeChange(option.value)}
                className="sr-only"
              />
              {option.badge}
              <span className="truncate">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Hero: net worth and assets against debts
// ---------------------------------------------------------------------------

function HeroCard({ totals, scopeName }: { totals: WorthTotals; scopeName: string }) {
  const { t } = useI18n();
  const scale = Math.max(totals.assets, totals.liabilities);

  let verdict: string;
  if (totals.assets === 0 && totals.liabilities > 0) verdict = t.netWorth.onlyDebts;
  else if (totals.liabilities === 0) verdict = t.netWorth.noDebtsShort;
  else verdict = t.netWorth.debtRatio(Math.round((totals.debtRatio ?? 0) * 100));

  return (
    <section
      aria-labelledby="networth-hero-title"
      className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-8"
    >
      {/* Soft wash of the two sides behind the figure. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-green-500/10 blur-3xl dark:bg-green-400/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 right-24 size-64 rounded-full bg-red-500/10 blur-3xl dark:bg-red-400/10"
      />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="networth-hero-title" className="text-sm font-semibold text-[var(--text-secondary)]">
              {t.netWorth.netWorthOf(scopeName)}
            </h2>
            <p
              className={cn(
                'mt-1 text-[40px] font-[820] leading-none tracking-[-0.035em] tabular-nums sm:text-[56px] lg:text-[64px]',
                inkFor(totals.netWorth),
              )}
            >
              {totals.netWorth > 0 ? '+' : ''}
              <AbbreviatedAmount value={totals.netWorth} />
            </p>
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">{t.netWorth.formula}</p>
          </div>
          <span
            aria-hidden="true"
            className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-surface-2)] text-[var(--text-secondary)] sm:flex"
          >
            <Scale size={28} strokeWidth={1.75} />
          </span>
        </div>

        <dl className="grid gap-3">
          <ComparisonBar label={t.netWorth.assetsLabel} value={totals.assets} scale={scale} fill={ASSETS_FILL} />
          <ComparisonBar label={t.netWorth.liabilitiesLabel} value={totals.liabilities} scale={scale} fill={DEBTS_FILL} />
        </dl>

        <p className="text-[15px] font-semibold text-[var(--text-primary)] sm:text-base">{verdict}</p>
      </div>
    </section>
  );
}

function ComparisonBar({ label, value, scale, fill }: { label: string; value: number; scale: number; fill: string }) {
  const width = scale > 0 ? Math.max(value > 0 ? 1.5 : 0, (value / scale) * 100) : 0;
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_8rem]">
      <dt className="text-sm font-semibold text-[var(--text-secondary)]">{label}</dt>
      <div aria-hidden="true" className="h-3.5 overflow-hidden rounded-[4px] bg-[var(--bg-surface-2)] sm:h-4">
        <div className={cn('h-full rounded-[4px] transition-[width] duration-500', fill)} style={{ width: `${width}%` }} />
      </div>
      <dd className="text-right text-base font-bold tabular-nums text-[var(--text-primary)] sm:text-lg">
        <AbbreviatedAmount value={value} />
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assets and debts detail
// ---------------------------------------------------------------------------

function DetailCard({ title, total, action, children }: {
  title: string;
  total: number;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xl font-[720] tracking-[-0.01em] text-[var(--text-primary)]">
          {title}{' '}
          <span className="tabular-nums text-[var(--text-secondary)]">
            <AbbreviatedAmount value={total} />
          </span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardLink({ to, label }: { to: '/assets' | '/debts'; label: string }) {
  return (
    <Link to={to} className="inline-flex min-h-10 items-center gap-1 rounded-lg text-sm font-semibold text-[var(--text-brand)] hover:underline">
      {label}
      <ChevronRight size={16} aria-hidden="true" />
    </Link>
  );
}

function ShareNote({ line }: { line: WorthLine }) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();
  if (line.share === line.total) return null;
  return <p className="text-xs text-[var(--text-secondary)]">{t.netWorth.partOf(formatCOP(line.total), line.holderCount)}</p>;
}

function AssetsCard({ group }: { group: WorthGroup }) {
  const { t } = useI18n();
  const total = group.totals.assets;

  const byKind = ASSET_KINDS
    .map(kind => ({
      kind,
      amount: group.assets.filter(line => toAssetKind(line.kind) === kind).reduce((sum, line) => sum + line.share, 0),
    }))
    .filter(entry => entry.amount > 0);

  return (
    <DetailCard title={t.netWorth.assetsLabel} total={total} action={<CardLink to="/assets" label={t.netWorth.manageAssets} />}>
      {group.assets.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">{t.netWorth.noAssets}</p>
      ) : (
        <>
          {byKind.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{t.netWorth.assetsByKind}</h3>
              {/* Segments separated by a 2px gap of card surface. */}
              <div aria-hidden="true" className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]">
                {byKind.map(entry => (
                  <div
                    key={entry.kind}
                    title={`${t.assets.kinds[entry.kind]} · ${pct(entry.amount, total)}%`}
                    className={cn('h-full first:rounded-l-[4px] last:rounded-r-[4px]', ASSET_KIND_STYLES[entry.kind].solid)}
                    style={{ flexGrow: entry.amount, flexBasis: 0, minWidth: 4 }}
                  />
                ))}
              </div>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 min-[420px]:grid-cols-2">
                {byKind.map(entry => (
                  <li key={entry.kind} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', ASSET_KIND_STYLES[entry.kind].solid)} />
                    <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{t.assets.kinds[entry.kind]}</span>
                    <span className="tabular-nums text-[var(--text-secondary)]">{pct(entry.amount, total)}%</span>
                    <span className="w-20 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                      <AbbreviatedAmount value={entry.amount} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
            {group.assets.map(line => {
              const kind = toAssetKind(line.kind);
              const style = ASSET_KIND_STYLES[kind];
              const Icon = style.icon;
              return (
                <li key={line.id} className="flex items-center gap-3 py-3">
                  <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', style.soft)}>
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{line.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{t.assets.kinds[kind]}</p>
                    <ShareNote line={line} />
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                    <AbbreviatedAmount value={line.share} />
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </DetailCard>
  );
}

function DebtsCard({ group }: { group: WorthGroup }) {
  const { t } = useI18n();
  const largest = group.liabilities[0]?.share ?? 0;
  const kinds = t.debts.kinds as Record<string, string>;

  return (
    <DetailCard
      title={t.netWorth.liabilitiesLabel}
      total={group.totals.liabilities}
      action={<CardLink to="/debts" label={t.netWorth.seeDebts} />}
    >
      {group.liabilities.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">{t.netWorth.noDebts}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {group.liabilities.map(line => (
            <li key={line.id} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                  <Landmark size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{line.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{kinds[line.kind] ?? kinds.personal}</p>
                  <ShareNote line={line} />
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                  <AbbreviatedAmount value={line.share} />
                </p>
              </div>
              <div aria-hidden="true" className="ml-12 h-1.5 overflow-hidden rounded-[4px] bg-[var(--bg-surface-2)]">
                <div
                  className={cn('h-full rounded-[4px]', DEBTS_FILL)}
                  style={{ width: `${largest > 0 ? Math.max(2, (line.share / largest) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}

// ---------------------------------------------------------------------------
// Per member
// ---------------------------------------------------------------------------

function PersonCard({ title, subtitle, badge, totals, onOpen }: {
  title: string;
  subtitle?: string;
  badge: React.ReactNode;
  totals: WorthTotals;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const scale = Math.max(totals.assets, totals.liabilities);
  const bar = (value: number) => (scale > 0 ? Math.max(value > 0 ? 2 : 0, (value / scale) * 100) : 0);

  return (
    <article className="flex w-full flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        {badge}
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
      </div>

      <p className={cn('text-[28px] font-[800] leading-none tracking-[-0.03em] tabular-nums', inkFor(totals.netWorth))}>
        {totals.netWorth > 0 ? '+' : ''}
        <AbbreviatedAmount value={totals.netWorth} />
      </p>

      <dl className="grid gap-2 text-sm">
        {[
          { label: t.netWorth.assetsLabel, value: totals.assets, fill: ASSETS_FILL },
          { label: t.netWorth.liabilitiesLabel, value: totals.liabilities, fill: DEBTS_FILL },
        ].map(row => (
          <div key={row.label} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2">
            <dt className="text-[var(--text-secondary)]">{row.label}</dt>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-[4px] bg-[var(--bg-surface-2)]">
              <div className={cn('h-full rounded-[4px]', row.fill)} style={{ width: `${bar(row.value)}%` }} />
            </div>
            <dd className="text-right font-semibold tabular-nums text-[var(--text-primary)]">
              <AbbreviatedAmount value={row.value} />
            </dd>
          </div>
        ))}
      </dl>

      <Button
        variant="outline"
        size="sm"
        className="mt-auto h-11 w-full gap-1 sm:h-9"
        aria-label={t.netWorth.seeDetailAria(title)}
        onClick={onOpen}
      >
        {t.netWorth.seeDetail}
        <ChevronRight size={14} aria-hidden="true" />
      </Button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

function EmptyState() {
  const { t } = useI18n();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-[var(--border-medium)] bg-[var(--bg-surface)] px-6 py-14 text-center">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          <Scale size={26} />
        </span>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t.netWorth.emptyTitle}</h2>
        <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{t.netWorth.emptyBody}</p>
        <Button asChild className="mt-2 h-11 sm:h-10">
          <Link to="/assets">{t.netWorth.addAssets}</Link>
        </Button>
      </section>
    </main>
  );
}
