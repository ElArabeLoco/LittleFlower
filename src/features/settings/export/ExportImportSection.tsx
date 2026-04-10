import { useRef, useState } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';
import { exportToLF, exportToXLSX } from './exportService';
import { importFromLF } from './importService';

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  loading: boolean;
  loadingLabel: string;
  onClick: () => void;
  variant?: 'default' | 'import';
}

function ActionRow({ icon, label, sublabel, loading, loadingLabel, onClick, variant = 'default' }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-all',
        'hover:bg-[var(--bg-hover)] disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'import' && 'text-[var(--text-brand)]',
      )}
    >
      <span className={cn(
        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
        variant === 'import'
          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
          : 'bg-[var(--bg-surface-2)] text-[var(--text-muted)]',
      )}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          variant === 'import' ? 'text-[var(--color-primary)]' : 'text-[var(--text-primary)]',
        )}>
          {loading ? loadingLabel : label}
        </p>
        {sublabel && !loading && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{sublabel}</p>
        )}
      </div>
      {!loading && (
        <span className="flex-shrink-0 text-[var(--text-muted)]">
          {variant === 'import' ? <Upload size={15} /> : <Download size={15} />}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Feedback toast (inline, auto-dismiss)
// ---------------------------------------------------------------------------

type FeedbackState =
  | { type: 'success'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string }
  | null;

// ---------------------------------------------------------------------------
// ExportImportSection
// ---------------------------------------------------------------------------

interface ExportImportSectionProps {
  householdId: string;
}

type ExportKey = 'lf' | 'excel' | 'numbers';

export function ExportImportSection({ householdId }: ExportImportSectionProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState<ExportKey | 'import' | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  function showFeedback(f: FeedbackState) {
    setFeedback(f);
    setTimeout(() => setFeedback(null), 4000);
  }

  async function handleExport(key: ExportKey) {
    if (loading) return;
    setLoading(key);
    try {
      if (key === 'lf') {
        await exportToLF(householdId);
      } else {
        await exportToXLSX(householdId, key === 'excel' ? 'excel' : 'numbers');
      }
      showFeedback({ type: 'success', message: t.settings.exportSuccess });
    } catch (err) {
      showFeedback({ type: 'error', message: t.settings.importErrorGeneric });
      console.error('[export]', err);
    } finally {
      setLoading(null);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    if (!file.name.endsWith('.lf')) {
      showFeedback({ type: 'error', message: t.settings.importErrorInvalidFormat });
      return;
    }

    setLoading('import');
    try {
      const result = await importFromLF(file, householdId);

      if (result.errors.includes('invalid_format') || result.errors.includes('invalid_json')) {
        showFeedback({ type: 'error', message: t.settings.importErrorInvalidFormat });
        return;
      }

      const hasDiffHousehold = result.errors.includes('different_household');
      const otherErrors = result.errors.filter(e => e !== 'different_household');

      if (otherErrors.length > 0) {
        showFeedback({ type: 'error', message: t.settings.importErrorGeneric });
        return;
      }

      if (hasDiffHousehold) {
        showFeedback({ type: 'warning', message: t.settings.importDifferentHousehold });
      } else {
        showFeedback({
          type: 'success',
          message: t.settings.importSuccess(result.imported, result.skipped),
        });
      }
    } catch (err) {
      showFeedback({ type: 'error', message: t.settings.importErrorGeneric });
      console.error('[import]', err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      <ActionRow
        icon={<FileJson size={16} />}
        label={t.settings.exportLF}
        sublabel="Respaldo completo · importable"
        loading={loading === 'lf'}
        loadingLabel={t.settings.exporting}
        onClick={() => handleExport('lf')}
      />
      <ActionRow
        icon={<FileSpreadsheet size={16} />}
        label={t.settings.exportExcel}
        sublabel="5 hojas · abre en Excel"
        loading={loading === 'excel'}
        loadingLabel={t.settings.exporting}
        onClick={() => handleExport('excel')}
      />
      <ActionRow
        icon={<FileSpreadsheet size={16} />}
        label={t.settings.exportNumbers}
        sublabel="5 hojas · abre en Numbers"
        loading={loading === 'numbers'}
        loadingLabel={t.settings.exporting}
        onClick={() => handleExport('numbers')}
      />
      <ActionRow
        icon={<Upload size={16} />}
        label={t.settings.importLF}
        sublabel="Solo archivos .lf de Florecita"
        loading={loading === 'import'}
        loadingLabel={t.settings.importing}
        onClick={() => fileInputRef.current?.click()}
        variant="import"
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".lf"
        className="hidden"
        onChange={handleImport}
      />

      {/* Inline feedback */}
      {feedback && (
        <div className={cn(
          'flex items-start gap-2 px-4 py-3 text-sm',
          feedback.type === 'success' && 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30',
          feedback.type === 'warning' && 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
          feedback.type === 'error' && 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
        )}>
          {feedback.type === 'success' && <Check size={15} className="mt-0.5 flex-shrink-0" />}
          {(feedback.type === 'warning' || feedback.type === 'error') && (
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          )}
          <p>{feedback.message}</p>
        </div>
      )}
    </div>
  );
}
