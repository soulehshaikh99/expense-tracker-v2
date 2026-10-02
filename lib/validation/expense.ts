import { z } from 'zod';
import { PAYMENT_MODES, TRANSACTION_TYPES, type TransactionType } from '@/types/expense';
import { isDateString } from '@/lib/dates';
import { isSelf, normalizePerson } from '@/lib/person';

export const SPLIT_TOLERANCE = 0.01;
export const LENT_TO_SELF_MESSAGE =
  'Money Lent transactions cannot be for "Self". Please enter a person\'s name.';

export function hasAtMostTwoDecimals(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

export const amountSchema = z
  .number({ error: 'Please enter a valid amount.' })
  .positive({ message: 'Amount must be greater than 0.' })
  .refine(hasAtMostTwoDecimals, { message: 'Amount can have at most 2 decimal places.' });

interface RuleInput {
  transactionType: TransactionType;
  amount: number;
  forWhom: string;
  isSplit: boolean;
  splitDetails: { person: string; amount: number }[] | null | undefined;
}

/** Cross-field rules shared by the form schema and the server DTO schema (plan 7.4). */
export function checkExpenseRules(v: RuleInput, ctx: z.RefinementCtx): void {
  if (v.isSplit && v.transactionType !== 'expense') {
    ctx.addIssue({ code: 'custom', path: ['isSplit'], message: 'Only expenses can be split.' });
    return;
  }

  if (!v.isSplit) {
    if (!v.forWhom.trim()) {
      ctx.addIssue({ code: 'custom', path: ['forWhom'], message: 'Please enter a name.' });
    } else if (v.transactionType === 'lent' && isSelf(v.forWhom)) {
      ctx.addIssue({ code: 'custom', path: ['forWhom'], message: LENT_TO_SELF_MESSAGE });
    }
    return;
  }

  const rows = v.splitDetails ?? [];
  if (rows.length < 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['splitDetails'],
      message: 'Split transaction must have at least 2 people.',
    });
    return;
  }

  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const name = normalizePerson(row.person);
    if (!name) {
      ctx.addIssue({
        code: 'custom',
        path: ['splitDetails', i, 'person'],
        message: 'All people in split transaction must have names.',
      });
    } else {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['splitDetails', i, 'person'],
          message: 'Duplicate person names are not allowed in split transaction.',
        });
      }
      seen.add(key);
    }
    if (!Number.isFinite(row.amount)) {
      ctx.addIssue({ code: 'custom', path: ['splitDetails', i, 'amount'], message: 'Enter an amount.' });
    } else if (row.amount < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['splitDetails', i, 'amount'],
        message: 'Amount cannot be negative.',
      });
    }
  });

  if (!rows.some((r) => isSelf(r.person))) {
    ctx.addIssue({
      code: 'custom',
      path: ['splitDetails'],
      message: 'Split transaction must include "Self".',
    });
  }

  const total = rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
  if (Number.isFinite(v.amount) && Math.abs(total - v.amount) > SPLIT_TOLERANCE + 1e-9) {
    ctx.addIssue({
      code: 'custom',
      path: ['splitDetails'],
      message: `Total amount (₹${v.amount.toFixed(2)}) does not match sum of splits (₹${total.toFixed(2)}).`,
    });
  }
}

// ---------- Form schema (client) ----------

export const splitRowFormSchema = z.object({
  person: z.string(),
  amount: z.number({ error: 'Enter an amount.' }),
  paymentReceived: z.boolean(),
});

export const expenseFormSchema = z
  .object({
    transactionType: z.enum(TRANSACTION_TYPES),
    title: z.string().trim().min(1, { message: 'Title is required.' }).max(200),
    amount: amountSchema,
    paymentMode: z.enum(PAYMENT_MODES),
    date: z.date({ error: 'Date is required.' }),
    forWhom: z.string().max(100),
    category: z.string().trim().max(100),
    isSplit: z.boolean(),
    splitDetails: z.array(splitRowFormSchema),
    paymentReceived: z.boolean(),
  })
  .superRefine((v, ctx) => checkExpenseRules(v, ctx));

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
export type SplitRowFormValues = z.infer<typeof splitRowFormSchema>;

export function defaultExpenseFormValues(date: Date): ExpenseFormValues {
  return {
    transactionType: 'expense',
    title: '',
    amount: Number.NaN,
    paymentMode: 'Credit Card',
    date,
    forWhom: 'Self',
    category: '',
    isSplit: false,
    splitDetails: [],
    paymentReceived: false,
  };
}

// ---------- DTO schema (server) ----------

const instantSchema = z.iso.datetime({ offset: true });
const dateStringSchema = z.string().refine(isDateString, { message: 'Invalid date.' });

export const splitInputSchema = z.object({
  person: z.string().trim().max(100),
  amount: z.number().refine(hasAtMostTwoDecimals, { message: 'Invalid split amount.' }),
  paymentReceived: z.boolean(),
  paymentReceivedAt: instantSchema.nullable(),
});

export const expenseInputSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Title is required.' }).max(200),
    amount: amountSchema,
    paymentMode: z.enum(PAYMENT_MODES),
    forWhom: z.string().trim().max(100),
    date: dateStringSchema,
    transactionType: z.enum(TRANSACTION_TYPES),
    paymentReceived: z.boolean(),
    paymentReceivedAt: instantSchema.nullable(),
    isSplit: z.boolean(),
    splitDetails: z.array(splitInputSchema).max(50).nullable(),
    category: z.string().trim().max(100).nullable(),
  })
  .superRefine((v, ctx) => checkExpenseRules(v, ctx));

export const uuidSchema = z.uuid();
export const positionSchema = z.number().int().min(0);
