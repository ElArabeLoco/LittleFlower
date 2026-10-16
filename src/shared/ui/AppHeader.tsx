/**
 * AppHeader — sticky page header shared across all main pages.
 *
 * Anatomy:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Title                                [right actions] │
 *   │  subtitle (optional)                                  │
 *   └──────────────────────────────────────────────────────┘
 *
 * The header blends with the page background and is separated from the
 * content by a hairline. The title uses the hand-written voice.
 *
 * The SyncPill is no longer rendered here — it lives as a singleton
 * in __root.tsx so it never remounts on page navigation.
 *
 * Usage:
 *   <AppHeader
 *     title="Vista Anual"
 *     subtitle="2026"
 *     actions={<Button>...</Button>}
 *   />
 */

import { cn } from './cn';

interface AppHeaderProps {
  /** Main page title */
  title: string;
  /** Optional subtitle shown below the title in a smaller style */
  subtitle?: string;
  /** Optional slot for action buttons (e.g. "+ Agregar") rendered to the right */
  actions?: React.ReactNode;
  /** Max-width constraint class for the inner content. Default: 'max-w-2xl'. */
  maxWidth?: string;
  /** Use compact height (h-12 instead of min-h-16) for data-dense pages. */
  compact?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  actions,
  maxWidth = 'max-w-2xl',
  compact = false,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-app)] pt-[env(safe-area-inset-top)]">
      <div className={cn('mx-auto flex items-center gap-3 px-4', compact ? 'h-12' : 'min-h-16', maxWidth)}>
        <div className="min-w-0 flex-1">
          {/* Size first: tailwind-merge drops a `leading-*` that precedes a `text-*` size. */}
          <h1
            className={cn(
              'truncate font-hand font-[650] tracking-[-0.01em] text-[var(--text-primary)]',
              compact ? 'text-lg' : 'text-[22px] sm:text-2xl',
              'leading-tight',
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className={cn('truncate text-[var(--text-muted)]', compact ? 'text-xs' : 'text-[13px]', 'leading-snug')}>
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          // Right padding keeps actions clear of the floating SyncPill rendered in __root.tsx.
          // Drop it once the sync status lives inside the header.
          <div className="flex shrink-0 items-center gap-2 pr-16">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
