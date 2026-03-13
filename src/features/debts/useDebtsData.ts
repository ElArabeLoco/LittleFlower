/**
 * Thin adapter — re-exports useDebtManagementSummary for the debt management page.
 * SQL and calculations live in the application layer.
 */
export { useDebtManagementSummary as useDebtsData } from '@/application/useDebtSummary';
export type { DebtManagementSummary } from '@/application/useDebtSummary';
