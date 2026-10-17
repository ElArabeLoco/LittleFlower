/**
 * SyncStatusButton — the round sync icon at the far right of the header.
 *
 * Quiet while everything is up to date; color, a count or a dot appear only
 * when something deserves a look. It opens the console (passed as children)
 * in a popover whose `open` state the caller owns, so the alert band can
 * open it too.
 */

import type { ReactNode } from 'react';
import type { SyncHealth } from '@/application/useSyncStatus';
import { useI18n } from '@/shared/i18n/I18nContext';
import { cn } from '@/shared/ui/cn';
import { Popover, PopoverTrigger } from '@/shared/ui/popover';
import { healthVisual, visibleSyncState } from './syncPresentation';
import { HEALTH_ICONS, SLOW_SPIN, TONE_TEXT } from './syncVisuals';

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
  const stateName = state === 'pending' ? t.sync.pendingChanges(health.pendingCount) : t.sync.statusNames[state];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t.sync.statusLabel(stateName)}
          className={cn(
            'relative -mr-1.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors',
            'hover:bg-[var(--bg-hover)] data-[state=open]:bg-[var(--bg-hover)]',
            TONE_TEXT[tone],
          )}
        >
          <span
            aria-hidden="true"
            className={cn('inline-flex', icon === 'syncing' && SLOW_SPIN.className)}
            style={icon === 'syncing' ? SLOW_SPIN.style : undefined}
          >
            <Icon size={20} strokeWidth={1.9} />
          </span>

          {state === 'pending' && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 top-0 min-w-[18px] rounded-full bg-amber-400 px-1 text-center text-[11px] font-bold leading-[18px] text-amber-950 tabular-nums ring-2 ring-[var(--bg-app)]"
            >
              {health.pendingCount > 99 ? '99+' : health.pendingCount}
            </span>
          )}

          {state === 'error' && (
            <span
              aria-hidden="true"
              className={cn(
                'absolute right-1.5 top-1.5 size-2.5 rounded-full ring-2 ring-[var(--bg-app)]',
                tone === 'now' ? 'bg-amber-400' : 'bg-red-600 dark:bg-red-500',
              )}
            />
          )}
        </button>
      </PopoverTrigger>
      {children}
    </Popover>
  );
}
