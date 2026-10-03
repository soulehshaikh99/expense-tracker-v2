import { describe, expect, it } from 'vitest';
import {
  autoBalanceAmount,
  equalSplitAmounts,
  formValuesFromExpense,
  initialSplitRows,
  splitRowsHaveData,
} from '@/lib/expense-payload';
import { paymentReceivedLabel, TYPE_LABELS } from '@/lib/expense-labels';
import { d, makeExpense } from './helpers';

describe('split form helpers', () => {
  it('starts with Self and an empty row, dividing the amount', () => {
    expect(initialSplitRows(Number.NaN)).toEqual([
      { person: 'Self', amount: 0, paymentReceived: false },
      { person: '', amount: 0, paymentReceived: false },
    ]);
    expect(initialSplitRows(100.01).map((r) => r.amount)).toEqual([50.01, 50]);
    expect(initialSplitRows(300).map((r) => r.amount)).toEqual([150, 150]);
  });

  it('auto-calculates the balance row, never negative', () => {
    expect(autoBalanceAmount(300, [{ amount: 100 }, { amount: 50 }, { amount: 0 }], 2)).toBe(150);
    expect(autoBalanceAmount(100, [{ amount: 150 }, { amount: 0 }], 1)).toBe(0);
    expect(autoBalanceAmount(Number.NaN, [{ amount: 1 }, { amount: 0 }], 1)).toBe(0);
    expect(autoBalanceAmount(10, [{ amount: Number.NaN }, { amount: 0 }], 1)).toBe(10);
  });

  it('auto-calculates Self when only the other shares are known', () => {
    expect(autoBalanceAmount(500, [{ amount: 0 }, { amount: 180 }], 0)).toBe(320);
    expect(autoBalanceAmount(500, [{ amount: 999 }, { amount: 180 }, { amount: 120 }], 0)).toBe(200);
    expect(autoBalanceAmount(500, [{ amount: 0 }], 3)).toBe(0);
  });

  it('splits equally with the remainder on the balance row', () => {
    expect(equalSplitAmounts(100, 3, 0)).toEqual([33.34, 33.33, 33.33]);
    expect(equalSplitAmounts(100, 3, 2)).toEqual([33.33, 33.33, 33.34]);
    expect(equalSplitAmounts(Number.NaN, 2, 0)).toEqual([0, 0]);
  });

  it('detects split data worth confirming', () => {
    expect(splitRowsHaveData(initialSplitRows(Number.NaN))).toBe(false);
    expect(splitRowsHaveData([{ person: 'Self', amount: 0 }, { person: 'Asha', amount: 0 }])).toBe(true);
    expect(splitRowsHaveData([{ person: 'Self', amount: 5 }, { person: '', amount: 0 }])).toBe(true);
  });

  it('pre-fills form values from a record', () => {
    const split = makeExpense({
      isSplit: true,
      forWhom: 'Split',
      date: d(2025, 3, 31),
      splitDetails: [
        { person: 'Self', amount: 50 },
        { person: 'Asha', amount: 50, paymentReceived: true },
      ],
    });
    expect(formValuesFromExpense(split)).toMatchObject({
      transactionType: 'expense',
      forWhom: '',
      isSplit: true,
      category: '',
      splitDetails: [
        { person: 'Self', amount: 50, paymentReceived: false },
        { person: 'Asha', amount: 50, paymentReceived: true },
      ],
    });
  });
});

describe('labels', () => {
  it('match the plan copy', () => {
    expect(TYPE_LABELS.lent).toEqual({ title: 'Money Lent Title', person: 'To Whom', personPlaceholder: "Person's name" });
    expect(TYPE_LABELS.income.person).toBe('From Whom');
    expect(paymentReceivedLabel('lent', 'Asha')).toBe('Money received back from Asha');
    expect(paymentReceivedLabel('donation', 'NGO')).toBe('Payment received from NGO');
  });
});
