import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgets } from '@/lib/db/schema';
import { budgetInputSchema } from '@/lib/validation/budget';
import type { BudgetDTO } from '@/types/dto';
import { firstIssue, NotFoundError, ValidationError } from './errors';
import { budgetRowToDTO } from './mappers';

export async function listBudgets(): Promise<BudgetDTO[]> {
  const rows = await db.select().from(budgets).orderBy(desc(budgets.month));
  return rows.map(budgetRowToDTO);
}

export async function upsertBudget(month: string, amount: number): Promise<BudgetDTO> {
  const parsed = budgetInputSchema.safeParse({ month, amount });
  if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

  const now = new Date();
  const value = parsed.data.amount.toFixed(2);
  const [row] = await db
    .insert(budgets)
    .values({ month: parsed.data.month, amount: value })
    .onConflictDoUpdate({ target: budgets.month, set: { amount: value, updatedAt: now } })
    .returning();
  return budgetRowToDTO(row);
}

export async function deleteBudget(id: string): Promise<void> {
  const rows = await db.delete(budgets).where(eq(budgets.id, id)).returning({ id: budgets.id });
  if (rows.length === 0) throw new NotFoundError('Budget not found.');
}
