/**
 * IncomePage — /income
 *
 * Muestra las fuentes de ingreso del mes seleccionado.
 * Permite editar el monto real de cada fuente por mes.
 * Si hay ingresos en USD, muestra la sección TRM para convertirlos a COP.
 */

import { useState } from 'react';
import { useQuery } from '@powersync/react';
import {
  ChevronLeft, ChevronRight, Plus, Pencil,
  Trash2, TrendingUp, AlertTriangle, Check,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/ui/cn';
import {
  insertIncome,
  updateIncome,
  deleteIncome,
  upsertIncomeMonth,
  upsertExchangeRate,
} from '@/infrastructure/powersync/mutationWrappers';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  if (mo === 12) return `${y + 1}-01`;
  return `${y}-${String(mo + 1).padStart(2, '0')}`;
}

function formatMonth(m: string): string {
  const [y, mo] = m.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IncomeRow {
  id: string;
  name: string;
  person: string;
  is_fixed: number;
  category: string;
  default_amount: number;
  currency: string;
  start_month: string;
  end_month: string | null;
}

interface IncomeMonthRow {
  id: string;
  income_id: string;
  real_amount: number;
  currency: string;
  note: string | null;
  base_salary: number;
  deductions: number;
  extra_days: number;
}

interface ExchangeRateRow {
  id: string;
  rate: number;
  source: string;
}

const INCOME_CATEGORIES = ['Salario', 'Renta', 'Otro'] as const;
const CURRENCIES = ['COP', 'USD'] as const;

// ---------------------------------------------------------------------------
// IncomeFormDialog — create or edit an income source
// ---------------------------------------------------------------------------

interface IncomeFormState {
  name: string;
  category: string;
  default_amount: string;
  currency: string;
  is_fixed: boolean;
  start_month: string;
  end_month: string; // '' = no end date
}

const defaultIncomeForm = (): IncomeFormState => ({
  name: '',
  category: 'Salario',
  default_amount: '0',
  currency: 'COP',
  is_fixed: true,
  start_month: getCurrentMonth(),
  end_month: '',
});

interface IncomeFormDialogProps {
  mode: 'create' | 'edit';
  initial?: IncomeFormState;
  incomeId?: string;
  householdId: string;
  userId: string;
  onDone: () => void;
  trigger: React.ReactNode;
  defaultOpen?: boolean;
}

function IncomeFormDialog({ mode, initial, incomeId, householdId, userId, onDone, trigger, defaultOpen = false }: IncomeFormDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState<IncomeFormState>(initial ?? defaultIncomeForm());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof IncomeFormState>(key: K, value: IncomeFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setForm(initial ?? defaultIncomeForm());
    } else {
      onDone();  // notify parent when dialog closes (covers cancel + outside-click)
    }
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    const amount = parseInt(form.default_amount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 0) { setError('Monto inválido'); return; }

    setIsLoading(true);
    try {
      if (mode === 'create') {
        await insertIncome({
          household_id: householdId,
          name: form.name.trim(),
          person: userId,
          is_fixed: form.is_fixed,
          category: form.category,
          default_amount: amount,
          currency: form.currency,
          start_month: form.start_month,
          end_month: form.end_month || null,
          created_by: userId,
        });
      } else if (mode === 'edit' && incomeId) {
        await updateIncome(incomeId, {
          name: form.name.trim(),
          default_amount: amount,
          currency: form.currency,
          is_fixed: form.is_fixed,
          category: form.category,
          end_month: form.end_month || null,
        });
      }
      setOpen(false);  // triggers handleOpenChange(false) → onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nueva fuente de ingreso' : 'Editar ingreso'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="inc-name">Nombre *</Label>
            <Input id="inc-name" placeholder="Ej: Salario Jaime" value={form.name}
              onChange={e => set('name', e.target.value)} autoFocus required />
          </div>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCOME_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-amount">Monto por defecto</Label>
              <Input id="inc-amount" inputMode="numeric" enterKeyHint="done" placeholder="0"
                value={form.default_amount} onChange={e => set('default_amount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label htmlFor="inc-start">Mes de inicio</Label>
              <Input id="inc-start" type="month" value={form.start_month}
                onChange={e => set('start_month', e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="inc-end">Mes de fin <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Input id="inc-end" type="month" value={form.end_month}
              min={form.start_month || undefined}
              onChange={e => set('end_month', e.target.value)} />
            {form.end_month && (
              <button type="button" className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => set('end_month', '')}>
                Quitar fecha de fin
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Tipo:</span>
            <button type="button"
              onClick={() => set('is_fixed', true)}
              className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                form.is_fixed ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'
              )}>Fijo</button>
            <button type="button"
              onClick={() => set('is_fixed', false)}
              className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                !form.is_fixed ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'
              )}>Variable</button>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// TrmSection — inline input, always visible when USD income exists
// ---------------------------------------------------------------------------

interface TrmSectionProps {
  month: string;
  householdId: string;
  userId: string;
  exchangeRate: ExchangeRateRow | null;
}

function TrmSection({ month, householdId, userId, exchangeRate }: TrmSectionProps) {
  const { formatNumber } = useNumberFormat();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setValue(exchangeRate ? String(exchangeRate.rate) : '');
    setEditing(true);
  }

  async function handleSave() {
    const parsed = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) { setEditing(false); return; }
    setSaving(true);
    try {
      await upsertExchangeRate({
        id: exchangeRate?.id,
        household_id: householdId,
        from_currency: 'USD',
        to_currency: 'COP',
        month,
        rate: parsed,
        source: 'manual',
      }, userId);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  const hasTrm = exchangeRate !== null;

  return (
    <div className={cn(
      'rounded-xl border p-4',
      hasTrm
        ? 'bg-[var(--bg-surface)] border-[var(--border-subtle)] shadow-sm'
        : 'bg-amber-50 border-amber-200',
    )}>
      <div className="flex items-center justify-between gap-4">
        {/* Label */}
        <div className="flex items-center gap-2 shrink-0">
          {hasTrm
            ? <TrendingUp size={15} className="text-violet-500" />
            : <AlertTriangle size={15} className="text-amber-500" />
          }
          <span className="text-sm font-semibold text-gray-700">TRM · USD → COP</span>
          {hasTrm && exchangeRate.source === 'fallback' && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              Estimado
            </span>
          )}
        </div>

        {/* Value / input */}
        {editing ? (
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Input
              className="h-8 w-36 text-sm text-right"
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="ej: 4200"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="shrink-0 p-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="shrink-0 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1 justify-end">
            {hasTrm ? (
              <span className="text-base font-bold text-gray-800 tabular-nums">
                {formatNumber(exchangeRate.rate)}
              </span>
            ) : (
              <span className="text-xs text-amber-700">
                Sin TRM — los ingresos USD no se convierten
              </span>
            )}
            <button
              onClick={startEdit}
              className="shrink-0 text-xs font-medium text-pink-600 hover:text-pink-700 hover:underline cursor-pointer"
            >
              {hasTrm ? 'Editar' : 'Ingresar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Salary calculation helper
// ---------------------------------------------------------------------------

function computeSalaryTotal(baseSalary: number, deductions: number, extraDays: number): number {
  const extraDaysAmount = Math.round(extraDays * baseSalary * 12 / 260);
  return baseSalary - deductions + extraDaysAmount;
}

// ---------------------------------------------------------------------------
// SalaryBreakdownDialog — special form for Salario incomes
// ---------------------------------------------------------------------------

interface SalaryBreakdownDialogProps {
  open: boolean;
  onClose: () => void;
  income: IncomeRow;
  incomeMonth: IncomeMonthRow | null;
  month: string;
  householdId: string;
  userId: string;
  trm: number | null;
}

function SalaryBreakdownDialog({
  open, onClose, income, incomeMonth, month, householdId, userId, trm,
}: SalaryBreakdownDialogProps) {
  const { formatCOP, formatNumber } = useNumberFormat();
  const [currency, setCurrency] = useState<string>('COP');
  const [baseSalary, setBaseSalary] = useState('');
  const [deductions, setDeductions] = useState('');
  const [extraDays, setExtraDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUSD = currency === 'USD';

  // Re-initialize fields when dialog opens
  function handleOpenChange(v: boolean) {
    if (v) {
      // Use existing income_month currency if available, otherwise fall back to income's currency
      const initCurrency = incomeMonth?.currency ?? income.currency;
      setCurrency(initCurrency);
      setBaseSalary(String(incomeMonth?.base_salary ?? income.default_amount));
      setDeductions(String(incomeMonth?.deductions ?? 0));
      setExtraDays(String(incomeMonth?.extra_days ?? 0));
      setError(null);
    } else {
      onClose();
    }
  }

  const parsedBase = parseInt(baseSalary.replace(/\D/g, ''), 10) || 0;
  const parsedDed = parseInt(deductions.replace(/\D/g, ''), 10) || 0;
  const parsedExtra = parseInt(extraDays.replace(/\D/g, ''), 10) || 0;
  const total = computeSalaryTotal(parsedBase, parsedDed, parsedExtra);
  const extraDaysAmount = Math.round(parsedExtra * parsedBase * 12 / 260);

  // COP equivalent of the total when currency is USD
  const totalCOP = isUSD && trm ? Math.round(total * trm) : null;

  // Format amounts in the selected currency
  function fmtNative(amount: number): string {
    return isUSD ? formatNumber(amount) : formatCOP(amount);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedBase <= 0) { setError('El salario base debe ser mayor a 0'); return; }
    if (isUSD && !trm) { setError('Ingresa la TRM del mes antes de guardar un salario en USD'); return; }
    setSaving(true);
    setError(null);
    try {
      await upsertIncomeMonth({
        id: incomeMonth?.id,
        household_id: householdId,
        income_id: income.id,
        month,
        real_amount: total,   // stored in native currency (COP or USD)
        currency,
        base_salary: parsedBase,
        deductions: parsedDed,
        extra_days: parsedExtra,
      }, userId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Desglose salarial — {income.name}</DialogTitle>
          <p className="text-xs text-gray-400 mt-0.5">{formatMonth(month)}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Selector de moneda */}
          <div className="space-y-1.5">
            <Label>Moneda</Label>
            <div className="flex gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
                    currency === c
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {/* TRM warning when USD selected but no rate available */}
            {isUSD && !trm && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Sin TRM para {formatMonth(month)} — ingresa la TRM primero
              </p>
            )}
          </div>

          {/* Salario Base */}
          <div className="space-y-1.5">
            <Label htmlFor="sb-base">Salario base</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-violet-500 shrink-0 w-8 text-right">
                {currency}
              </span>
              <Input
                id="sb-base"
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="0"
                value={baseSalary}
                onChange={e => setBaseSalary(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Deducciones */}
          <div className="space-y-1.5">
            <Label htmlFor="sb-ded">Deducciones</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-400 shrink-0 w-8 text-right">
                −{currency}
              </span>
              <Input
                id="sb-ded"
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="0"
                value={deductions}
                onChange={e => setDeductions(e.target.value)}
              />
            </div>
          </div>

          {/* Días extra */}
          <div className="space-y-1.5">
            <Label htmlFor="sb-extra">Días extra</Label>
            <div className="flex items-center gap-2">
              <Input
                id="sb-extra"
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="0"
                value={extraDays}
                onChange={e => setExtraDays(e.target.value)}
                className="w-24"
              />
              <span className="text-xs text-gray-400">
                {parsedExtra > 0
                  ? `= +${currency} ${fmtNative(extraDaysAmount)}`
                  : 'días · (base × 12/260)'}
              </span>
            </div>
          </div>

          {/* Total calculado */}
          <div className="rounded-xl bg-pink-50 border border-pink-200 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-pink-700">Total del mes</span>
              <span className="text-lg font-bold text-pink-900 tabular-nums">
                {isUSD && <span className="text-sm font-medium text-violet-500 mr-1">USD</span>}
                {fmtNative(total)}
              </span>
            </div>
            {/* COP conversion — shown when USD */}
            {isUSD && (
              totalCOP !== null ? (
                <p className="text-xs text-right text-gray-500">
                  ≈ <span className="font-semibold text-gray-700">{formatCOP(totalCOP)}</span>
                </p>
              ) : (
                <p className="text-xs text-right text-amber-500">Sin TRM — conversión no disponible</p>
              )
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// IncomeRow card — shows one income source with its monthly amount
// ---------------------------------------------------------------------------

interface IncomeCardProps {
  income: IncomeRow;
  incomeMonth: IncomeMonthRow | null;
  month: string;
  householdId: string;
  userId: string;
  trm: number | null;
  onEdit: () => void;
  onDelete: () => void;
}

function IncomeCard({ income, incomeMonth, month, householdId, userId, trm, onEdit, onDelete }: IncomeCardProps) {
  const { formatCOP, formatNumber } = useNumberFormat();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);

  const isSalary = income.category === 'Salario';
  const isUSD = income.currency !== 'COP';
  const rawAmount = incomeMonth?.real_amount ?? income.default_amount;
  const copAmount = isUSD ? (trm ? Math.round(rawAmount * trm) : null) : rawAmount;
  const isModified = incomeMonth !== null;

  function startEdit() {
    setValue(String(rawAmount));
    setEditing(true);
  }

  function handleAmountClick() {
    if (isSalary) {
      setSalaryDialogOpen(true);
    } else {
      startEdit();
    }
  }

  async function handleSave() {
    const parsed = parseInt(value.replace(/\D/g, ''), 10);
    if (isNaN(parsed)) { setEditing(false); return; }
    setSaving(true);
    try {
      await upsertIncomeMonth({
        id: incomeMonth?.id,
        household_id: householdId,
        income_id: income.id,
        month,
        real_amount: parsed,
        currency: income.currency,
      }, userId);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm p-4 group">
      {/* Salary breakdown dialog — only rendered for Salario incomes */}
      {isSalary && (
        <SalaryBreakdownDialog
          open={salaryDialogOpen}
          onClose={() => setSalaryDialogOpen(false)}
          income={income}
          incomeMonth={incomeMonth}
          month={month}
          householdId={householdId}
          userId={userId}
          trm={trm}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Info block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{income.name}</p>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
              income.is_fixed === 1 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600',
            )}>
              {income.is_fixed === 1 ? 'Fijo' : 'Variable'}
            </span>
          </div>
          <p className="text-xs text-gray-400">{income.category} · desde {income.start_month}</p>
        </div>

        {/* Actions (hover) */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded text-gray-300 hover:text-pink-500 hover:bg-pink-50"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Amount block */}
      <div className="mt-3 pt-3 border-t border-pink-50">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">{income.currency}</span>
            <Input
              className="h-8 text-sm w-36 text-right"
              inputMode="numeric"
              enterKeyHint="done"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50"
            >
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
        ) : (
          <div
            className="flex items-end justify-between cursor-pointer"
            onClick={handleAmountClick}
            title={isSalary ? 'Clic para desglosar el salario de este mes' : 'Clic para editar el monto de este mes'}
          >
            <div>
              {/* Main amount */}
              <div className="flex items-baseline gap-1.5">
                {isUSD && (
                  <span className="text-xs font-medium text-violet-400">USD</span>
                )}
                <span className="text-lg font-bold text-gray-800 tabular-nums">
                  {formatNumber(rawAmount)}
                </span>
                {isModified && (
                  <span className="text-[10px] text-violet-400 font-medium">editado</span>
                )}
              </div>

              {/* Salary breakdown summary */}
              {isSalary && isModified && incomeMonth && (incomeMonth.base_salary > 0 || incomeMonth.deductions > 0 || incomeMonth.extra_days > 0) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Base {formatCOP(incomeMonth.base_salary)}
                  {incomeMonth.deductions > 0 && ` − ${formatCOP(incomeMonth.deductions)}`}
                  {incomeMonth.extra_days > 0 && ` + ${incomeMonth.extra_days}d extra`}
                </p>
              )}

              {/* COP conversion */}
              {isUSD && (
                copAmount !== null ? (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    ≈ <span className="font-semibold text-gray-700">{formatCOP(copAmount)}</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-500 mt-0.5">Sin TRM — no se puede convertir</p>
                )
              )}
            </div>

            {/* Only show pencil for non-salary incomes */}
            {!isSalary && (
              <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mb-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IncomePage
// ---------------------------------------------------------------------------

export function IncomePage() {
  const { formatCOP } = useNumberFormat();
  const { session } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [editingIncome, setEditingIncome] = useState<IncomeRow | null>(null);

  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  // Filter by date range: only show incomes active in the selected month.
  // An income is active when start_month <= month AND (end_month IS NULL OR end_month >= month).
  const { data: incomes = [] } = useQuery<IncomeRow>(
    `SELECT id, name, person, is_fixed, category, default_amount, currency, start_month, end_month
     FROM incomes
     WHERE deleted_at IS NULL
       AND start_month <= ?
       AND (end_month IS NULL OR end_month >= ?)
     ORDER BY category ASC, name ASC`,
    [month, month],
  );

  const { data: incomeMonths = [] } = useQuery<IncomeMonthRow>(
    `SELECT id, income_id, real_amount, currency, note, base_salary, deductions, extra_days
     FROM income_months WHERE month = ?`,
    [month],
  );

  const { data: exchangeRates = [] } = useQuery<ExchangeRateRow>(
    `SELECT id, rate, source FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP' AND month = ?`,
    [month],
  );

  const hasUSDIncome = incomes.some(i => i.currency !== 'COP');
  const exchangeRate = exchangeRates[0] ?? null;
  const trm = exchangeRate?.rate ?? null;

  const imMap = new Map<string, IncomeMonthRow>();
  for (const im of incomeMonths) imMap.set(im.income_id, im);

  const totalCOP = incomes.reduce((sum, inc) => {
    const im = imMap.get(inc.id);
    const amount = im?.real_amount ?? inc.default_amount;
    if (inc.currency === 'COP') return sum + amount;
    if (trm) return sum + Math.round(amount * trm);
    return sum;
  }, 0);

  const missingTrm = hasUSDIncome && trm === null;

  async function handleDeleteIncome(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    await deleteIncome(id);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <AppHeader
        emoji="💰"
        title="Ingresos"
        subtitle={formatMonth(month)}
        actions={
          <IncomeFormDialog
            mode="create"
            householdId={householdId}
            userId={userId}
            onDone={() => {}}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> Nuevo
              </Button>
            }
          />
        }
      />

      {/* Month navigator */}
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <Button variant="outline" size="icon" onClick={() => setMonth(prevMonth(month))}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{formatMonth(month)}</h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(nextMonth(month))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* TRM — always shown if USD income exists */}
        {hasUSDIncome && (
          <TrmSection
            month={month}
            householdId={householdId}
            userId={userId}
            exchangeRate={exchangeRate}
          />
        )}

        {/* Total card */}
        {incomes.length > 0 && (
          <div className={cn(
            'rounded-xl p-4 flex items-center justify-between shadow-sm',
            missingTrm ? 'bg-amber-500 text-white' : 'bg-pink-600 text-white',
          )}>
            <div>
              <p className="text-xs font-medium opacity-80">Disponible {formatMonth(month)}</p>
              {missingTrm && (
                <p className="text-xs opacity-70 mt-0.5">⚠ Ingresos USD excluidos — falta TRM</p>
              )}
            </div>
            <span className="text-xl font-bold tabular-nums">{formatCOP(totalCOP)}</span>
          </div>
        )}

        {/* Empty state */}
        {incomes.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">💰</p>
            <p className="text-sm font-medium">Sin fuentes de ingreso</p>
            <p className="text-xs mt-1">Agrega la primera con el botón "Nuevo"</p>
          </div>
        )}

        {/* Income cards */}
        {incomes.map(income => (
          <IncomeCard
            key={income.id}
            income={income}
            incomeMonth={imMap.get(income.id) ?? null}
            month={month}
            householdId={householdId}
            userId={userId}
            trm={trm}
            onEdit={() => setEditingIncome(income)}
            onDelete={() => handleDeleteIncome(income.id, income.name)}
          />
        ))}
      </main>

      {/* Edit income dialog — controlled */}
      {editingIncome && (
        <IncomeFormDialog
          key={editingIncome.id}
          mode="edit"
          incomeId={editingIncome.id}
          householdId={householdId}
          userId={userId}
          defaultOpen
          initial={{
            name: editingIncome.name,
            category: editingIncome.category,
            default_amount: String(editingIncome.default_amount),
            currency: editingIncome.currency,
            is_fixed: editingIncome.is_fixed === 1,
            start_month: editingIncome.start_month,
            end_month: editingIncome.end_month ?? '',
          }}
          onDone={() => setEditingIncome(null)}
          trigger={<span />}
        />
      )}

      <AppNav />
    </div>
  );
}
