---
name: YearView Rich Cell Interactions
description: Patterns and findings from the YearView forwardRef/context-menu/long-press feature review (April 2026)
type: project
---

YearView was refactored to ~1257 lines with forwardRef cells, imperative edit handles, context menus, long-press bottom sheets, and apply-forward mutation.

**Key patterns established:**
- `BudgetTableSection` extracted *outside* `YearView` at module level to prevent remounts — the cell ref Map lives in `YearView` and is passed down as `getCellRef` callback.
- `useImperativeHandle` pattern used for Tab/Enter keyboard navigation between cells: parent calls `ref.current?.startEdit()` with a `setTimeout(0)` delay after `cancelEdit()` to allow React to flush state.
- Long-press cancel threshold: 10px movement in either axis (touchOrigin ref + touchmove handler). Confirmed correct.
- Context menu click-outside uses `mousedown` (not `click`) on document — correct, prevents the originating click from immediately closing the menu.
- Escape dismiss uses `keydown` on document with cleanup — correct.
- Viewport clamping uses fixed hardcoded menuW=240, menuH=220 constants — this is a known approximation that will mis-clamp if the menu grows.

**Known issues found in review:**
- `save()` is called with unhandled `.then()` — errors swallowed silently (no catch).
- `handleMarkExecuted`, `handleRegisterFullPayment`, `applyForward` have no try/catch; mutations can fail silently.
- Three instances of hardcoded Spanish string 'No disponible en meses pasados' at lines 327, 1105, 1196 — not in i18n.
- Two hardcoded Spanish labels 'Presupuestado'/'Ejecutado' in mobile action sheet header (lines 1142, 1149).
- `getCellRef` function recreated every render without `useCallback` — creates new function ref each time `BudgetTableSection` re-renders, but since `BudgetTableSection` is not memoized this is not a perf issue in practice.
- `currentMonth` via `useMemo(getCurrentMonth, [])` — correct pattern for stable snapshot at mount.
- `colSpan={12}` hardcoded in group header rows — will break if months array ever changes length.
- No error boundary or loading state for the 3 new async mutations — Apply Forward especially can write many rows sequentially.
- `ForwardConfirmState.budgetMonthId` is stored but never passed to `applyBudgetMonthAmountForward` — it's unused dead field.
- `onBlur={() => {}}` is an empty no-op on the edit input — the comment explains the intent but there's no actual debounce; relying entirely on `onMouseDown`+`e.preventDefault()` on toolbar buttons to block blur. Works for mouse, but focus-loss from other sources (e.g., browser tab switch) will leave editing=true with no save.
- `buildMonthRange` correctly exported for unit testing; 7 tests cover it well.
- `applyBudgetMonthAmountForward` correctly skips `is_executed === 1` rows. Sequential upserts (not parallel) — intentional for simplicity, acceptable for MVP range.
