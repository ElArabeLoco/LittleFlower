/**
 * AppHeader — sticky page header shared across all main pages.
 *
 * Anatomy:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  [emoji] Title                    [sync pill]        │
 *   │           subtitle (optional)                        │
 *   │                               [right actions]        │
 *   └──────────────────────────────────────────────────────┘
 *
 * The sync pill is always pinned to the top-right of the *viewport*
 * (fixed positioning within the sticky header) so it's consistent
 * regardless of whether the page content is constrained.
 *
 * Usage:
 *   <AppHeader
 *     emoji="📅"
 *     title="Vista Anual"
 *     subtitle="2026"
 *     actions={<Button>...</Button>}
 *   />
 */

import { useStatus } from '@powersync/react';
import { useQuery } from '@powersync/react';
import { AlertCircle, CloudOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import { cn } from './cn';

// ---------------------------------------------------------------------------
// SyncPill — sync status badge, always top-right of viewport
//
// States (priority order):
//   1. !connected            → "Sin conexión"  (grey, WifiOff)
//   2. uploadError           → "Error sync"     (red, AlertCircle)
//   3. uploading             → "Subiendo..."    (blue, Loader2 spin) + queue count
//   4. queue > 0 + connected → "N pendientes"  (amber, CloudOff)
//   5. connected + queue = 0 → "Sync"           (green, Wifi)
// ---------------------------------------------------------------------------

interface CrudCountRow {
  count: number;
}

function SyncPill() {
  const status = useStatus();
  const connected = status.connected;
  const uploading = status.dataFlowStatus?.uploading ?? false;
  const uploadError = status.dataFlowStatus?.uploadError ?? null;

  // Reactive count of pending CRUD entries
  const { data: crudRows = [] } = useQuery<CrudCountRow>(
    'SELECT COUNT(*) as count FROM ps_crud',
    [],
  );
  const pendingCount = crudRows[0]?.count ?? 0;

  // ── Derive display state ──────────────────────────────────────────────────

  let label: string;
  let icon: React.ReactNode;
  let colorClass: string;

  if (!connected) {
    label = 'Sin conexión';
    icon = <WifiOff size={9} strokeWidth={2.5} />;
    colorClass = 'bg-[var(--bg-surface-2)] text-[var(--text-muted)] border-[var(--border-medium)]';
  } else if (uploadError) {
    label = 'Error sync';
    icon = <AlertCircle size={9} strokeWidth={2.5} />;
    colorClass = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800';
  } else if (uploading) {
    label = pendingCount > 0 ? `Subiendo (${pendingCount})` : 'Subiendo...';
    icon = <Loader2 size={9} strokeWidth={2.5} className="animate-spin" />;
    colorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
  } else if (pendingCount > 0) {
    label = `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`;
    icon = <CloudOff size={9} strokeWidth={2.5} />;
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
  } else {
    label = 'Sync';
    icon = <Wifi size={9} strokeWidth={2.5} />;
    colorClass = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
        colorClass,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AppHeader
// ---------------------------------------------------------------------------

interface AppHeaderProps {
  /** Single emoji shown as the page icon */
  emoji?: string;
  /** Main page title */
  title: string;
  /** Optional subtitle shown below the title in a smaller style */
  subtitle?: string;
  /** Optional slot for action buttons (e.g. "+ Agregar") rendered to the right */
  actions?: React.ReactNode;
  /** Max-width constraint class for the inner content. Default: 'max-w-2xl'. Use 'max-w-full' for full-width pages. */
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
      {/* Sync pill — always top-right corner of the viewport, inside the header */}
      <div className="absolute right-3 top-0 bottom-0 flex items-center pointer-events-none">
        <div className="pointer-events-auto">
          <SyncPill />
        </div>
      </div>

      {/* Inner content row */}
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

        {/* Right: actions (buttons, etc.) — padded to avoid overlap with sync pill */}
        {actions && (
          <div className="flex items-center gap-2 pr-16 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
