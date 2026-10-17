/**
 * Sync actions shared by the console and the alert band. Each button keeps
 * its own short-lived state (retrying, copied) and announces the outcome.
 */

import { useEffect, useState } from 'react';
import { Check, Copy, RotateCw } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Button, type ButtonProps } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';

interface ActionButtonProps extends Pick<ButtonProps, 'variant' | 'className'> {
  /** Leading icon; the label alone carries the meaning, so tight rows can drop it. */
  withIcon?: boolean;
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

interface RetryButtonProps extends ActionButtonProps {
  onRetry: () => Promise<void>;
  label: string;
}

export function RetryButton({ onRetry, label, variant = 'outline', className, withIcon = true }: RetryButtonProps) {
  const { t } = useI18n();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      // The sync status reports what went wrong; nothing to add here.
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      // aria-disabled instead of disabled keeps keyboard focus on the button.
      aria-disabled={retrying || undefined}
      onClick={retrying ? undefined : retry}
      className={cn('aria-disabled:cursor-progress aria-disabled:opacity-70', className)}
    >
      {withIcon && (
        <span aria-hidden="true" className={cn('inline-flex', retrying && 'animate-spin')}>
          <RotateCw size={14} />
        </span>
      )}
      {retrying ? t.sync.actions.retrying : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Copy diagnostics
// ---------------------------------------------------------------------------

type CopyResult = 'idle' | 'copied' | 'failed';

const RESULT_VISIBLE_MS = 2500;

interface CopyDiagnosticsButtonProps extends ActionButtonProps {
  /** Writes the diagnostics to the clipboard; rejects when it cannot. */
  onCopy: () => Promise<void>;
}

export function CopyDiagnosticsButton({
  onCopy,
  variant = 'outline',
  className,
  withIcon = true,
}: CopyDiagnosticsButtonProps) {
  const { t } = useI18n();
  const [result, setResult] = useState<CopyResult>('idle');

  useEffect(() => {
    if (result === 'idle') return;
    const timer = setTimeout(() => setResult('idle'), RESULT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [result]);

  async function copy() {
    try {
      await onCopy();
      setResult('copied');
    } catch {
      setResult('failed');
    }
  }

  const label =
    result === 'copied'
      ? t.sync.actions.copied
      : result === 'failed'
        ? t.sync.actions.copyFailed
        : t.sync.actions.copyDiagnostics;

  return (
    <>
      <Button type="button" size="sm" variant={variant} onClick={copy} className={className}>
        {withIcon &&
          (result === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />)}
        {label}
      </Button>
      {/* A changed button label is not announced; this region is. */}
      <span role="status" className="sr-only">
        {result === 'idle' ? '' : label}
      </span>
    </>
  );
}
