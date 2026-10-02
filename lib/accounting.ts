import type { Expense } from '@/types/expense';
import { isInMonth } from './dates';
import { isSelf, typeOf } from './person';
import { round2 } from './utils';

export interface MoneyToCollectItem {
  expense: Expense;
  amount: number;
  /** Position in splitDetails when the item is a split share. */
  splitIndex?: number;
}

export interface MoneyToCollectGroup {
  person: string;
  amount: number;
  count: number;
  items: MoneyToCollectItem[];
}

export interface MonthlySummary {
  totalSpentByMe: number;
  totalSpentForOthers: number;
  othersReceived: number;
  othersPending: number;
  totalIncome: number;
  totalDonations: number;
  selfDonations: number;
  pendingDonations: number;
  totalLent: number;
  lentReceived: number;
  lentPending: number;
  pendingSplitShares: number;
  netAmount: number;
  /** What counts against the monthly budget: own spending + own donations. */
  budgetSpent: number;
  moneyToCollect: MoneyToCollectGroup[];
}

export type BudgetLevel = 'ok' | 'warning' | 'over';

export interface BudgetStatus {
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
  /** Percentage clamped to 0..100 for the progress bar. */
  barValue: number;
  level: BudgetLevel;
}

const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));
const amounts = (xs: Expense[]) => sum(xs.map((e) => e.amount));

export function expensesInMonth(expenses: Expense[], month: Date): Expense[] {
  return expenses.filter((e) => isInMonth(e.date, month));
}

export function computeMonthlySummary(allExpenses: Expense[], month: Date): MonthlySummary {
  const expenses = expensesInMonth(allExpenses, month);
  const ofType = (t: string) => expenses.filter((e) => typeOf(e) === t);

  const expenseTx = ofType('expense');
  const income = ofType('income');
  const donations = ofType('donation');
  const lent = ofType('lent');

  const selfExpenses = expenseTx.filter((e) => !e.isSplit && isSelf(e.forWhom));
  const otherExpenses = expenseTx.filter((e) => !e.isSplit && !isSelf(e.forWhom));
  const splitExpenses = expenseTx.filter((e) => e.isSplit && e.splitDetails);

  const selfShares = splitExpenses.flatMap((e) =>
    (e.splitDetails ?? []).filter((s) => isSelf(s.person)).map((s) => s.amount),
  );
  const nonSelfShares = splitExpenses.flatMap((e) =>
    (e.splitDetails ?? []).filter((s) => !isSelf(s.person)),
  );

  const totalSpentByMe = round2(amounts(selfExpenses) + sum(selfShares));
  const totalSpentForOthers = round2(
    amounts(otherExpenses) + sum(nonSelfShares.map((s) => s.amount)),
  );
  const othersReceived = amounts(otherExpenses.filter((e) => e.paymentReceived));
  const othersPending = amounts(otherExpenses.filter((e) => !e.paymentReceived));

  const totalIncome = amounts(income);
  const totalDonations = amounts(donations);
  const selfDonations = amounts(donations.filter((e) => isSelf(e.forWhom)));
  const pendingDonationTx = donations.filter((e) => !isSelf(e.forWhom) && !e.paymentReceived);
  const pendingDonations = amounts(pendingDonationTx);

  const totalLent = amounts(lent);
  const lentReceived = amounts(lent.filter((e) => e.paymentReceived));
  const pendingLentTx = lent.filter((e) => !e.paymentReceived);
  const lentPending = amounts(pendingLentTx);

  const pendingSplitShares = sum(
    nonSelfShares.filter((s) => !s.paymentReceived).map((s) => s.amount),
  );

  const netAmount = round2(
    totalSpentByMe +
      selfDonations +
      pendingDonations +
      othersPending +
      pendingSplitShares +
      lentPending -
      totalIncome,
  );

  const budgetSpent = round2(totalSpentByMe + selfDonations);

  const groups = new Map<string, MoneyToCollectItem[]>();
  const push = (person: string, item: MoneyToCollectItem) => {
    const list = groups.get(person);
    if (list) list.push(item);
    else groups.set(person, [item]);
  };
  otherExpenses
    .filter((e) => !e.paymentReceived)
    .forEach((e) => push(e.forWhom, { expense: e, amount: e.amount }));
  splitExpenses.forEach((e) =>
    (e.splitDetails ?? []).forEach((s, i) => {
      if (!isSelf(s.person) && !s.paymentReceived) {
        push(s.person, { expense: e, amount: s.amount, splitIndex: i });
      }
    }),
  );
  pendingDonationTx.forEach((e) => push(e.forWhom, { expense: e, amount: e.amount }));
  pendingLentTx.forEach((e) => push(e.forWhom, { expense: e, amount: e.amount }));

  const moneyToCollect = [...groups.entries()]
    .map(([person, items]) => ({
      person,
      amount: sum(items.map((i) => i.amount)),
      count: items.length,
      items: [...items].sort((a, b) => b.expense.date.getTime() - a.expense.date.getTime()),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalSpentByMe,
    totalSpentForOthers,
    othersReceived,
    othersPending,
    totalIncome,
    totalDonations,
    selfDonations,
    pendingDonations,
    totalLent,
    lentReceived,
    lentPending,
    pendingSplitShares,
    netAmount,
    budgetSpent,
    moneyToCollect,
  };
}

export function computeBudgetStatus(budget: number, spent: number): BudgetStatus {
  const remaining = round2(budget - spent);
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const level: BudgetLevel = percentage >= 100 ? 'over' : percentage >= 80 ? 'warning' : 'ok';
  return {
    budget,
    spent,
    remaining,
    percentage,
    barValue: Math.max(0, Math.min(percentage, 100)),
    level,
  };
}

/** Footer total: sum of expenses (split parents at full amount) + lent - income. Donations excluded. */
export function listTotal(rows: Expense[]): number {
  return round2(
    rows.reduce((acc, e) => {
      const t = typeOf(e);
      if (t === 'expense' || t === 'lent') return acc + e.amount;
      if (t === 'income') return acc - e.amount;
      return acc;
    }, 0),
  );
}
