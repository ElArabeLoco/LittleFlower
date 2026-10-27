/**
 * SectionTiles — every place in the app, each with one live line about it.
 * Two columns on phones, four from `md`.
 */

import { Link, type LinkProps } from '@tanstack/react-router';
import {
  ArrowLeftRight, CalendarDays, ChartColumn, Landmark, ListChecks, Sheet, SlidersHorizontal, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@/shared/i18n/useI18n';
import { cn } from '@/shared/ui/cn';

const TONE = {
  petal: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  iris: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  leaf: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  polen: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  mist: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
} as const;

export interface SectionLines {
  month: string;
  income: string;
  budgets: string;
  debts: string;
}

interface Tile {
  to: NonNullable<LinkProps['to']>;
  icon: LucideIcon;
  tone: keyof typeof TONE;
  title: string;
  line: string;
}

export function SectionTiles({ lines }: { lines: SectionLines }) {
  const { t } = useI18n();

  const tiles: Tile[] = [
    { to: '/month', icon: CalendarDays, tone: 'petal', title: t.monthView.title, line: lines.month },
    { to: '/anual', icon: Sheet, tone: 'iris', title: t.yearView.title, line: t.home.yearLine },
    { to: '/dashboard', icon: ChartColumn, tone: 'sky', title: t.nav.dashboard, line: t.home.dashboardLine },
    { to: '/income', icon: TrendingUp, tone: 'leaf', title: t.finances.incomeTitle, line: lines.income },
    { to: '/settings/budgets', icon: ListChecks, tone: 'petal', title: t.finances.budgetsTitle, line: lines.budgets },
    { to: '/debts', icon: Landmark, tone: 'polen', title: t.finances.debtsTitle, line: lines.debts },
    { to: '/transactions', icon: ArrowLeftRight, tone: 'iris', title: t.transactions.title, line: t.home.transactionsLine },
    { to: '/settings', icon: SlidersHorizontal, tone: 'mist', title: t.home.profileTitle, line: t.home.profileLine },
  ];

  return (
    <section aria-labelledby="home-sections-title" className="flex flex-col gap-4">
      <h2 id="home-sections-title" className="text-2xl font-[760] tracking-[-0.02em]">{t.home.sectionsTitle}</h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <li key={tile.to} className="flex">
              <Link
                to={tile.to}
                className={cn(
                  'flex w-full flex-col gap-3 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5',
                  'transition-colors hover:border-[var(--border-cell)] hover:bg-[var(--bg-hover-solid)]',
                  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)]',
                )}
              >
                <span className={cn('grid size-10 place-items-center rounded-xl sm:size-11', TONE[tile.tone])}>
                  <Icon size={21} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-[720] leading-tight text-[var(--text-primary)] sm:text-[17px]">
                    {tile.title}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-[var(--text-secondary)] sm:text-sm">
                    {tile.line}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
