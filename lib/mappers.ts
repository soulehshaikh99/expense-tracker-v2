import type { Budget } from '@/types/budget';
import type { BudgetDTO, ExpenseDTO, ExpenseInput } from '@/types/dto';
import type { Expense } from '@/types/expense';
import { formatLocalDate, parseLocalDate } from './dates';
import { normalizePerson } from './person';

const toDate = (iso: string | null): Date | undefined => (iso ? new Date(iso) : undefined);
const toIso = (d: Date | undefined): string | null => (d ? d.toISOString() : null);

export function expenseFromDTO(dto: ExpenseDTO): Expense {
  return {
    id: dto.id,
    title: dto.title,
    amount: dto.amount,
    paymentMode: dto.paymentMode,
    forWhom: normalizePerson(dto.forWhom),
    date: parseLocalDate(dto.date),
    transactionType: dto.transactionType,
    paymentReceived: dto.paymentReceived,
    paymentReceivedDate: toDate(dto.paymentReceivedAt),
    isSplit: dto.isSplit,
    splitDetails: dto.splitDetails?.map((s) => ({
      person: normalizePerson(s.person),
      amount: s.amount,
      paymentReceived: s.paymentReceived,
      paymentReceivedDate: toDate(s.paymentReceivedAt),
    })),
    category: dto.category || undefined,
  };
}

export function expenseToInput(e: Omit<Expense, 'id'>): ExpenseInput {
  return {
    title: e.title,
    amount: e.amount,
    paymentMode: e.paymentMode,
    forWhom: e.forWhom,
    date: formatLocalDate(e.date),
    transactionType: e.transactionType ?? 'expense',
    paymentReceived: e.paymentReceived ?? false,
    paymentReceivedAt: toIso(e.paymentReceivedDate),
    isSplit: e.isSplit ?? false,
    splitDetails: e.isSplit
      ? (e.splitDetails ?? []).map((s) => ({
          person: s.person,
          amount: s.amount,
          paymentReceived: s.paymentReceived ?? false,
          paymentReceivedAt: toIso(s.paymentReceivedDate),
        }))
      : null,
    category: e.category ?? null,
  };
}

export function budgetFromDTO(dto: BudgetDTO): Budget {
  return {
    id: dto.id,
    month: parseLocalDate(dto.month),
    amount: dto.amount,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
