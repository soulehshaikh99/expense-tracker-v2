import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/lib/db';
import { expenses, expenseSplits } from '@/lib/db/schema';
import { normalizeExpenseInput } from '@/lib/expense-payload';
import { canHavePaymentStatus, isSelf } from '@/lib/person';
import { expenseInputSchema } from '@/lib/validation/expense';
import type { ExpenseDTO, ExpenseInput } from '@/types/dto';
import { firstIssue, NotFoundError, ValidationError } from './errors';
import { expenseRowToDTO, expenseValues, splitValues, type ExpenseRow, type SplitRow } from './mappers';

type Batch = [BatchItem<'pg'>, ...BatchItem<'pg'>[]];

function validate(input: unknown): ExpenseInput {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
  return normalizeExpenseInput(parsed.data);
}

function isForeignKeyViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === '23503' || e?.cause?.code === '23503';
}

export async function listExpenses(): Promise<ExpenseDTO[]> {
  const rows = await db.query.expenses.findMany({
    with: { splits: { orderBy: (s, { asc }) => [asc(s.position)] } },
    orderBy: (e, { desc }) => [desc(e.date), desc(e.createdAt)],
  });
  return rows.map(({ splits, ...row }) => expenseRowToDTO(row, splits));
}

export async function createExpense(raw: ExpenseInput): Promise<ExpenseDTO> {
  const input = validate(raw);
  const id = crypto.randomUUID();
  const insertExpense = db
    .insert(expenses)
    .values({ id, ...expenseValues(input) })
    .returning();

  if (!input.isSplit) {
    const [row] = await insertExpense;
    return expenseRowToDTO(row, []);
  }

  const [expenseRows, splitRows] = await db.batch([
    insertExpense,
    db.insert(expenseSplits).values(splitValues(id, input)).returning(),
  ]);
  return expenseRowToDTO(expenseRows[0], splitRows);
}

export async function updateExpense(id: string, raw: ExpenseInput): Promise<ExpenseDTO> {
  const input = validate(raw);
  const queries: BatchItem<'pg'>[] = [
    db
      .update(expenses)
      .set({ ...expenseValues(input), updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning(),
    db.delete(expenseSplits).where(eq(expenseSplits.expenseId, id)),
  ];
  if (input.isSplit) {
    queries.push(db.insert(expenseSplits).values(splitValues(id, input)).returning());
  }

  let results: unknown[];
  try {
    results = await db.batch(queries as Batch);
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new NotFoundError('Transaction not found.');
    throw error;
  }

  const [row] = results[0] as ExpenseRow[];
  if (!row) throw new NotFoundError('Transaction not found.');
  const splits = input.isSplit ? (results[2] as SplitRow[]) : [];
  return expenseRowToDTO(row, splits);
}

export async function deleteExpense(id: string): Promise<void> {
  const rows = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
  if (rows.length === 0) throw new NotFoundError('Transaction not found.');
}

export async function setPaymentReceived(id: string, received: boolean): Promise<void> {
  const [row] = await db
    .select({
      isSplit: expenses.isSplit,
      forWhom: expenses.forWhom,
      transactionType: expenses.transactionType,
    })
    .from(expenses)
    .where(eq(expenses.id, id));
  if (!row) throw new NotFoundError('Transaction not found.');
  if (!canHavePaymentStatus(row)) {
    throw new ValidationError('Payment status does not apply to this transaction.');
  }

  const now = new Date();
  await db
    .update(expenses)
    .set({ paymentReceived: received, paymentReceivedAt: received ? now : null, updatedAt: now })
    .where(eq(expenses.id, id));
}

export async function setSplitPaymentReceived(
  expenseId: string,
  position: number,
  received: boolean,
): Promise<void> {
  const where = and(eq(expenseSplits.expenseId, expenseId), eq(expenseSplits.position, position));
  const [split] = await db.select({ person: expenseSplits.person }).from(expenseSplits).where(where);
  if (!split) throw new NotFoundError('Split share not found.');
  if (isSelf(split.person)) throw new ValidationError('Your own share has no payment status.');

  const now = new Date();
  await db.batch([
    db
      .update(expenseSplits)
      .set({ paymentReceived: received, paymentReceivedAt: received ? now : null })
      .where(where),
    db.update(expenses).set({ updatedAt: now }).where(eq(expenses.id, expenseId)),
  ]);
}
