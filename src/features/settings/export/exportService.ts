/**
 * exportService — client-side data export for LittleFlower.
 *
 * All data lives in the local PowerSync SQLite DB (db.getAll), so export
 * works 100% offline with no backend required.
 *
 * Three formats:
 *   - .lf   — Florecita proprietary JSON (full fidelity, importable)
 *   - .xlsx  — Excel / Numbers (6 sheets: Gastos, Ingresos, Deudas, Activos, Detalle, TRM);
 *             Ingresos, Deudas and Activos list the holders (Titulares) of each record
 */

import { db } from '@/infrastructure/powersync/client';
import type { HoldableType } from '@/domain/member/holders';
import type { FlorecitaExport } from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Format "2025-01" → "Ene-25" */
function fmtMonth(m: string): string {
  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const [y, mo] = m.split('-');
  return `${MONTHS[parseInt(mo) - 1]}-${y.slice(2)}`;
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

/** Spreadsheet text for an income / debt / asset without holders. */
const HOUSEHOLD_HOLDERS = 'Hogar';

/**
 * Active holder names per income, debt or asset id, alphabetical. Holders of deleted
 * members are left out, like everywhere else in the app. Backups made before
 * members existed simply have none.
 */
function holderNamesBySubject(data: FlorecitaExport, type: HoldableType): Map<string, string[]> {
  const activeMembers = new Map<string, string>(
    (data.household_members ?? [])
      .filter(m => !m.deleted_at)
      .map(m => [m.id as string, m.name as string]),
  );

  const result = new Map<string, string[]>();
  for (const h of data.holders ?? []) {
    if (h.subject_type !== type) continue;
    const name = activeMembers.get(h.member_id as string);
    if (name === undefined) continue;
    const subjectId = h.subject_id as string;
    result.set(subjectId, [...(result.get(subjectId) ?? []), name]);
  }
  for (const names of result.values()) names.sort((a, b) => a.localeCompare(b));
  return result;
}

function holdersText(names: string[] | undefined): string {
  return names && names.length > 0 ? names.join(', ') : HOUSEHOLD_HOLDERS;
}

// ---------------------------------------------------------------------------
// Query all tables
// ---------------------------------------------------------------------------

async function queryAllData(householdId: string): Promise<FlorecitaExport> {
  const [
    households,
    users,
    budgets,
    budget_months,
    expenses,
    incomes,
    income_months,
    exchange_rates,
    debts,
    debt_transactions,
    household_members,
    holders,
    assets,
  ] = await Promise.all([
    db.getAll('SELECT * FROM households WHERE id = ?', [householdId]),
    db.getAll('SELECT * FROM users WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM budgets WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM budget_months WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM expenses WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM incomes WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM income_months WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM exchange_rates WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM debts WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM debt_transactions WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM household_members WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM holders WHERE household_id = ?', [householdId]),
    db.getAll('SELECT * FROM assets WHERE household_id = ?', [householdId]),
  ]);

  return {
    _format: 'florecita-backup',
    _v: 1,
    _exported_at: new Date().toISOString(),
    _app_version: __APP_VERSION__,
    _household_id: householdId,
    households: households as Record<string, unknown>[],
    users: users as Record<string, unknown>[],
    budgets: budgets as Record<string, unknown>[],
    budget_months: budget_months as Record<string, unknown>[],
    expenses: expenses as Record<string, unknown>[],
    incomes: incomes as Record<string, unknown>[],
    income_months: income_months as Record<string, unknown>[],
    exchange_rates: exchange_rates as Record<string, unknown>[],
    debts: debts as Record<string, unknown>[],
    debt_transactions: debt_transactions as Record<string, unknown>[],
    household_members: household_members as Record<string, unknown>[],
    holders: holders as Record<string, unknown>[],
    assets: assets as Record<string, unknown>[],
  };
}

// ---------------------------------------------------------------------------
// Export to .lf (Florecita JSON)
// ---------------------------------------------------------------------------

export async function exportToLF(householdId: string): Promise<void> {
  const data = await queryAllData(householdId);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, `florecita-${today()}.lf`);
}

// ---------------------------------------------------------------------------
// XLSX sheet builders
// ---------------------------------------------------------------------------

type Row = (string | number | null)[];

/** Sheet 1 — Gastos: two stacked grids (Presupuestado / Ejecutado) */
function buildGastosSheet(data: FlorecitaExport): Row[] {
  const activeBudgets = (data.budgets as Record<string, unknown>[])
    .filter(b => !b.deleted_at)
    .sort((a, b) => {
      // CC / dual first, then alphabetical
      const modeOrder = (m: unknown) => m === 'credit_card' ? 0 : m === 'both' ? 1 : 2;
      const modeA = modeOrder(a.payment_mode);
      const modeB = modeOrder(b.payment_mode);
      if (modeA !== modeB) return modeA - modeB;
      return String(a.name).localeCompare(String(b.name));
    });

  const allMonths = [...new Set(
    (data.budget_months as Record<string, unknown>[]).map(bm => bm.month as string)
  )].sort();

  // bmMap: budgetId → month → { id, amount }
  const bmMap = new Map<string, Map<string, { id: string; amount: number }>>();
  for (const bm of data.budget_months as Record<string, unknown>[]) {
    const bid = bm.budget_id as string;
    if (!bmMap.has(bid)) bmMap.set(bid, new Map());
    bmMap.get(bid)!.set(bm.month as string, { id: bm.id as string, amount: num(bm.amount) });
  }

  // spentMap: budgetMonthId → total spent (positive, non-deleted)
  const spentMap = new Map<string, number>();
  for (const e of data.expenses as Record<string, unknown>[]) {
    if (e.deleted_at) continue;
    const bmId = e.budget_month_id as string;
    const amt = num(e.amount);
    spentMap.set(bmId, (spentMap.get(bmId) ?? 0) + amt);
  }

  const header: Row = ['Presupuesto', 'Tipo', ...allMonths.map(fmtMonth), 'TOTAL'];

  function buildSection(title: string, getValue: (budgetId: string, month: string) => number): Row[] {
    const section: Row[] = [
      [title, ...Array(allMonths.length + 2).fill('')],
      header,
    ];
    const colTotals = Array(allMonths.length).fill(0) as number[];

    for (const b of activeBudgets) {
      const tipo = b.payment_mode === 'credit_card' ? 'TC' : b.payment_mode === 'both' ? 'Dual' : 'Efectivo';
      const row: Row = [b.name as string, tipo];
      let rowTotal = 0;
      allMonths.forEach((month, i) => {
        const val = getValue(b.id as string, month);
        row.push(val || null);
        rowTotal += val;
        colTotals[i] += val;
      });
      row.push(rowTotal || null);
      section.push(row);
    }

    const totalRow: Row = ['TOTAL', '', ...colTotals.map(v => v || null), colTotals.reduce((a, b) => a + b, 0) || null];
    section.push(totalRow);
    return section;
  }

  const presupSection = buildSection('PRESUPUESTADO', (bid, month) => {
    const bm = bmMap.get(bid)?.get(month);
    return bm?.amount ?? 0;
  });

  const ejecutadoSection = buildSection('EJECUTADO', (bid, month) => {
    const bm = bmMap.get(bid)?.get(month);
    if (!bm) return 0;
    return Math.max(0, spentMap.get(bm.id) ?? 0);
  });

  return [...presupSection, [], ...ejecutadoSection];
}

/** Sheet 2 — Ingresos: income sources × months grid */
export function buildIngresosSheet(data: FlorecitaExport): Row[] {
  const holdersByIncome = holderNamesBySubject(data, 'income');

  const activeIncomes = (data.incomes as Record<string, unknown>[])
    .filter(i => !i.deleted_at)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const allMonths = [...new Set(
    (data.income_months as Record<string, unknown>[]).map(im => im.month as string)
  )].sort();

  // imMap: incomeId → month → real_amount
  const imMap = new Map<string, Map<string, number>>();
  for (const im of data.income_months as Record<string, unknown>[]) {
    const iid = im.income_id as string;
    if (!imMap.has(iid)) imMap.set(iid, new Map());
    imMap.get(iid)!.set(im.month as string, num(im.real_amount));
  }

  const result: Row[] = [
    ['INGRESOS MENSUALES', ...Array(allMonths.length + 3).fill('')],
    ['Fuente', 'Titulares', 'Moneda', ...allMonths.map(fmtMonth), 'TOTAL'],
  ];

  const colTotals = Array(allMonths.length).fill(0) as number[];

  for (const inc of activeIncomes) {
    const row: Row = [
      inc.name as string,
      holdersText(holdersByIncome.get(inc.id as string)),
      inc.currency as string,
    ];
    let rowTotal = 0;
    allMonths.forEach((month, i) => {
      const val = imMap.get(inc.id as string)?.get(month) ?? 0;
      row.push(val || null);
      rowTotal += val;
      colTotals[i] += val;
    });
    row.push(rowTotal || null);
    result.push(row);
  }

  result.push(['TOTAL', '', '', ...colTotals.map(v => v || null), colTotals.reduce((a, b) => a + b, 0) || null]);
  return result;
}

/** Sheet 3 — Deudas: one mini-table per debt with running balance */
export function buildDeudasSheet(data: FlorecitaExport): Row[] {
  const holdersByDebt = holderNamesBySubject(data, 'debt');
  const activeDebts = (data.debts as Record<string, unknown>[])
    .filter(d => !d.deleted_at)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const txByDebt = new Map<string, Record<string, unknown>[]>();
  for (const tx of data.debt_transactions as Record<string, unknown>[]) {
    if (tx.deleted_at) continue;
    const did = tx.debt_id as string;
    if (!txByDebt.has(did)) txByDebt.set(did, []);
    txByDebt.get(did)!.push(tx);
  }

  const rows: Row[] = [];

  for (const debt of activeDebts) {
    const txs = (txByDebt.get(debt.id as string) ?? [])
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // Debt header
    rows.push([
      `DEUDA: ${debt.name}`,
      `Original: ${num(debt.initial_amount).toLocaleString('es-CO')} ${debt.currency}`,
      `Desembolso: ${debt.disbursed_at}`,
      debt.description ? `Nota: ${debt.description}` : null,
      `Titulares: ${holdersText(holdersByDebt.get(debt.id as string))}`,
    ]);

    rows.push(['Fecha', 'Tipo', 'Monto COP', 'Monto Original', 'Moneda', 'TRM', 'Nota', 'Saldo acumulado']);

    let balance = num(debt.initial_amount);
    for (const tx of txs) {
      const type = tx.type === 'debit' ? 'Abono' : 'Aumento';
      const amount = num(tx.amount);
      balance = tx.type === 'debit' ? balance - amount : balance + amount;
      rows.push([
        tx.date as string,
        type,
        amount,
        tx.original_amount as number | null ?? null,
        tx.original_currency as string | null ?? null,
        tx.exchange_rate as number | null ?? null,
        tx.note as string | null ?? null,
        balance,
      ]);
    }

    rows.push(['Saldo actual:', null, null, null, null, null, null, balance]);
    // Spacer between debts
    rows.push([]);
    rows.push([]);
  }

  if (rows.length === 0) {
    rows.push(['Sin deudas registradas']);
  }

  return rows;
}

/** Spreadsheet name of each asset kind (the app's Spanish labels). */
const ASSET_KIND_LABELS: Record<string, string> = {
  savings: 'Ahorros',
  investment: 'Inversión',
  real_estate: 'Inmueble',
  vehicle: 'Vehículo',
  other: 'Otro',
};

/** Sheet 4 — Activos: one row per active asset, at its current value */
export function buildActivosSheet(data: FlorecitaExport): Row[] {
  const holdersByAsset = holderNamesBySubject(data, 'asset');
  const activeAssets = (data.assets ?? [])
    .filter(a => !a.deleted_at)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const rows: Row[] = [
    ['ACTIVOS', '', '', '', ''],
    ['Nombre', 'Tipo', 'Valor', 'Moneda', 'Titulares'],
  ];

  for (const asset of activeAssets) {
    rows.push([
      asset.name as string,
      ASSET_KIND_LABELS[asset.kind as string] ?? ASSET_KIND_LABELS.other,
      num(asset.value),
      (asset.currency as string) ?? 'COP',
      holdersText(holdersByAsset.get(asset.id as string)),
    ]);
  }

  if (activeAssets.length === 0) rows.push(['Sin activos registrados']);

  return rows;
}

/** Sheet 5 — Detalle Gastos: flat expense ledger */
function buildDetalleGastosSheet(data: FlorecitaExport): Row[] {
  const budgetMap = new Map<string, string>(
    (data.budgets as Record<string, unknown>[]).map(b => [b.id as string, b.name as string])
  );
  const userMap = new Map<string, string>(
    (data.users as Record<string, unknown>[]).map(u => [u.id as string, (u.name ?? u.email) as string])
  );

  const rows: Row[] = [
    ['DETALLE DE GASTOS', '', '', '', '', ''],
    ['Fecha', 'Presupuesto', 'Monto (COP)', 'Nota', 'Registrado por', 'Es reversión'],
  ];

  const sortedExpenses = (data.expenses as Record<string, unknown>[])
    .filter(e => !e.deleted_at)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  for (const e of sortedExpenses) {
    rows.push([
      (e.timestamp as string).split('T')[0],
      budgetMap.get(e.budget_id as string) ?? (e.budget_id as string),
      num(e.amount),
      e.note as string | null ?? null,
      userMap.get(e.recorded_by as string) ?? (e.recorded_by as string),
      e.linked_expense_id ? 'Sí' : 'No',
    ]);
  }

  return rows;
}

/** Sheet 6 — TRM: exchange rates by month */
function buildTRMSheet(data: FlorecitaExport): Row[] {
  const rows: Row[] = [
    ['TIPOS DE CAMBIO (TRM)', '', '', '', ''],
    ['Mes', 'De', 'A', 'Tasa', 'Fuente'],
  ];

  const sorted = (data.exchange_rates as Record<string, unknown>[])
    .sort((a, b) => String(b.month).localeCompare(String(a.month)));

  for (const er of sorted) {
    rows.push([
      er.month as string,
      er.from_currency as string,
      er.to_currency as string,
      num(er.rate),
      er.source as string,
    ]);
  }

  if (sorted.length === 0) rows.push(['Sin tipos de cambio registrados']);

  return rows;
}

// ---------------------------------------------------------------------------
// Export to .xlsx
// ---------------------------------------------------------------------------

export async function exportToXLSX(
  householdId: string,
  variant: 'excel' | 'numbers',
): Promise<void> {
  // Dynamic import to avoid bloating the initial bundle
  const { utils, write } = await import('xlsx');

  const data = await queryAllData(householdId);

  const wb = utils.book_new();

  const sheets: { name: string; data: Row[] }[] = [
    { name: 'Gastos', data: buildGastosSheet(data) },
    { name: 'Ingresos', data: buildIngresosSheet(data) },
    { name: 'Deudas', data: buildDeudasSheet(data) },
    { name: 'Activos', data: buildActivosSheet(data) },
    { name: 'Detalle Gastos', data: buildDetalleGastosSheet(data) },
    { name: 'TRM', data: buildTRMSheet(data) },
  ];

  for (const { name, data: sheetData } of sheets) {
    const ws = utils.aoa_to_sheet(sheetData);
    utils.book_append_sheet(wb, ws, name);
  }

  const buffer = write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const suffix = variant === 'numbers' ? 'numbers' : 'excel';
  triggerDownload(blob, `florecita-${suffix}-${today()}.xlsx`);
}
