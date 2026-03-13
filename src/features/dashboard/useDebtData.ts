/**
 * Thin adapter — re-exports useDashboardDebtSummary for the dashboard widget.
 * SQL and calculations live in the application layer.
 */
export { useDashboardDebtSummary as useDebtData } from '@/application/useDebtSummary';
