import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { value: undefined as string | undefined };
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'auth-session' && cookieStore.value !== undefined ? { name, value: cookieStore.value } : undefined,
  }),
}));

// Any database access in these tests is a bug: the session check must run first.
const dbTouched = vi.fn();
vi.mock('@/lib/db', () => ({
  db: new Proxy(
    {},
    {
      get() {
        dbTouched();
        throw new Error('db must not be reached without a session');
      },
    },
  ),
}));

import * as expenseActions from '@/app/actions/expenses';
import * as budgetActions from '@/app/actions/budgets';
import { signSession } from '@/lib/session';
import type { ExpenseInput } from '@/types/dto';

const ID = '00000000-0000-4000-8000-000000000000';
const input: ExpenseInput = {
  title: 'x',
  amount: 1,
  paymentMode: 'UPI',
  forWhom: 'Self',
  date: '2025-03-01',
  transactionType: 'expense',
  paymentReceived: false,
  paymentReceivedAt: null,
  isSplit: false,
  splitDetails: null,
  category: null,
};

const calls: [string, () => Promise<unknown>][] = [
  ['listExpensesAction', () => expenseActions.listExpensesAction()],
  ['createExpenseAction', () => expenseActions.createExpenseAction(input)],
  ['updateExpenseAction', () => expenseActions.updateExpenseAction(ID, input)],
  ['deleteExpenseAction', () => expenseActions.deleteExpenseAction(ID)],
  ['setPaymentReceivedAction', () => expenseActions.setPaymentReceivedAction(ID, true)],
  ['setSplitPaymentReceivedAction', () => expenseActions.setSplitPaymentReceivedAction(ID, 1, true)],
  ['listBudgetsAction', () => budgetActions.listBudgetsAction()],
  ['upsertBudgetAction', () => budgetActions.upsertBudgetAction('2025-03-01', 100)],
  ['deleteBudgetAction', () => budgetActions.deleteBudgetAction(ID)],
];

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-characters-long');
  cookieStore.value = undefined;
  dbTouched.mockClear();
});

describe('Server Actions without a valid session', () => {
  it('covers every exported action', () => {
    const exported = [...Object.keys(expenseActions), ...Object.keys(budgetActions)].sort();
    expect(calls.map(([n]) => n).sort()).toEqual(exported);
  });

  for (const [name, call] of calls) {
    it(`${name} returns unauthorized with no cookie or a forged cookie`, async () => {
      expect(await call()).toMatchObject({ ok: false, code: 'unauthorized' });
      cookieStore.value = 'forged.token.value';
      expect(await call()).toMatchObject({ ok: false, code: 'unauthorized' });
      expect(dbTouched).not.toHaveBeenCalled();
    });
  }
});

describe('Server Actions argument validation (with a session)', () => {
  beforeEach(async () => {
    cookieStore.value = await signSession();
  });

  it('rejects non-UUID ids and bad positions before touching the db', async () => {
    expect(await expenseActions.deleteExpenseAction('1')).toMatchObject({ ok: false, code: 'validation' });
    expect(await expenseActions.updateExpenseAction('abc', input)).toMatchObject({ ok: false, code: 'validation' });
    expect(await expenseActions.setSplitPaymentReceivedAction(ID, -1, true)).toMatchObject({
      ok: false,
      code: 'validation',
    });
    expect(await expenseActions.setSplitPaymentReceivedAction(ID, 1.5, true)).toMatchObject({
      ok: false,
      code: 'validation',
    });
    expect(await budgetActions.deleteBudgetAction('nope')).toMatchObject({ ok: false, code: 'validation' });
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it('rejects invalid expense and budget input before touching the db', async () => {
    expect(await expenseActions.createExpenseAction({ ...input, amount: 0 })).toMatchObject({
      ok: false,
      code: 'validation',
    });
    expect(await expenseActions.createExpenseAction({ ...input, transactionType: 'lent' })).toMatchObject({
      ok: false,
      code: 'validation',
    });
    expect(await budgetActions.upsertBudgetAction('2025-03-15', 100)).toMatchObject({
      ok: false,
      code: 'validation',
    });
    expect(dbTouched).not.toHaveBeenCalled();
  });
});
