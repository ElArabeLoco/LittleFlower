import { LayoutDashboard, Plus } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import type { DashboardEditor } from './useDashboardEditor';

/** Header actions: «Personalizar» in view mode; «Agregar» and «Listo» in edit mode. */
export function EditActions({ editor }: { editor: DashboardEditor }) {
  const { t } = useI18n();
  const copy = t.dashboardLayout;
  if (!editor.editing) {
    return (
      <button type="button" className="dash-key" onClick={() => editor.setEditing(true)}>
        <LayoutDashboard size={15} aria-hidden="true" />
        {copy.customize}
      </button>
    );
  }
  return (
    <>
      <button type="button" className="dash-key" onClick={editor.openCatalog}>
        <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
        {copy.add}
      </button>
      <button type="button" className="dash-key dash-key-primary" onClick={() => editor.setEditing(false)}>
        {copy.done}
      </button>
    </>
  );
}

/** Under the month switcher in edit mode: what the mode does, and «Restablecer». */
export function EditHint({ editor }: { editor: DashboardEditor }) {
  const { t } = useI18n();
  const copy = t.dashboardLayout;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pb-2.5">
      <span className="dash-chip">
        <span aria-hidden="true" />
        {copy.editing}
      </span>
      <span className="min-w-0 flex-1 text-xs text-[var(--text-secondary)]">
        <span className="max-sm:hidden">{copy.hint}</span>
        <span className="sm:hidden">{copy.hintPhone}</span>
      </span>
      <button type="button" className="dash-ghost" onClick={editor.reset}>
        {copy.reset}
      </button>
    </div>
  );
}

/** «Quitaste…», «Agregaste…», «Volviste al diseño original.» with «Deshacer». */
export function UndoToast({ editor }: { editor: DashboardEditor }) {
  const { t } = useI18n();
  const toast = editor.toast;
  if (!toast) return null;
  return (
    <div key={toast.key} className="dash-toast" role="status">
      <span>{toast.text}</span>
      {toast.undo && (
        <button type="button" className="dash-toast-undo" onClick={editor.undo}>
          {t.dashboardLayout.undo}
        </button>
      )}
    </div>
  );
}
