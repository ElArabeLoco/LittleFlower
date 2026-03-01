/**
 * BudgetManagementPage — /settings/budgets
 *
 * Lista todos los presupuestos activos del hogar.
 * Permite crear nuevos, editar nombre/monto/categoría, y eliminar (soft-delete).
 *
 * Cada presupuesto tiene:
 *   - Nombre (ej: "Netflix", "Cuota Apartamento")
 *   - Categoría (lista hardcodeada de 15)
 *   - Monto por defecto (COP, entero)
 *   - Grupo: Tarjeta de Crédito | Efectivo
 *   - Mes de inicio (a partir de cuándo aparece en el spreadsheet)
 */

import { useState } from 'react';
import { useQuery } from '@powersync/react';
import { Plus, Pencil, Trash2, CreditCard, Banknote } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/ui/cn';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { CATEGORIES, getCategoryEmoji, getCategoryName } from '@/domain/budget/categories';
import {
  insertBudget,
  updateBudget,
  deleteBudget,
} from '@/infrastructure/powersync/mutationWrappers';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetRow {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  start_month: string;
  end_month: string | null;
  default_amount: number;
  paid_with_credit_card: number;
  household_id: string;
  debt_id: string | null;
}

interface DebtOption {
  id: string;
  name: string;
}

interface BudgetFormState {
  name: string;
  description: string;
  category_id: string;
  start_month: string;
  end_month: string;   // '' = no end date (indefinite)
  default_amount: string;
  paid_with_credit_card: boolean;
  debt_id: string;     // '' = not linked
}

const defaultForm = (): BudgetFormState => ({
  name: '',
  description: '',
  category_id: 'other',
  start_month: new Date().toISOString().slice(0, 7),
  end_month: '',
  default_amount: '0',
  paid_with_credit_card: false,
  debt_id: '',
});

// ---------------------------------------------------------------------------
// BudgetFormDialog — create or edit
// ---------------------------------------------------------------------------

interface BudgetFormDialogProps {
  mode: 'create' | 'edit';
  initial?: BudgetFormState;
  budgetId?: string;
  householdId: string;
  userId: string;
  debts: DebtOption[];
  onDone: () => void;
  trigger: React.ReactNode;
}

function BudgetFormDialog({ mode, initial, budgetId, householdId, userId, debts, onDone, trigger }: BudgetFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BudgetFormState>(initial ?? defaultForm());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof BudgetFormState>(key: K, value: BudgetFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseInt(form.default_amount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 0) {
      setError('El monto debe ser un número válido en COP');
      return;
    }
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (form.end_month && form.end_month < form.start_month) {
      setError('El mes de fin debe ser igual o posterior al mes de inicio');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'create') {
        await insertBudget({
          household_id: householdId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category_id: form.category_id,
          start_month: form.start_month,
          end_month: form.end_month || undefined,
          default_amount: amount,
          paid_with_credit_card: form.paid_with_credit_card,
          debt_id: form.debt_id || null,
          created_by: userId,
        }, userId);
      } else if (mode === 'edit' && budgetId) {
        await updateBudget(budgetId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category_id: form.category_id,
          default_amount: amount,
          // Pass null to explicitly clear end_month when the field is empty
          end_month: form.end_month || null,
          // Pass null to unlink debt, or the selected debt_id
          debt_id: form.debt_id || null,
        }, userId);
      }
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) setForm(initial ?? defaultForm());
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuevo presupuesto' : 'Editar presupuesto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Nombre *</Label>
            <Input
              id="b-name"
              placeholder="Ej: Netflix, Cuota apartamento"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="b-desc">Descripción (opcional)</Label>
            <Input
              id="b-desc"
              placeholder="Nota adicional"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={form.category_id} onValueChange={v => set('category_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span>{cat.emoji}</span>
                      <span>{cat.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="b-amount">Monto mensual por defecto (COP)</Label>
            <Input
              id="b-amount"
              inputMode="numeric"
              enterKeyHint="done"
              placeholder="0"
              value={form.default_amount}
              onChange={e => set('default_amount', e.target.value)}
            />
          </div>

          {/* Start month + End month — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-start">Mes de inicio</Label>
              <Input
                id="b-start"
                type="month"
                value={form.start_month}
                onChange={e => set('start_month', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-end">Mes de fin <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input
                id="b-end"
                type="month"
                value={form.end_month}
                min={form.start_month}
                onChange={e => set('end_month', e.target.value)}
              />
              {form.end_month && (
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => set('end_month', '')}
                >
                  Quitar fecha de fin
                </button>
              )}
            </div>
          </div>

          {/* Payment method — only on create */}
          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label>Forma de pago</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => set('paid_with_credit_card', false)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    !form.paid_with_credit_card
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  <Banknote size={16} /> Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => set('paid_with_credit_card', true)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    form.paid_with_credit_card
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  <CreditCard size={16} /> Tarjeta
                </button>
              </div>
            </div>
          )}

          {/* Debt link — shown when category is 'debt' OR when editing and already linked */}
          {(form.category_id === 'debt' || form.debt_id) && debts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Vincular a deuda (opcional)</Label>
              <Select value={form.debt_id || '__none__'} onValueChange={v => set('debt_id', v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="— Sin vincular —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin vincular —</SelectItem>
                  {debts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-[var(--text-muted)]">
                Al registrar un gasto aquí, se abona automáticamente a la deuda vinculada.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
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
// BudgetManagementPage
// ---------------------------------------------------------------------------

export function BudgetManagementPage() {
  const { session } = useAuth();
  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  const { data: budgets = [] } = useQuery<BudgetRow>(
    `SELECT id, name, description, category_id, start_month, end_month, default_amount, paid_with_credit_card, household_id, debt_id
     FROM budgets WHERE deleted_at IS NULL ORDER BY paid_with_credit_card DESC, name ASC`,
  );

  const { data: debtOptions = [] } = useQuery<DebtOption>(
    `SELECT id, name FROM debts WHERE deleted_at IS NULL ORDER BY name ASC`,
  );

  const creditCard = budgets.filter(b => b.paid_with_credit_card === 1);
  const cash = budgets.filter(b => b.paid_with_credit_card === 0);

  const { formatCOP } = useNumberFormat();

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"? Los datos históricos se conservan.`)) return;
    await deleteBudget(id, userId);
  }

  function BudgetList({ items, emptyLabel }: { items: BudgetRow[]; emptyLabel: string }) {
    if (items.length === 0) {
      return <p className="text-sm text-gray-400 py-4 text-center">{emptyLabel}</p>;
    }
    return (
      <ul className="divide-y divide-[var(--border-subtle)]">
        {items.map(b => (
          <li key={b.id} className="flex items-center gap-3 py-3 px-1 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                <span className="mr-1.5">{getCategoryEmoji(b.category_id)}</span>{b.name}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {getCategoryName(b.category_id)} ·{' '}
                {b.end_month
                  ? `${b.start_month} → ${b.end_month}`
                  : `desde ${b.start_month}`}{' '}
                · {formatCOP(b.default_amount)}/mes
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <BudgetFormDialog
                mode="edit"
                budgetId={b.id}
                householdId={householdId}
                userId={userId}
                debts={debtOptions}
                initial={{
                  name: b.name,
                  description: b.description ?? '',
                  category_id: b.category_id,
                  start_month: b.start_month,
                  end_month: b.end_month ?? '',
                  default_amount: String(b.default_amount),
                  paid_with_credit_card: b.paid_with_credit_card === 1,
                  debt_id: b.debt_id ?? '',
                }}
                onDone={() => {}}
                trigger={
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-pink-600">
                    <Pencil size={14} />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-500"
                onClick={() => handleDelete(b.id, b.name)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <AppHeader
        emoji="📋"
        title="Presupuestos"
        subtitle="Gestiona tus categorías de gasto"
        maxWidth="max-w-3xl"
        actions={
          <BudgetFormDialog
            mode="create"
            householdId={householdId}
            userId={userId}
            debts={debtOptions}
            onDone={() => {}}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> Nuevo
              </Button>
            }
          />
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {budgets.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm font-medium">Sin presupuestos aún</p>
            <p className="text-xs mt-1">Crea el primero con el botón "Nuevo"</p>
          </div>
        )}

        {/* 2-col on lg+, single-col on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Credit Card group */}
          {creditCard.length > 0 && (
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm p-4">
              <h2 className="text-sm font-bold text-violet-700 mb-3 flex items-center gap-1.5">
                <CreditCard size={14} /> Tarjeta de Crédito
              </h2>
              <BudgetList items={creditCard} emptyLabel="Sin ítems de tarjeta" />
            </div>
          )}

          {/* Cash group */}
          {cash.length > 0 && (
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm p-4">
              <h2 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-1.5">
                <Banknote size={14} /> Efectivo
              </h2>
              <BudgetList items={cash} emptyLabel="Sin ítems de efectivo" />
            </div>
          )}
        </div>
      </main>

      <AppNav />
    </div>
  );
}
