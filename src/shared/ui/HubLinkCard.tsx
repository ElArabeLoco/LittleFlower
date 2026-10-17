/**
 * HubLinkCard — navigation card for the hub pages (/budget, /finances).
 *
 * Anatomy:
 *   ┌─────────────────────────────────────────┐
 *   │  [icon]  Title                        > │  row 1
 *   │          Description that may wrap      │  row 2
 *   │          over several lines.            │
 *   └─────────────────────────────────────────┘
 *
 * The card spans two rows of its parent grid and adopts them through CSS
 * subgrid, so titles and descriptions of sibling cards share the same rows
 * and stay aligned whatever the copy length or language. Render it as a
 * direct child of a grid, e.g. `grid grid-cols-1 sm:grid-cols-2 gap-4`.
 *
 * Usage:
 *   <HubLinkCard to="/month" title="Vista Mensual" description="…" icon={CalendarDays} tone="petal" />
 */

import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type HubLinkCardTone = 'petal' | 'iris' | 'leaf' | 'polen';

// Each light/dark pair keeps the icon above 3:1 against the card surface.
const TONE_ICON_CLASS: Record<HubLinkCardTone, string> = {
  petal: 'text-pink-600 dark:text-pink-300',
  iris: 'text-violet-600 dark:text-violet-300',
  leaf: 'text-green-700 dark:text-green-300',
  polen: 'text-amber-700 dark:text-amber-300',
};

export interface HubLinkCardProps {
  /** Destination route, checked against the registered router. */
  to: NonNullable<LinkProps['to']>;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: HubLinkCardTone;
}

export function HubLinkCard({ to, title, description, icon: Icon, tone }: HubLinkCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group row-span-2 grid grid-cols-[auto_1fr] grid-rows-subgrid gap-x-4 gap-y-1.5',
        'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6',
        'transition-colors hover:border-[var(--border-strong)]',
        // `outline-hidden` keeps a transparent outline that forced-colors mode paints.
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)]',
      )}
    >
      <Icon
        size={26}
        strokeWidth={1.75}
        aria-hidden="true"
        className={cn('row-span-2 self-start', TONE_ICON_CLASS[tone])}
      />

      <div className="flex min-w-0 items-start justify-between gap-3">
        <h2 className="font-hand text-xl font-[650] leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
          {title}
        </h2>
        <ChevronRight
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-brand)]"
        />
      </div>

      <p className="min-w-0 text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
    </Link>
  );
}
