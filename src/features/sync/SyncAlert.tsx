/**
 * SyncAlert — slim band under the header bar while sync needs a word.
 *
 * Brick for errors, polen for warnings and quiet mist for information. The
 * message says what happened and that the data is safe; the actions say
 * what can be done about it.
 *
 * Announced once: a band that mounts while its alert is fresh slides in and
 * speaks (errors right away, the rest politely). The headers of later pages
 * mount it as a plain labelled region, already in place.
 */

import { useState } from 'react';
import type { SyncAlert as SyncAlertModel } from '@/application/useSyncStatus';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { RetryButton } from './SyncActionButtons';
import { alertKey } from './syncPresentation';
import { ALERT_ICONS } from './syncVisuals';

const BAND_STYLES: Record<SyncAlertModel['severity'], string> = {
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-100',
  info: 'border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]',
};

/** Compact actions drawn in the band's own ink. */
const ACTION_CLASS =
  'h-8 border border-current/25 px-2.5 text-inherit hover:bg-current/10 focus-visible:ring-offset-0';

interface SyncAlertProps {
  alert: SyncAlertModel | null;
  /** Whether the alert is fresh enough to announce (see isAlertFresh). Read when the band mounts. */
  announce: boolean;
  /** Max-width class of the header content, so the band's text lines up with the title. */
  maxWidth?: string;
  onViewDetails: () => void;
  onRetry: () => Promise<void>;
  onSignIn: () => void;
}

export function SyncAlert({ alert, ...props }: SyncAlertProps) {
  if (!alert) return null;
  // A different alert mounts a new band, which decides afresh whether to announce.
  return <AlertBand key={alertKey(alert)} alert={alert} {...props} />;
}

function AlertBand({
  alert,
  announce,
  maxWidth = 'max-w-2xl',
  onViewDetails,
  onRetry,
  onSignIn,
}: SyncAlertProps & { alert: SyncAlertModel }) {
  const { t } = useI18n();
  // Latched when the band mounts: later renders never start or stop an announcement.
  const [live] = useState(announce);

  const Icon = ALERT_ICONS[alert.kind];
  const canRetry = alert.kind === 'upload-rejected' || alert.kind === 'connection';

  return (
    <section
      aria-label={t.sync.title}
      className={cn('border-t', live && 'motion-safe:animate-popover-in', BAND_STYLES[alert.severity])}
    >
      <div className={cn('mx-auto flex items-start gap-2.5 px-4 py-2', maxWidth)}>
        <Icon size={16} strokeWidth={2.25} aria-hidden="true" className="mt-2 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
          <p
            role={live ? (alert.severity === 'error' ? 'alert' : 'status') : undefined}
            className="min-w-0 flex-[1_1_18rem] py-1 text-[13px] font-medium leading-5"
          >
            {t.sync.alerts[alert.kind].banner}
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {alert.kind === 'auth' && (
              <Button type="button" variant="ghost" size="sm" onClick={onSignIn} className={ACTION_CLASS}>
                {t.sync.actions.signIn}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onViewDetails} className={ACTION_CLASS}>
              {t.sync.actions.viewDetails}
            </Button>
            {canRetry && (
              <RetryButton
                variant="ghost"
                withIcon={false}
                onRetry={onRetry}
                label={t.sync.actions.retry}
                className={ACTION_CLASS}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
