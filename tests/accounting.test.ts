import { describe, expect, it } from 'vitest';
import { computeBudgetStatus, computeMonthlySummary, listTotal } from '@/lib/accounting';
import { d, makeExpense as e } from './helpers';

const MARCH = d(2025, 3, 1);

describe('computeMonthlySummary', () => {
  it('returns zeros for an empty month', () => {
    const s = computeMonthlySummary([e({ date: d(2025, 4, 1) })], MARCH);
    expect(s.totalSpentByMe).toBe(0);
    expect(s.totalSpentForOthers).toBe(0);
    expect(s.netAmount).toBe(0);
    expect(s.moneyToCollect).toEqual([]);
  });

  it('includes first and last day, excludes neighbours', () => {
    const rows = [
      e({ amount: 10, date: d(2025, 3, 1) }),
      e({ amount: 20, date: d(2025, 3, 31) }),
      e({ amount: 40, date: d(2025, 2, 28) }),
      e({ amount: 80, date: d(2025, 4, 1) }),
    ];
    expect(computeMonthlySummary(rows, MARCH).totalSpentByMe).toBe(30);
  });

  it('treats missing transactionType as expense and lowercase self as Self', () => {
    const rows = [e({ amount: 50, forWhom: 'self' }), e({ amount: 25, transactionType: undefined })];
    const s = computeMonthlySummary(rows, MARCH);
    expect(s.totalSpentByMe).toBe(75);
    expect(s.totalSpentForOthers).toBe(0);
  });

  it('computes other expenses received and pending', () => {
    const rows = [
      e({ amount: 100, forWhom: 'Rahul', paymentReceived: true }),
      e({ amount: 60, forWhom: 'Rahul' }),
      e({ amount: 40, forWhom: 'Asha', paymentReceived: false }),
    ];
    const s = computeMonthlySummary(rows, MARCH);
    expect(s.totalSpentForOthers).toBe(200);
    expect(s.othersReceived).toBe(100);
    expect(s.othersPending).toBe(100);
  });

  it('computes split shares with partial receipts', () => {
    const split = e({
      amount: 300,
      forWhom: 'Split',
      isSplit: true,
      splitDetails: [
        { person: 'self', amount: 100 },
        { person: 'Rahul', amount: 100, paymentReceived: true },
        { person: 'Asha', amount: 100, paymentReceived: false },
      ],
    });
    const s = computeMonthlySummary([split], MARCH);
    expect(s.totalSpentByMe).toBe(100);
    expect(s.totalSpentForOthers).toBe(200);
    expect(s.pendingSplitShares).toBe(100);
    expect(s.othersPending).toBe(0);
    expect(s.netAmount).toBe(200);
    expect(s.moneyToCollect).toEqual([
      { person: 'Asha', amount: 100, count: 1, items: [{ expense: split, amount: 100, splitIndex: 2 }] },
    ]);
  });

  it('computes income, donations and lent', () => {
    const rows = [
      e({ amount: 1000, transactionType: 'income', forWhom: 'Boss' }),
      e({ amount: 50, transactionType: 'donation', forWhom: 'Self' }),
      e({ amount: 70, transactionType: 'donation', forWhom: 'Temple' }),
      e({ amount: 30, transactionType: 'donation', forWhom: 'Asha', paymentReceived: true }),
      e({ amount: 500, transactionType: 'lent', forWhom: 'Rahul' }),
      e({ amount: 200, transactionType: 'lent', forWhom: 'Asha', paymentReceived: true }),
    ];
    const s = computeMonthlySummary(rows, MARCH);
    expect(s.totalIncome).toBe(1000);
    expect(s.totalDonations).toBe(150);
    expect(s.selfDonations).toBe(50);
    expect(s.pendingDonations).toBe(70);
    expect(s.totalLent).toBe(700);
    expect(s.lentReceived).toBe(200);
    expect(s.lentPending).toBe(500);
    // net = me 0 + selfDon 50 + pendingDon 70 + othersPending 0 + splits 0 + lentPending 500 - income 1000
    expect(s.netAmount).toBe(-380);
  });

  it('net amount follows the full formula', () => {
    const rows = [
      e({ amount: 1000 }), // self
      e({ amount: 200, forWhom: 'Rahul' }), // othersPending
      e({ amount: 100, forWhom: 'Rahul', paymentReceived: true }),
      e({
        amount: 90,
        forWhom: 'Split',
        isSplit: true,
        splitDetails: [
          { person: 'Self', amount: 30 },
          { person: 'Asha', amount: 30 },
          { person: 'Ravi', amount: 30, paymentReceived: true },
        ],
      }),
      e({ amount: 40, transactionType: 'donation' }), // self donation
      e({ amount: 60, transactionType: 'donation', forWhom: 'NGO' }), // pending donation
      e({ amount: 500, transactionType: 'lent', forWhom: 'Ravi' }),
      e({ amount: 300, transactionType: 'income', forWhom: 'Client' }),
    ];
    const s = computeMonthlySummary(rows, MARCH);
    expect(s.totalSpentByMe).toBe(1030);
    expect(s.pendingSplitShares).toBe(30);
    expect(s.netAmount).toBe(1030 + 40 + 60 + 200 + 30 + 500 - 300);
  });

  it('groups money to collect by person, sorted by amount and date', () => {
    const older = e({ amount: 50, forWhom: 'Rahul', date: d(2025, 3, 2) });
    const newer = e({ amount: 20, forWhom: 'Rahul', date: d(2025, 3, 20) });
    const lent = e({ amount: 500, forWhom: 'Asha', transactionType: 'lent', date: d(2025, 3, 5) });
    const don = e({ amount: 10, forWhom: 'Ravi', transactionType: 'donation' });
    const income = e({ amount: 999, forWhom: 'Boss', transactionType: 'income' });
    const s = computeMonthlySummary([older, newer, lent, don, income], MARCH);
    expect(s.moneyToCollect.map((g) => [g.person, g.amount, g.count])).toEqual([
      ['Asha', 500, 1],
      ['Rahul', 70, 2],
      ['Ravi', 10, 1],
    ]);
    expect(s.moneyToCollect[1].items.map((i) => i.expense)).toEqual([newer, older]);
  });
});

describe('computeBudgetStatus', () => {
  it('uses the colour thresholds', () => {
    expect(computeBudgetStatus(1000, 799).level).toBe('ok');
    expect(computeBudgetStatus(1000, 800).level).toBe('warning');
    expect(computeBudgetStatus(1000, 999.99).level).toBe('warning');
    expect(computeBudgetStatus(1000, 1000).level).toBe('over');
  });

  it('caps the bar and reports remaining / over', () => {
    const over = computeBudgetStatus(1000, 1250);
    expect(over.remaining).toBe(-250);
    expect(over.percentage).toBe(125);
    expect(over.barValue).toBe(100);
    const under = computeBudgetStatus(1000, -50);
    expect(under.barValue).toBe(0);
    expect(under.remaining).toBe(1050);
  });
});

describe('listTotal', () => {
  it('adds expenses and lent, subtracts income, ignores donations', () => {
    const rows = [
      e({ amount: 100 }),
      e({ amount: 300, isSplit: true, forWhom: 'Split', splitDetails: [] }),
      e({ amount: 50, transactionType: 'lent', forWhom: 'R' }),
      e({ amount: 70, transactionType: 'income', forWhom: 'R' }),
      e({ amount: 999, transactionType: 'donation' }),
      e({ amount: 1, transactionType: undefined }),
    ];
    expect(listTotal(rows)).toBe(381);
    expect(listTotal([])).toBe(0);
  });
});
