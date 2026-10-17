/**
 * AppHeader — sticky page header shared across all main pages.
 *
 * Anatomy:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Title                            [right actions] (☁) │
 *   │  subtitle (optional)                                  │
 *   ├──────────────────────────────────────────────────────┤
 *   │  (!) sync alert band, only while sync needs a word    │
 *   ├──────────────────────────────────────────────────────┤
 *   │  toolbar (optional), e.g. the dashboard month switcher │
 *   └──────────────────────────────────────────────────────┘
 *
 * The header blends with the page background and is separated from the
 * content by a hairline. The title uses the hand-written voice. The sync
 * status button sits at the far right and opens the sync console; the alert
 * band can open the same console, so the open state lives here. Everything,
 * toolbar included, sticks together: a separate sticky bar would need to
 * know the header's height, which the alert band changes.
 *
 * Usage:
 *   <AppHeader
 *     title="Vista Anual"
 *     subtitle="2026"
 *     actions={<Button>...</Button>}
 *   />
 */

import { useState } from 'react';
import { SyncStatusControl, type SyncStatusSlots } from '@/features/sync/SyncStatusControl';
import { cn } from './cn';

const DEFAULT_MAX_WIDTH = 'max-w-2xl';

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
  /** Optional last row, under the sync alert: a full-width surface bar (e.g. a period switcher). */
  toolbar?: React.ReactNode;
}

export function AppHeader(props: AppHeaderProps) {
  const [syncOpen, setSyncOpen] = useState(false);

  return (
    <SyncStatusControl
      open={syncOpen}
      onOpenChange={setSyncOpen}
      maxWidth={props.maxWidth ?? DEFAULT_MAX_WIDTH}
    >
      {(sync) => <AppHeaderView {...props} sync={sync} />}
    </SyncStatusControl>
  );
}

interface AppHeaderViewProps extends AppHeaderProps {
  /** Sync status button (end of the bar) and sync alert band (under the bar). */
  sync?: Partial<SyncStatusSlots>;
}

/** The header's markup with the sync slots filled by the caller (AppHeader, or previews). */
export function AppHeaderView({
  title,
  subtitle,
  actions,
  maxWidth = DEFAULT_MAX_WIDTH,
  compact = false,
  toolbar,
  sync,
}: AppHeaderViewProps) {
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

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}

        {sync?.button}
      </div>

      {sync?.alert}

      {toolbar && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className={cn('mx-auto w-full px-4', maxWidth)}>{toolbar}</div>
        </div>
      )}
    </header>
  );
}
