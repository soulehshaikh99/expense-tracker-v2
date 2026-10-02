'use server';

import { check, runAction } from '@/lib/action-result';
import * as repo from '@/lib/repositories/budgets';
import { uuidSchema } from '@/lib/validation/expense';
import type { ActionResult, BudgetDTO } from '@/types/dto';

export async function listBudgetsAction(): Promise<ActionResult<BudgetDTO[]>> {
  return runAction('listBudgets', () => repo.listBudgets());
}

export async function upsertBudgetAction(month: string, amount: number): Promise<ActionResult<BudgetDTO>> {
  return runAction('upsertBudget', () => repo.upsertBudget(month, amount));
}

export async function deleteBudgetAction(id: string): Promise<ActionResult<null>> {
  return runAction('deleteBudget', async () => {
    await repo.deleteBudget(check(uuidSchema, id, 'Invalid budget id.'));
    return null;
  });
}
