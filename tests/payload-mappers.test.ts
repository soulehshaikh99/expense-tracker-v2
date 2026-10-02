import { describe, expect, it } from 'vitest';
import { buildExpenseInput, normalizeExpenseInput } from '@/lib/expense-payload';
import { budgetFromDTO, expenseFromDTO, expenseToInput } from '@/lib/mappers';
import { defaultExpenseFormValues, type ExpenseFormValues } from '@/lib/validation/expense';
import type { ExpenseDTO, ExpenseInput } from '@/types/dto';
import { d, makeExpense, TIMEZONES, withTZ } from './helpers';

const NOW = new Date('2025-03-20T12:00:00.000Z');
const EARLIER = new Date('2025-03-02T08:00:00.000Z');

const form = (p: Partial<ExpenseFormValues>): ExpenseFormValues => ({
  ...defaultExpenseFormValues(d(2025, 3, 15)),
  title: '  Lunch ',
  amount: 300,
  ...p,
});

describe('buildExpenseInput', () => {
  it('normalizes and trims a regular self expense', () => {
    const input = buildExpenseInput(form({ forWhom: ' self ', category: '  ' }), undefined, NOW);
    expect(input).toMatchObject({
      title: 'Lunch',
      forWhom: 'Self',
      date: '2025-03-15',
      paymentReceived: false,
      paymentReceivedAt: null,
      isSplit: false,
      splitDetails: null,
      category: null,
    });
  });

  it('drops paymentReceived when it does not apply', () => {
    const input = buildExpenseInput(
      form({ transactionType: 'income', forWhom: 'Boss', paymentReceived: true }),
      undefined,
      NOW,
    );
    expect(input.paymentReceived).toBe(false);
    expect(input.paymentReceivedAt).toBeNull();
  });

  it('sets received date to now on first check, keeps it on later edits', () => {
    const created = buildExpenseInput(form({ forWhom: 'Rahul', paymentReceived: true }), undefined, NOW);
    expect(created.paymentReceivedAt).toBe(NOW.toISOString());

    const existing = makeExpense({ forWhom: 'Rahul', paymentReceived: true, paymentReceivedDate: EARLIER });
    const edited = buildExpenseInput(form({ forWhom: 'Rahul', paymentReceived: true }), existing, NOW);
    expect(edited.paymentReceivedAt).toBe(EARLIER.toISOString());

    const notYet = makeExpense({ forWhom: 'Rahul', paymentReceived: false });
    expect(buildExpenseInput(form({ forWhom: 'Rahul', paymentReceived: true }), notYet, NOW).paymentReceivedAt).toBe(
      NOW.toISOString(),
    );
  });

  it('builds split payload: forWhom Split, names normalized, dates preserved per person', () => {
    const existing = makeExpense({
      isSplit: true,
      forWhom: 'Split',
      splitDetails: [
        { person: 'Self', amount: 100 },
        { person: 'Asha', amount: 100, paymentReceived: true, paymentReceivedDate: EARLIER },
        { person: 'Ravi', amount: 100 },
      ],
    });
    const input = buildExpenseInput(
      form({
        isSplit: true,
        forWhom: '',
        splitDetails: [
          { person: 'self', amount: 100, paymentReceived: true },
          { person: ' Ravi ', amount: 100, paymentReceived: true },
          { person: 'asha', amount: 100, paymentReceived: true },
        ],
      }),
      existing,
      NOW,
    );
    expect(input.forWhom).toBe('Split');
    expect(input.paymentReceived).toBe(false);
    expect(input.splitDetails).toEqual([
      { person: 'Self', amount: 100, paymentReceived: false, paymentReceivedAt: null },
      { person: 'Ravi', amount: 100, paymentReceived: true, paymentReceivedAt: NOW.toISOString() },
      { person: 'asha', amount: 100, paymentReceived: true, paymentReceivedAt: EARLIER.toISOString() },
    ]);
  });

  it('ignores split for non-expense types', () => {
    const input = buildExpenseInput(
      form({ transactionType: 'donation', isSplit: true, forWhom: 'NGO' }),
      undefined,
      NOW,
    );
    expect(input.isSplit).toBe(false);
    expect(input.splitDetails).toBeNull();
    expect(input.forWhom).toBe('NGO');
  });
});

describe('normalizeExpenseInput', () => {
  const base: ExpenseInput = {
    title: ' x ',
    amount: 10,
    paymentMode: 'Cash',
    forWhom: 'self',
    date: '2025-03-01',
    transactionType: 'expense',
    paymentReceived: true,
    paymentReceivedAt: NOW.toISOString(),
    isSplit: false,
    splitDetails: [],
    category: '  ',
  };

  it('enforces invariants', () => {
    expect(normalizeExpenseInput(base, NOW)).toMatchObject({
      title: 'x',
      forWhom: 'Self',
      paymentReceived: false,
      paymentReceivedAt: null,
      splitDetails: null,
      category: null,
    });
  });

  it('fills missing received instants with now and clears self shares', () => {
    const out = normalizeExpenseInput(
      {
        ...base,
        isSplit: true,
        splitDetails: [
          { person: 'self', amount: 5, paymentReceived: true, paymentReceivedAt: null },
          { person: 'A', amount: 5, paymentReceived: true, paymentReceivedAt: null },
        ],
      },
      NOW,
    );
    expect(out.forWhom).toBe('Split');
    expect(out.splitDetails).toEqual([
      { person: 'Self', amount: 5, paymentReceived: false, paymentReceivedAt: null },
      { person: 'A', amount: 5, paymentReceived: true, paymentReceivedAt: NOW.toISOString() },
    ]);
  });
});

describe('mappers', () => {
  const dto: ExpenseDTO = {
    id: 'abc',
    title: 'Dinner',
    amount: 450.5,
    paymentMode: 'UPI',
    forWhom: 'Split',
    date: '2025-03-31',
    transactionType: 'expense',
    paymentReceived: false,
    paymentReceivedAt: null,
    isSplit: true,
    splitDetails: [
      { person: 'self', amount: 225.25, paymentReceived: false, paymentReceivedAt: null },
      { person: 'Asha', amount: 225.25, paymentReceived: true, paymentReceivedAt: '2025-04-01T03:00:00.000Z' },
    ],
    category: null,
  };

  for (const tz of TIMEZONES) {
    it(`DTO ↔ domain keeps the calendar date in ${tz}`, () => {
      withTZ(tz, () => {
        const e = expenseFromDTO(dto);
        expect(e.date.getFullYear()).toBe(2025);
        expect(e.date.getMonth()).toBe(2);
        expect(e.date.getDate()).toBe(31);
        expect(e.splitDetails?.[0].person).toBe('Self');
        expect(e.splitDetails?.[1].paymentReceivedDate?.toISOString()).toBe('2025-04-01T03:00:00.000Z');
        expect(e.category).toBeUndefined();

        const back = expenseToInput(e);
        expect(back.date).toBe('2025-03-31');
        expect(back.splitDetails?.[1].paymentReceivedAt).toBe('2025-04-01T03:00:00.000Z');

        const b = budgetFromDTO({
          id: 'b',
          month: '2025-04-01',
          amount: 5000,
          createdAt: '2025-03-31T18:30:00.000Z',
          updatedAt: '2025-03-31T18:30:00.000Z',
        });
        expect([b.month.getFullYear(), b.month.getMonth(), b.month.getDate()]).toEqual([2025, 3, 1]);
      });
    });
  }

  it('maps non-split DTO with null splits to undefined', () => {
    const e = expenseFromDTO({ ...dto, isSplit: false, forWhom: 'Rahul', splitDetails: null, category: 'Food' });
    expect(e.splitDetails).toBeUndefined();
    expect(e.category).toBe('Food');
    expect(expenseToInput(e).splitDetails).toBeNull();
  });
});
