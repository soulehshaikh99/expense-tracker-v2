// Row → DTO mapping for repositories. Pure (no db import) so it can be unit-tested.
import type { budgets, expenses, expenseSplits } from '@/lib/db/schema';
import type { BudgetDTO, ExpenseDTO, ExpenseInput } from '@/types/dto';

export type ExpenseRow = typeof expenses.$inferSelect;
export type SplitRow = typeof expenseSplits.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function expenseRowToDTO(row: ExpenseRow, splits: SplitRow[]): ExpenseDTO {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    paymentMode: row.paymentMode,
    forWhom: row.forWhom,
    date: row.date,
    transactionType: row.transactionType,
    paymentReceived: row.paymentReceived,
    paymentReceivedAt: iso(row.paymentReceivedAt),
    isSplit: row.isSplit,
    splitDetails: row.isSplit
      ? [...splits]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            person: s.person,
            amount: Number(s.amount),
            paymentReceived: s.paymentReceived,
            paymentReceivedAt: iso(s.paymentReceivedAt),
          }))
      : null,
    category: row.category,
  };
}

export function budgetRowToDTO(row: BudgetRow): BudgetDTO {
  return {
    id: row.id,
    month: row.month,
    amount: Number(row.amount),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Column values for an expense insert/update from a normalized input. */
export function expenseValues(input: ExpenseInput) {
  return {
    title: input.title,
    amount: input.amount.toFixed(2),
    paymentMode: input.paymentMode,
    forWhom: input.forWhom,
    date: input.date,
    transactionType: input.transactionType,
    paymentReceived: input.paymentReceived,
    paymentReceivedAt: input.paymentReceivedAt ? new Date(input.paymentReceivedAt) : null,
    isSplit: input.isSplit,
    category: input.category,
  };
}

export function splitValues(expenseId: string, input: ExpenseInput) {
  return (input.splitDetails ?? []).map((s, position) => ({
    expenseId,
    position,
    person: s.person,
    amount: s.amount.toFixed(2),
    paymentReceived: s.paymentReceived,
    paymentReceivedAt: s.paymentReceivedAt ? new Date(s.paymentReceivedAt) : null,
  }));
}
