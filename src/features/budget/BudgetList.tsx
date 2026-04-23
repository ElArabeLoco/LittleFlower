import { Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Button } from '@/shared/ui/button';
import { getCategoryEmoji, getCategoryName } from '@/domain/budget/categories';
import type { PaymentMode } from '@/domain/budget/Budget';
import { BudgetFormDialog } from './BudgetFormDialog';
import type { BudgetRow, DebtOption } from './types';

interface BudgetListProps {
  items: BudgetRow[];
  emptyLabel: string;
  householdId: string;
  userId: string;
  debts: DebtOption[];
  onDelete: (id: string, name: string) => void;
}

export function BudgetList({ items, emptyLabel, householdId, userId, debts, onDelete }: BudgetListProps) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();

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
                : `${t.common.from} ${b.start_month}`}{' '}
              · {formatCOP(b.default_amount)}/mes
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <BudgetFormDialog
              mode="edit"
              budgetId={b.id}
              householdId={householdId}
              userId={userId}
              debts={debts}
              initial={{
                name: b.name,
                description: b.description ?? '',
                category_id: b.category_id,
                start_month: b.start_month,
                end_month: b.end_month ?? '',
                default_amount: String(b.default_amount),
                payment_mode: (b.payment_mode as PaymentMode) ?? 'credit_card',
                debt_id: b.debt_id ?? '',
              }}
              onDone={() => {}}
              trigger={
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-pink-600">
                  <Pencil size={14} />
                </Button>
              }
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500"
              onClick={() => onDelete(b.id, b.name)}>
              <Trash2 size={14} />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
