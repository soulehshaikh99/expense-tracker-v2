import { describe, expect, it } from 'vitest';
import {
  autoLastAmount,
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

  it('auto-calculates the last row, never negative', () => {
    expect(autoLastAmount(300, [{ amount: 100 }, { amount: 50 }, { amount: 0 }])).toBe(150);
    expect(autoLastAmount(100, [{ amount: 150 }, { amount: 0 }])).toBe(0);
    expect(autoLastAmount(Number.NaN, [{ amount: 1 }, { amount: 0 }])).toBe(0);
    expect(autoLastAmount(10, [{ amount: Number.NaN }, { amount: 0 }])).toBe(10);
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
