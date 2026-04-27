/** Shared types for YearView and its extracted sub-components. */

export interface CellContextData {
  budgetId: string;
  budgetName: string;
  budgetMonthId: string | null;
  month: string;
  amount: number;
  spentAmount: number;
  isExecuted: boolean;
  /** month < currentMonth */
  isPast: boolean;
  debtId: string | null;
  paymentMode: string;
}

export interface ContextMenuPos {
  x: number;
  y: number;
  source: 'mouse' | 'touch';
}

export interface CtxMenuState {
  pos: ContextMenuPos;
  data: CellContextData;
}

export interface ForwardConfirmState {
  budgetId: string;
  budgetName: string;
  fromMonth: string;
  toMonth: string;
  amount: number;
}
