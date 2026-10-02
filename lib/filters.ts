import type { Expense, PaymentMode, TransactionType } from '@/types/expense';
import { isInMonth, isSameMonthAs } from './dates';
import { canHavePaymentStatus, isSelf, typeOf } from './person';

export type PaymentStatusFilter = 'All' | 'Received' | 'Pending';

export interface ExpenseFilters {
  paymentModes: PaymentMode[] | 'All';
  persons: string[] | 'All';
  types: TransactionType[] | 'All';
  paymentStatus: PaymentStatusFilter;
  categories: string[] | 'All';
}

export const DEFAULT_FILTERS: ExpenseFilters = {
  paymentModes: 'All',
  persons: 'All',
  types: 'All',
  paymentStatus: 'All',
  categories: 'All',
};

export type SplitStatus = 'received' | 'partial' | 'pending';

/** Status of a split, derived from its non-self shares. */
export function splitStatus(e: Expense): SplitStatus {
  const shares = (e.splitDetails ?? []).filter((s) => !isSelf(s.person));
  const received = shares.filter((s) => s.paymentReceived).length;
  if (received === shares.length) return 'received';
  return received === 0 ? 'pending' : 'partial';
}

function isSplitWithDetails(e: Expense): boolean {
  return !!e.isSplit && !!e.splitDetails && e.splitDetails.length > 0;
}

function matchesPaymentStatus(e: Expense, status: Exclude<PaymentStatusFilter, 'All'>): boolean {
  const wantReceived = status === 'Received';
  if (isSplitWithDetails(e)) return (splitStatus(e) === 'received') === wantReceived;
  if (canHavePaymentStatus(e)) return !!e.paymentReceived === wantReceived;
  return false;
}

export function applyFilters(expenses: Expense[], month: Date, f: ExpenseFilters): Expense[] {
  return expenses.filter((e) => {
    if (!isInMonth(e.date, month)) return false;
    if (f.types !== 'All' && !f.types.includes(typeOf(e))) return false;
    if (f.paymentModes !== 'All' && !f.paymentModes.includes(e.paymentMode)) return false;
    if (f.persons !== 'All' && !f.persons.includes(e.forWhom)) return false;
    if (f.paymentStatus !== 'All' && !matchesPaymentStatus(e, f.paymentStatus)) return false;
    if (f.categories !== 'All' && !(e.category && f.categories.includes(e.category))) return false;
    return true;
  });
}

/** Number of filters not set to 'All'. The month is not counted. */
export function countActiveFilters(f: ExpenseFilters): number {
  const lists = [f.paymentModes, f.persons, f.types, f.categories].filter((v) => v !== 'All');
  return lists.length + (f.paymentStatus !== 'All' ? 1 : 0);
}

export function hasActiveFilters(f: ExpenseFilters, month: Date, now: Date = new Date()): boolean {
  return countActiveFilters(f) > 0 || !isSameMonthAs(month, now);
}
