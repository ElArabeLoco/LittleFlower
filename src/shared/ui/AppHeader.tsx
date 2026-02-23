/**
 * AppHeader — sticky page header shared across all main pages.
 *
 * Anatomy:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  [emoji] Title                    [right actions]    │
 *   │           subtitle (optional)                        │
 *   └──────────────────────────────────────────────────────┘
 *
 * The SyncPill is no longer rendered here — it lives as a singleton
 * in __root.tsx so it never remounts on page navigation.
 *
 * Usage:
 *   <AppHeader
 *     emoji="📅"
 *     title="Vista Anual"
 *     subtitle="2026"
 *     actions={<Button>...</Button>}
 *   />
 */

import { cn } from './cn';

interface AppHeaderProps {
  /** Single emoji shown as the page icon */
  emoji?: string;
  /** Main page title */
  title: string;
  /** Optional subtitle shown below the title in a smaller style */
  subtitle?: string;
  /** Optional slot for action buttons (e.g. "+ Agregar") rendered to the right */
  actions?: React.ReactNode;
  /** Max-width constraint class for the inner content. Default: 'max-w-2xl'. */
  maxWidth?: string;
}

export function AppHeader({
  emoji,
  title,
  subtitle,
  actions,
  maxWidth = 'max-w-2xl',
}: AppHeaderProps) {
  return (
    <header className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shadow-sm sticky top-0 z-20">
      <div className={cn('mx-auto px-4 h-14 flex items-center gap-3', maxWidth)}>
        {/* Left: emoji + title stack */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {emoji && (
            <span
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center text-base leading-none select-none"
              aria-hidden="true"
            >
              {emoji}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] text-[var(--text-muted)] leading-tight truncate font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions — padded right to avoid overlap with the fixed SyncPill */}
        {actions && (
          <div className="flex items-center gap-2 pr-16 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
