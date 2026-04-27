/**
 * Currency conversion utilities for the Florecita app.
 *
 * All monetary amounts are integer COP pesos. Only income can be in a
 * foreign currency (USD). These helpers centralise the USD→COP conversion
 * logic so it lives in one place instead of being copy-pasted across hooks.
 */

/**
 * Convert a single amount to COP using the given TRM rate.
 *
 * @param amount  - The monetary amount (integer).
 * @param currency - 'COP' or any other string (treated as USD).
 * @param trm     - USD→COP exchange rate, or null if unavailable.
 * @returns The amount in COP (same value for COP, converted for foreign).
 *          Returns 0 when the currency is foreign and no TRM is available.
 */
export function toCOP(amount: number, currency: string, trm: number | null): number {
  if (currency === 'COP') return amount;
  if (trm) return Math.round(amount * trm);
  return 0;
}

/**
 * Like toCOP but returns whether the TRM was missing for a foreign currency.
 * Useful when the caller needs to flag incomplete data (e.g. missingTrm badge).
 */
export function toCOPWithMissing(
  amount: number,
  currency: string,
  trm: number | null,
): { value: number; missingTrm: boolean } {
  if (currency === 'COP') return { value: amount, missingTrm: false };
  if (trm) return { value: Math.round(amount * trm), missingTrm: false };
  return { value: 0, missingTrm: true };
}

/**
 * Reduce an array of income-like items to their total COP value.
 *
 * Each item provides a default amount, an optional month-specific override,
 * and a currency. Foreign-currency items are converted using the supplied TRM.
 * Items whose currency is foreign and have no TRM contribute 0 to the sum.
 */
export function sumToCOP(
  items: readonly { amount: number; currency: string }[],
  trm: number | null,
): number {
  return items.reduce((sum, item) => sum + toCOP(item.amount, item.currency, trm), 0);
}

/**
 * Reduce income items with per-month overrides to their total COP value.
 *
 * This variant handles the common pattern where each income has a default
 * amount/currency but may be overridden by an IncomeMonth row.
 *
 * @param incomes   - Active income sources for the period.
 * @param overrideFn - Lookup function: given an income, returns the override
 *                     { amount, currency } or undefined to use defaults.
 * @param trm       - USD→COP exchange rate, or null if unavailable.
 */
export function sumIncomesToCOP<T>(
  incomes: readonly T[],
  overrideFn: (inc: T) => { amount: number; currency: string } | undefined,
  defaultFn: (inc: T) => { amount: number; currency: string },
  trm: number | null,
): number {
  return incomes.reduce((sum, inc) => {
    const override = overrideFn(inc);
    const { amount, currency } = override ?? defaultFn(inc);
    return sum + toCOP(amount, currency, trm);
  }, 0);
}
