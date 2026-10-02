import { z } from 'zod';
import { isDateString, MONTH_RE } from '@/lib/dates';
import { hasAtMostTwoDecimals } from './expense';

export const BUDGET_AMOUNT_MESSAGE = 'Please enter a valid budget amount (greater than 0)';

export const budgetAmountSchema = z
  .number({ error: BUDGET_AMOUNT_MESSAGE })
  .positive({ message: BUDGET_AMOUNT_MESSAGE })
  .refine(hasAtMostTwoDecimals, { message: 'Amount can have at most 2 decimal places.' });

export const budgetFormSchema = z.object({ amount: budgetAmountSchema });
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export const budgetMonthSchema = z
  .string()
  .refine((s) => MONTH_RE.test(s) && isDateString(s), { message: 'Invalid budget month.' });

export const budgetInputSchema = z.object({
  month: budgetMonthSchema,
  amount: budgetAmountSchema,
});
