/**
 * SyncStatusButton — the sync status chip at the far right of the header.
 *
 * An icon plus words name the state ("Sincronizado", "3 por subir", "Sin
 * conexión"), so the control explains itself. The chip stays neutral while
 * things are fine and takes the attention or problem tint otherwise. It opens
 * the console (passed as children) in a popover whose `open` state the caller
 * owns, so the alert band can open it too.
 */

import type { ReactNode } from 'react';
import type { SyncHealth } from '@/application/useSyncStatus';
import { useI18n } from '@/shared/i18n/useI18n';
import { cn } from '@/shared/ui/cn';
import { Popover, PopoverTrigger } from '@/shared/ui/popover';
import { healthVisual, visibleSyncState, type SyncIcon, type SyncTone } from './syncPresentation';
import { HEALTH_ICONS, SLOW_SPIN } from './syncVisuals';

/** A glass capsule floating on the header bar. */
const NEUTRAL_CHIP = cn(
  'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] shadow-[var(--glass-shadow)] backdrop-blur-md',
  'hover:bg-[var(--glass-bg-hover)] data-[state=open]:bg-[var(--glass-bg-hover)]',
);

const CHIP_TONE: Record<SyncTone, string> = {
  muted: NEUTRAL_CHIP,
  brand: NEUTRAL_CHIP,
  now: cn(
    'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 data-[state=open]:bg-amber-100',
    'dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/60 dark:data-[state=open]:bg-amber-900/60',
  ),
  negative: cn(
    'border-red-300 bg-red-50 text-red-800 hover:bg-red-100 data-[state=open]:bg-red-100',
    'dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-200 dark:hover:bg-red-900/60 dark:data-[state=open]:bg-red-900/60',
  ),
};

/** Icon color in the neutral chip; tinted chips draw the icon in their text color. */
const ICON_TONE: Partial<Record<SyncIcon, string>> = {
  synced: 'text-[var(--text-positive)]',
  syncing: 'text-[var(--text-brand)]',
  offline: 'text-[var(--text-muted)]',
};

interface SyncStatusButtonProps {
  health: Pick<SyncHealth, 'state' | 'alert' | 'pendingCount'>;
  /** Whether the console is open (controlled). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The console: a PopoverContent rendered inside this popover. */
  children: ReactNode;
}

export function SyncStatusButton({ health, open, onOpenChange, children }: SyncStatusButtonProps) {
  const { t } = useI18n();
  const state = visibleSyncState(health);
  const { icon, tone } = healthVisual(state, health.alert?.severity);
  const Icon = HEALTH_ICONS[icon];
  const label = state === 'pending' ? t.sync.statusPending(health.pendingCount) : t.sync.statusNames[state];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // "Sincronización: 3 por subir": the visible words, with what they are about.
          aria-label={t.sync.statusLabel(label.toLowerCase())}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border pl-3 pr-4',
            // A 40px capsule with a 44px tall touch target.
            'relative after:absolute after:inset-x-0 after:-inset-y-0.5',
            'text-sm font-medium leading-none tabular-nums transition-colors',
            CHIP_TONE[tone],
          )}
        >
          <span
            aria-hidden="true"
            className={cn('inline-flex', ICON_TONE[icon], icon === 'syncing' && SLOW_SPIN.className)}
            style={icon === 'syncing' ? SLOW_SPIN.style : undefined}
          >
            <Icon size={18} strokeWidth={2} />
          </span>
          {label}
        </button>
      </PopoverTrigger>
      {children}
    </Popover>
  );
}
