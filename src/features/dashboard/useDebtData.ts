/**
 * Thin adapter — reads debt data from DashboardContext for dashboard widget components.
 * SQL and calculations live in the application layer; the context runs the queries once.
 */
export { useDashboardCtx as useDebtData } from './useDashboardCtx';
