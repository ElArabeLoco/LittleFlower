/**
 * Thin adapter — re-exports useIncomeSummary for the income management page.
 * SQL and calculations live in the application layer.
 */
export { useIncomeSummary as useIncomeData } from '@/application/useIncomeSummary';
export type { IncomeSummary } from '@/application/useIncomeSummary';
