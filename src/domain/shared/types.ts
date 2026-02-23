/**
 * Shared domain primitives.
 * Zero external dependencies — pure TypeScript types only.
 */

/** 'YYYY-MM' string — identifies a calendar month. */
export type YearMonth = string;

/** ISO8601 datetime string. */
export type ISODateTime = string;

/** Integer COP pesos. No decimals. */
export type COPAmount = number;

/** UUID string (client-generated via crypto.randomUUID()). */
export type EntityId = string;
