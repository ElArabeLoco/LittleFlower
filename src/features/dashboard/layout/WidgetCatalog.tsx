import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  WIDGET_GROUP,
  WIDGET_GROUPS,
  WIDGET_IDS,
  type WidgetId,
} from '@/domain/dashboard/dashboardLayout';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Dialog, DialogOverlay, DialogPortal } from '@/shared/ui/dialog';
import type { DashboardEditor } from './useDashboardEditor';

/** The fixed widget catalog: a drawer on the right, a bottom sheet on phones. */
export function WidgetCatalog({ editor, titleOf, subtitleOf, accentOf }: {
  editor: DashboardEditor;
  titleOf: (id: WidgetId) => string;
  subtitleOf: (id: WidgetId) => string;
  accentOf: (id: WidgetId) => string;
}) {
  const { t } = useI18n();
  const copy = t.dashboardLayout;
  const shown = new Set(editor.layout.map(item => item.id));

  return (
    <Dialog open={editor.catalogOpen} onOpenChange={editor.setCatalogOpen}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="dash-catalog">
          <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 pb-3.5 pt-5">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-lg font-extrabold text-[var(--text-primary)]">
                {copy.catalogTitle}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-[var(--text-secondary)]">
                {copy.catalogCount(shown.size, WIDGET_IDS.length)}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="dash-key">{copy.close}</DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-1">
            {WIDGET_GROUPS.map(group => (
              <section key={group} aria-label={copy.groups[group]}>
                <h3 className="mb-1 mt-5 text-xs font-extrabold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  {copy.groups[group]}
                </h3>
                {WIDGET_IDS.filter(id => WIDGET_GROUP[id] === group).map(id => (
                  <div key={id} className="flex items-center gap-3 border-b border-[var(--border-subtle)] py-3">
                    <span
                      aria-hidden="true"
                      className="dash-well flex h-[34px] w-10 shrink-0 items-end justify-center gap-[3px] rounded-[9px] p-[7px]"
                    >
                      {[45, 90, 65].map(height => (
                        <span key={height} className="w-[5px] rounded-sm" style={{ height: `${height}%`, background: accentOf(id) }} />
                      ))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[var(--text-primary)]">{titleOf(id)}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitleOf(id)}</p>
                    </div>
                    {shown.has(id) ? (
                      <span className="shrink-0 text-xs font-bold text-[var(--text-positive)]">{copy.inDashboard}</span>
                    ) : (
                      <button
                        type="button"
                        className="dash-key shrink-0 text-[var(--text-brand)]"
                        aria-label={copy.addLabel(titleOf(id))}
                        onClick={() => editor.add(id)}
                      >
                        {copy.add}
                      </button>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
