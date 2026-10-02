'use server';

import { check, runAction } from '@/lib/action-result';
import { ValidationError } from '@/lib/repositories/errors';
import * as repo from '@/lib/repositories/expenses';
import { positionSchema, uuidSchema } from '@/lib/validation/expense';
import type { ActionResult, ExpenseDTO, ExpenseInput } from '@/types/dto';

const INVALID_ID = 'Invalid transaction id.';

export async function listExpensesAction(): Promise<ActionResult<ExpenseDTO[]>> {
  return runAction('listExpenses', () => repo.listExpenses());
}

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult<ExpenseDTO>> {
  return runAction('createExpense', () => repo.createExpense(input));
}

export async function updateExpenseAction(
  id: string,
  input: ExpenseInput,
): Promise<ActionResult<ExpenseDTO>> {
  return runAction('updateExpense', () => repo.updateExpense(check(uuidSchema, id, INVALID_ID), input));
}

export async function deleteExpenseAction(id: string): Promise<ActionResult<null>> {
  return runAction('deleteExpense', async () => {
    await repo.deleteExpense(check(uuidSchema, id, INVALID_ID));
    return null;
  });
}

export async function setPaymentReceivedAction(
  id: string,
  received: boolean,
): Promise<ActionResult<null>> {
  return runAction('setPaymentReceived', async () => {
    check(uuidSchema, id, INVALID_ID);
    if (typeof received !== 'boolean') throw new ValidationError('Invalid payment status.');
    await repo.setPaymentReceived(id, received);
    return null;
  });
}

export async function setSplitPaymentReceivedAction(
  expenseId: string,
  position: number,
  received: boolean,
): Promise<ActionResult<null>> {
  return runAction('setSplitPaymentReceived', async () => {
    check(uuidSchema, expenseId, INVALID_ID);
    check(positionSchema, position, 'Invalid split position.');
    if (typeof received !== 'boolean') throw new ValidationError('Invalid payment status.');
    await repo.setSplitPaymentReceived(expenseId, position, received);
    return null;
  });
}
