import type { Expense } from '@/types/expense';
import type { ExpenseInput } from '@/types/dto';
import type { ExpenseFormValues } from '@/lib/validation/expense';
import { formatLocalDate } from './dates';
import { canHavePaymentStatus, isSelf, normalizePerson, SPLIT } from './person';
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
