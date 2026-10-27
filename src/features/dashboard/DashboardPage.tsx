import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { useI18n } from '@/shared/i18n/useI18n';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { getCurrentMonth, getPreviousMonth, nextMonth, makeFullMonthLabel } from './helpers';
import { WIDGETS } from './layout/widgetRegistry';
import { useDashboardEditor } from './layout/useDashboardEditor';
import { DashboardGrid } from './layout/DashboardGrid';
import { WidgetCatalog } from './layout/WidgetCatalog';
import { EditActions, EditHint, UndoToast } from './layout/EditBar';
import { EmptyState } from './EmptyState';
import { DashboardDataProvider } from './DashboardContext';
import { useDashboardLayout } from '@/application/useDashboardLayout';
import type { WidgetId } from '@/domain/dashboard/dashboardLayout';

export function DashboardPage() {
  const { session } = useAuth();
  const { t } = useI18n();
  const [todayMonth] = useState(getCurrentMonth);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);

  const fullMonth = useMemo(() => makeFullMonthLabel(t), [t]);
  const isAtCurrentMonth = selectedMonth >= todayMonth;

  const householdId = session?.householdId ?? null;
  const { layout: savedLayout, isLoading: layoutLoading, save } = useDashboardLayout(
    householdId ?? '',
    session?.userId ?? '',
  );
  const titleOf = useCallback((id: WidgetId) => WIDGETS[id].title(t), [t]);
  const subtitleOf = useCallback((id: WidgetId) => WIDGETS[id].subtitle(t), [t]);
  const accentOf = useCallback((id: WidgetId) => WIDGETS[id].accent, []);
  const editor = useDashboardEditor({ saved: savedLayout, save, titleOf });
  const renderWidget = useCallback(
    (id: WidgetId) => WIDGETS[id].render({ month: selectedMonth, isCurrentMonth: isAtCurrentMonth, householdId, t }),
    [selectedMonth, isAtCurrentMonth, householdId, t],
  );

  const goToPrevMonth = useCallback(
    () => setSelectedMonth(m => getPreviousMonth(m)),
    [],
  );
  const goToNextMonth = useCallback(
    () => setSelectedMonth(m => {
      const next = nextMonth(m);
      return next > todayMonth ? m : next;
    }),
    [todayMonth],
  );

  return (
      <DashboardDataProvider selectedMonth={selectedMonth}>
          <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
              <AppHeader
                  title={t.dashboard.title}
                  maxWidth="max-w-7xl"
                  actions={<EditActions editor={editor} />}
                  // Month navigation: the header's last row, so it sticks with it.
                  toolbar={
                      <>
                      <div className="py-2.5 flex items-center gap-3">
                          <button
                              onClick={goToPrevMonth}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                              aria-label="Mes anterior"
                          >
                              <ChevronLeft size={18} />
                          </button>

                          <div className="flex-1 text-center">
                              <span className="text-base font-bold text-[var(--text-primary)]">
                                  {fullMonth(selectedMonth)}
                              </span>
                              <span className="text-base font-bold text-[var(--text-muted)] ml-2">
                                  {selectedMonth.slice(0, 4)}
                              </span>
                          </div>

                          <button
                              onClick={goToNextMonth}
                              disabled={isAtCurrentMonth}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Mes siguiente"
                          >
                              <ChevronRight size={18} />
                          </button>
                      </div>
                      {editor.editing && <EditHint editor={editor} />}
                      </>
                  }
              />

              <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5 space-y-5">
                  {!layoutLoading && (
                      <DashboardGrid editor={editor} renderWidget={renderWidget} titleOf={titleOf} />
                  )}
                  <EmptyState />
              </main>

              <WidgetCatalog editor={editor} titleOf={titleOf} subtitleOf={subtitleOf} accentOf={accentOf} />
              <UndoToast editor={editor} />

              <AppNav />
          </div>
      </DashboardDataProvider>
  );
}
