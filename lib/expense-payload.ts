import type { Expense } from '@/types/expense';
import type { ExpenseInput } from '@/types/dto';
import type { ExpenseFormValues } from '@/lib/validation/expense';
import { formatLocalDate } from './dates';
import { canHavePaymentStatus, isSelf, normalizePerson, SELF, SPLIT } from './person';
import { round2 } from './utils';

/**
 * Received date rule (plan 7.4): unchecked → null; checked and already received on the
 * edited record → keep the existing date; otherwise → now.
 */
function receivedAt(
  checked: boolean,
  previous: { paymentReceived?: boolean; paymentReceivedDate?: Date } | undefined,
  now: Date,
): string | null {
  if (!checked) return null;
  if (previous?.paymentReceived && previous.paymentReceivedDate) {
    return previous.paymentReceivedDate.toISOString();
  }
  return now.toISOString();
}

/** Build the payload sent to the server from form values (and the record being edited). */
export function buildExpenseInput(
  values: ExpenseFormValues,
  existing?: Expense,
  now: Date = new Date(),
): ExpenseInput {
  const transactionType = values.transactionType;
  const isSplit = values.isSplit && transactionType === 'expense';
  const forWhom = isSplit ? SPLIT : normalizePerson(values.forWhom);
  const statusApplies = canHavePaymentStatus({ isSplit, forWhom, transactionType });
  const paymentReceived = statusApplies && values.paymentReceived;
  const previous = existing && !existing.isSplit ? existing : undefined;

  const previousShares = existing?.isSplit ? (existing.splitDetails ?? []) : [];
  const splitDetails = isSplit
    ? values.splitDetails.map((row) => {
        const person = normalizePerson(row.person);
        const received = !isSelf(person) && row.paymentReceived;
        const prev = previousShares.find((s) => s.person.toLowerCase() === person.toLowerCase());
        return {
          person,
          amount: round2(row.amount),
          paymentReceived: received,
          paymentReceivedAt: receivedAt(received, prev, now),
        };
      })
    : null;

  const category = values.category.trim();

  return {
    title: values.title.trim(),
    amount: round2(values.amount),
    paymentMode: values.paymentMode,
    forWhom,
    date: formatLocalDate(values.date),
    transactionType,
    paymentReceived,
    paymentReceivedAt: receivedAt(paymentReceived, previous, now),
    isSplit,
    splitDetails,
    category: category || null,
  };
}

/**
 * Server-side normalization of a validated input (migration 6.4): trims, normalizes names,
 * and enforces the invariants the database relies on.
 */
export function normalizeExpenseInput(input: ExpenseInput, now: Date = new Date()): ExpenseInput {
  const isSplit = input.isSplit && input.transactionType === 'expense';
  const forWhom = isSplit ? SPLIT : normalizePerson(input.forWhom);
  const statusApplies = canHavePaymentStatus({
    isSplit,
    forWhom,
    transactionType: input.transactionType,
  });
  const paymentReceived = statusApplies && input.paymentReceived;
  const nowIso = now.toISOString();

  return {
    title: input.title.trim(),
    amount: round2(input.amount),
    paymentMode: input.paymentMode,
    forWhom,
    date: input.date,
    transactionType: input.transactionType,
    paymentReceived,
    paymentReceivedAt: paymentReceived ? (input.paymentReceivedAt ?? nowIso) : null,
    isSplit,
    splitDetails: isSplit
      ? (input.splitDetails ?? []).map((s) => {
          const person = normalizePerson(s.person);
          const received = !isSelf(person) && s.paymentReceived;
          return {
            person,
            amount: round2(s.amount),
            paymentReceived: received,
            paymentReceivedAt: received ? (s.paymentReceivedAt ?? nowIso) : null,
          };
        })
      : null,
    category: input.category?.trim() || null,
  };
}

/** Form values for editing an existing record. */
export function formValuesFromExpense(e: Expense): ExpenseFormValues {
  return {
    transactionType: e.transactionType ?? 'expense',
    title: e.title,
    amount: e.amount,
    paymentMode: e.paymentMode,
    date: e.date,
    forWhom: e.isSplit ? '' : e.forWhom,
    category: e.category ?? '',
    isSplit: !!e.isSplit,
    splitDetails: (e.splitDetails ?? []).map((s) => ({
      person: s.person,
      amount: s.amount,
      paymentReceived: !!s.paymentReceived,
    })),
    paymentReceived: !!e.paymentReceived,
  };
}

/** Rows when split is turned on: Self + one empty row, total divided equally (last takes remainder). */
export function initialSplitRows(amount: number): ExpenseFormValues['splitDetails'] {
  const rows = [
    { person: SELF, amount: 0, paymentReceived: false },
    { person: '', amount: 0, paymentReceived: false },
  ];
  if (Number.isFinite(amount) && amount > 0) {
    const share = round2(amount / rows.length);
    rows.forEach((r, i) => {
      r.amount = i === rows.length - 1 ? round2(amount - share * (rows.length - 1)) : share;
    });
  }
  return rows;
}

/** Last split row amount: max(0, total − sum(other rows)). */
export function autoLastAmount(total: number, rows: { amount: number }[]): number {
  if (!Number.isFinite(total) || rows.length === 0) return 0;
  const others = rows.slice(0, -1).reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
  return Math.max(0, round2(total - others));
}

/** True when split rows hold anything worth confirming before discarding. */
export function splitRowsHaveData(rows: { person: string; amount: number }[]): boolean {
  return rows.some((r) => (r.person.trim() && !isSelf(r.person)) || (Number.isFinite(r.amount) && r.amount > 0));
}
