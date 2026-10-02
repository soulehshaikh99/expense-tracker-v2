import { describe, expect, it } from 'vitest';
import {
  defaultExpenseFormValues,
  expenseFormSchema,
  expenseInputSchema,
  LENT_TO_SELF_MESSAGE,
  type ExpenseFormValues,
} from '@/lib/validation/expense';
import { BUDGET_AMOUNT_MESSAGE, budgetFormSchema, budgetInputSchema } from '@/lib/validation/budget';
import type { ExpenseInput } from '@/types/dto';
import { d } from './helpers';

const form = (p: Partial<ExpenseFormValues>): ExpenseFormValues => ({
  ...defaultExpenseFormValues(d(2025, 3, 15)),
  title: 'Lunch',
  amount: 300,
  ...p,
});

const messages = (r: ReturnType<typeof expenseFormSchema.safeParse>) =>
  r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

describe('expenseFormSchema', () => {
  it('accepts a valid regular expense', () => {
    expect(expenseFormSchema.safeParse(form({})).success).toBe(true);
  });

  it('requires a title and a positive two-decimal amount', () => {
    expect(messages(expenseFormSchema.safeParse(form({ title: '   ' })))).toContain('title: Title is required.');
    expect(messages(expenseFormSchema.safeParse(form({ amount: 0 })))).toContain(
      'amount: Amount must be greater than 0.',
    );
    expect(expenseFormSchema.safeParse(form({ amount: -5 })).success).toBe(false);
    expect(expenseFormSchema.safeParse(form({ amount: Number.NaN })).success).toBe(false);
    expect(messages(expenseFormSchema.safeParse(form({ amount: 1.234 })))).toContain(
      'amount: Amount can have at most 2 decimal places.',
    );
    expect(expenseFormSchema.safeParse(form({ amount: 19.99 })).success).toBe(true);
  });

  it('requires forWhom unless split', () => {
    expect(messages(expenseFormSchema.safeParse(form({ forWhom: ' ' })))).toContain('forWhom: Please enter a name.');
  });

  it('blocks lent to Self in any case', () => {
    const r = expenseFormSchema.safeParse(form({ transactionType: 'lent', forWhom: 'self' }));
    expect(messages(r)).toContain(`forWhom: ${LENT_TO_SELF_MESSAGE}`);
  });

  it('only allows split for expenses', () => {
    const r = expenseFormSchema.safeParse(
      form({
        transactionType: 'income',
        isSplit: true,
        splitDetails: [
          { person: 'Self', amount: 150, paymentReceived: false },
          { person: 'A', amount: 150, paymentReceived: false },
        ],
      }),
    );
    expect(messages(r)).toContain('isSplit: Only expenses can be split.');
  });

  const splitForm = (rows: [string, number][], amount = 300) =>
    form({
      amount,
      forWhom: '',
      isSplit: true,
      splitDetails: rows.map(([person, a]) => ({ person, amount: a, paymentReceived: false })),
    });

  it('accepts a valid split within 0.01 tolerance', () => {
    expect(expenseFormSchema.safeParse(splitForm([['Self', 100], ['A', 100], ['B', 100]])).success).toBe(true);
    expect(expenseFormSchema.safeParse(splitForm([['Self', 50], ['A', 50.01]], 100)).success).toBe(true);
  });

  it('validates split rows', () => {
    expect(messages(expenseFormSchema.safeParse(splitForm([['Self', 300]])))).toContain(
      'splitDetails: Split transaction must have at least 2 people.',
    );
    expect(messages(expenseFormSchema.safeParse(splitForm([['Self', 150], [' ', 150]])))).toContain(
      'splitDetails.1.person: All people in split transaction must have names.',
    );
    expect(messages(expenseFormSchema.safeParse(splitForm([['Self', 100], ['Asha', 100], ['asha', 100]])))).toContain(
      'splitDetails.2.person: Duplicate person names are not allowed in split transaction.',
    );
    expect(messages(expenseFormSchema.safeParse(splitForm([['A', 150], ['B', 150]])))).toContain(
      'splitDetails: Split transaction must include "Self".',
    );
    expect(messages(expenseFormSchema.safeParse(splitForm([['Self', 150], ['self', 150]])))).toContain(
      'splitDetails.1.person: Duplicate person names are not allowed in split transaction.',
    );
    expect(messages(expenseFormSchema.safeParse(splitForm([['Self', 350], ['A', -50]])))).toContain(
      'splitDetails.1.amount: Amount cannot be negative.',
    );
    expect(messages(expenseFormSchema.safeParse(splitForm([['Self', 100], ['A', 100]])))).toContain(
      'splitDetails: Total amount (₹300.00) does not match sum of splits (₹200.00).',
    );
  });
});

describe('expenseInputSchema', () => {
  const input = (p: Partial<ExpenseInput> = {}): ExpenseInput => ({
    title: 'Lunch',
    amount: 300,
    paymentMode: 'UPI',
    forWhom: 'Self',
    date: '2025-03-15',
    transactionType: 'expense',
    paymentReceived: false,
    paymentReceivedAt: null,
    isSplit: false,
    splitDetails: null,
    category: null,
    ...p,
  });

  it('accepts a valid DTO and rejects bad dates, modes and instants', () => {
    expect(expenseInputSchema.safeParse(input()).success).toBe(true);
    expect(expenseInputSchema.safeParse(input({ date: '2025-02-30' })).success).toBe(false);
    expect(expenseInputSchema.safeParse(input({ paymentMode: 'Cheque' as never })).success).toBe(false);
    expect(expenseInputSchema.safeParse(input({ paymentReceivedAt: 'yesterday' })).success).toBe(false);
    expect(
      expenseInputSchema.safeParse(input({ paymentReceived: true, paymentReceivedAt: '2025-03-15T10:00:00.000Z' }))
        .success,
    ).toBe(true);
  });

  it('applies the same cross-field rules', () => {
    expect(expenseInputSchema.safeParse(input({ transactionType: 'lent', forWhom: 'Self' })).success).toBe(false);
    expect(
      expenseInputSchema.safeParse(
        input({
          isSplit: true,
          forWhom: 'Split',
          splitDetails: [
            { person: 'Self', amount: 100, paymentReceived: false, paymentReceivedAt: null },
            { person: 'A', amount: 100, paymentReceived: false, paymentReceivedAt: null },
          ],
        }),
      ).success,
    ).toBe(false);
  });
});

describe('budget schemas', () => {
  it('requires a positive amount with the plan message', () => {
    const r = budgetFormSchema.safeParse({ amount: 0 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe(BUDGET_AMOUNT_MESSAGE);
    expect(budgetFormSchema.safeParse({ amount: Number.NaN }).error?.issues[0].message).toBe(BUDGET_AMOUNT_MESSAGE);
    expect(budgetFormSchema.safeParse({ amount: 5000 }).success).toBe(true);
  });

  it('requires a first-of-month date string', () => {
    expect(budgetInputSchema.safeParse({ month: '2025-03-01', amount: 10 }).success).toBe(true);
    expect(budgetInputSchema.safeParse({ month: '2025-03-02', amount: 10 }).success).toBe(false);
    expect(budgetInputSchema.safeParse({ month: '2025-13-01', amount: 10 }).success).toBe(false);
  });
});
