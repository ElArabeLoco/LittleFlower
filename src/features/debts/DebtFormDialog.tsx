import { useState } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useDebtMutations, type InsertDebtPayload } from '@/application/useDebtMutations';
import { useHouseholdMembers } from '@/application/useHouseholdMembers';
import { HolderPicker } from '@/features/members/components/HolderPicker';
import {
  AMORTIZATION_METHODS,
  DEBT_KINDS,
  computedInstallment,
  defaultAmortization,
  isFinancialDebt,
  ratePercents,
  toEffectiveAnnual,
  type DebtKind,
  type RatePeriod,
} from '@/application/debtPlan';
import { todayISO } from './helpers';
import type { DebtFormState } from './types';

const defaultDebtForm = (): DebtFormState => ({
  name: '',
  description: '',
  initial_amount: '',
  currency: 'COP',
  disbursed_at: todayISO(),
  kind: 'personal',
  lender: '',
  rate: '',
  rate_period: 'EA',
  amortization: 'none',
  term_months: '',
  installment_amount: '',
  monthly_fees: '',
  holder_ids: [],
});

function parseInteger(s: string): number | null {
  const n = parseInt(s.replace(/\D/g, ''), 10);
  return isNaN(n) ? null : n;
}

function parseRate(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

const fmtPct = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 4 });

interface DebtFormDialogProps {
  mode: 'create' | 'edit';
  debtId?: string;
  initial?: DebtFormState;
  householdId: string;
  userId: string;
  onDone: () => void;
  trigger: React.ReactNode;
}

export function DebtFormDialog({ mode, debtId, initial, householdId, userId, onDone, trigger }: DebtFormDialogProps) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();
  const { insertDebt, updateDebt } = useDebtMutations(householdId, userId);
  const { members } = useHouseholdMembers();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DebtFormState>(initial ?? defaultDebtForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const financial = isFinancialDebt(form.kind);

  function set<K extends keyof DebtFormState>(key: K, value: DebtFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function setKind(kind: DebtKind) {
    setForm(f => {
      if (!isFinancialDebt(kind)) return { ...f, kind, amortization: 'none' };
      const becameFinancial = !isFinancialDebt(f.kind);
      return {
        ...f,
        kind,
        currency: 'COP',
        amortization: becameFinancial ? defaultAmortization(kind) : f.amortization,
      };
    });
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) setForm(initial ?? defaultDebtForm());
    setError(null);
  }

  // Live hints for the loan terms section
  const amount = parseInteger(form.initial_amount);
  const ratePct = parseRate(form.rate);
  const ea = ratePct !== null && ratePct >= 0 ? toEffectiveAnnual(ratePct, form.rate_period) : null;
  const term = parseInteger(form.term_months);
  const equivalents = ea !== null && ratePct ? ratePercents(ea) : null;
  const computed = ea !== null && amount && term && form.amortization === 'fixed_installment'
    ? computedInstallment(amount, ea, term)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amount || amount <= 0) { setError(t.debts.validationAmount); return; }
    if (!form.name.trim()) { setError(t.debts.validationName); return; }
    if (!form.disbursed_at) { setError(t.debts.validationDate); return; }

    const installment = parseInteger(form.installment_amount);
    let terms: Pick<InsertDebtPayload,
      'kind' | 'lender' | 'interest_rate' | 'amortization' | 'term_months' | 'installment_amount' | 'monthly_fees'>;

    if (financial) {
      if (ea === null) { setError(t.debts.validationRate); return; }
      if (form.amortization === 'fixed_principal' && !term) { setError(t.debts.validationTerm); return; }
      if (form.amortization === 'fixed_installment' && !term && !installment) {
        setError(t.debts.validationTermOrInstallment); return;
      }
      terms = {
        kind: form.kind,
        lender: form.lender.trim() || null,
        interest_rate: ea,
        amortization: form.amortization,
        term_months: term || null,
        installment_amount: form.amortization === 'fixed_installment' ? installment || null : null,
        monthly_fees: parseInteger(form.monthly_fees) ?? 0,
      };
    } else {
      terms = {
        kind: 'personal', lender: null, interest_rate: 0, amortization: 'none',
        term_months: null, installment_amount: null, monthly_fees: 0,
      };
    }

    const fields = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      initial_amount: amount,
      currency: financial ? 'COP' : form.currency,
      disbursed_at: form.disbursed_at,
      ...terms,
    };

    setSaving(true);
    try {
      if (mode === 'create') {
        await insertDebt(fields, form.holder_ids);
      } else if (mode === 'edit' && debtId) {
        await updateDebt(debtId, fields, form.holder_ids);
      }
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t.debts.newDebt : t.debts.editDebt}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>{t.debts.kindLabel}</Label>
            <Select value={form.kind} onValueChange={v => setKind(v as DebtKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEBT_KINDS.map(k => <SelectItem key={k} value={k}>{t.debts.kinds[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-name">{t.debts.nameLabel}</Label>
            <Input id="d-name" placeholder={t.debts.namePlaceholder} value={form.name}
              onChange={e => set('name', e.target.value)} autoFocus required />
          </div>

          {financial && (
            <div className="space-y-1.5">
              <Label htmlFor="d-lender">{t.debts.lenderLabel}</Label>
              <Input id="d-lender" placeholder={t.debts.lenderPlaceholder} value={form.lender}
                onChange={e => set('lender', e.target.value)} />
            </div>
          )}

          <HolderPicker
            members={members}
            value={form.holder_ids}
            onChange={ids => set('holder_ids', ids)}
            subject="debt"
          />

          <div className="space-y-1.5">
            <Label htmlFor="d-desc">{t.debts.descriptionLabel}</Label>
            <Input id="d-desc" placeholder={t.debts.descriptionPlaceholder} value={form.description}
              onChange={e => set('description', e.target.value)} />
          </div>

          {financial ? (
            <div className="space-y-1.5">
              <Label htmlFor="d-amount">{t.debts.originalAmount}</Label>
              <Input id="d-amount" inputMode="numeric" placeholder="0" value={form.initial_amount}
                onChange={e => set('initial_amount', e.target.value)} />
              <p className="text-[11px] text-[var(--text-muted)]">{t.debts.financialCopOnly}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="d-amount">{t.debts.originalAmount}</Label>
                <Input id="d-amount" inputMode="numeric" placeholder="0" value={form.initial_amount}
                  onChange={e => set('initial_amount', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.debts.currencyLabel}</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COP">COP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="d-date">{t.debts.disbursedAt}</Label>
            <Input id="d-date" type="date" value={form.disbursed_at}
              onChange={e => set('disbursed_at', e.target.value)} />
          </div>

          {financial && (
            <fieldset className="space-y-4 rounded-xl border border-[var(--border-subtle)] p-3">
              <legend className="px-1 text-xs font-semibold text-[var(--text-secondary)]">{t.debts.loanTermsTitle}</legend>

              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="d-rate">{t.debts.rateLabel}</Label>
                    <Input id="d-rate" inputMode="decimal" placeholder="12,5" value={form.rate}
                      onChange={e => set('rate', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>&nbsp;</Label>
                    <Select value={form.rate_period} onValueChange={v => set('rate_period', v as RatePeriod)}>
                      <SelectTrigger aria-label={t.debts.rateLabel}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EA">{t.debts.ratePeriods.EA}</SelectItem>
                        <SelectItem value="MV">{t.debts.ratePeriods.MV}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {equivalents && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {t.debts.rateEquivalent(fmtPct(equivalents.ea), fmtPct(equivalents.mv))}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>{t.debts.amortizationLabel}</Label>
                <Select value={form.amortization}
                  onValueChange={v => set('amortization', v as DebtFormState['amortization'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AMORTIZATION_METHODS.map(m => (
                      <SelectItem key={m} value={m}>{t.debts.amortizations[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.amortization !== 'none' && (
                <div className="space-y-1.5">
                  <Label htmlFor="d-term">{t.debts.termLabel}</Label>
                  <Input id="d-term" inputMode="numeric" placeholder="240" value={form.term_months}
                    onChange={e => set('term_months', e.target.value)} />
                </div>
              )}

              {form.amortization === 'fixed_installment' && (
                <div className="space-y-1.5">
                  <Label htmlFor="d-installment">{t.debts.installmentLabel}</Label>
                  <Input id="d-installment" inputMode="numeric" placeholder={computed ? String(computed) : '0'}
                    value={form.installment_amount} onChange={e => set('installment_amount', e.target.value)} />
                  {computed && !form.installment_amount && (
                    <p className="text-[11px] text-[var(--text-muted)]">{t.debts.installmentComputed(formatCOP(computed))}</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="d-fees">{t.debts.feesLabel}</Label>
                <Input id="d-fees" inputMode="numeric" placeholder="0" value={form.monthly_fees}
                  onChange={e => set('monthly_fees', e.target.value)} />
              </div>
            </fieldset>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t.common.saving : mode === 'create' ? t.common.create : t.common.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
