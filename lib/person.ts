import type { Expense, TransactionType } from '@/types/expense';

export const SELF = 'Self';
export const SPLIT = 'Split';

export function normalizePerson(s: string): string {
  const trimmed = s.trim();
  return trimmed.toLowerCase() === 'self' ? SELF : trimmed;
}

export function isSelf(s: string | null | undefined): boolean {
  return s != null && normalizePerson(s) === SELF;
}

export function typeOf(e: Pick<Expense, 'transactionType'>): TransactionType {
  return e.transactionType ?? 'expense';
}

/** Regular (non-split, non-self) expense, donation or lent can be marked received. */
export function canHavePaymentStatus(
  e: Pick<Expense, 'isSplit' | 'forWhom' | 'transactionType'>,
): boolean {
  const type = typeOf(e);
  return (
    !e.isSplit && !isSelf(e.forWhom) && (type === 'expense' || type === 'donation' || type === 'lent')
  );
}
