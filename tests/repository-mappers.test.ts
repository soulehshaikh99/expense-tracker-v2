import { describe, expect, it } from 'vitest';
import {
  budgetRowToDTO,
  expenseRowToDTO,
  expenseValues,
  splitValues,
  type ExpenseRow,
  type SplitRow,
} from '@/lib/repositories/mappers';
import type { ExpenseInput } from '@/types/dto';

const created = new Date('2025-03-01T10:00:00.000Z');

const row: ExpenseRow = {
  id: 'e1',
  title: 'Dinner',
  amount: '450.50',
  paymentMode: 'UPI',
  forWhom: 'Split',
  date: '2025-03-31',
  transactionType: 'expense',
  paymentReceived: false,
  paymentReceivedAt: null,
  isSplit: true,
  category: null,
  legacyFirestoreId: null,
  createdAt: created,
  updatedAt: created,
};

const split = (position: number, person: string, at: Date | null = null): SplitRow => ({
  id: `s${position}`,
  expenseId: 'e1',
  position,
  person,
  amount: '225.25',
  paymentReceived: at !== null,
  paymentReceivedAt: at,
});

describe('repository mappers', () => {
  it('maps numeric strings to numbers, orders splits, keeps date strings', () => {
    const dto = expenseRowToDTO(row, [split(1, 'Asha', created), split(0, 'Self')]);
    expect(dto.amount).toBe(450.5);
    expect(dto.date).toBe('2025-03-31');
    expect(dto.splitDetails).toEqual([
      { person: 'Self', amount: 225.25, paymentReceived: false, paymentReceivedAt: null },
      { person: 'Asha', amount: 225.25, paymentReceived: true, paymentReceivedAt: created.toISOString() },
    ]);
  });

  it('returns null splitDetails for non-split rows', () => {
    expect(expenseRowToDTO({ ...row, isSplit: false, forWhom: 'Self' }, []).splitDetails).toBeNull();
  });

  it('writes amounts with two decimals and positions by index', () => {
    const input: ExpenseInput = {
      title: 't',
      amount: 10,
      paymentMode: 'Cash',
      forWhom: 'Split',
      date: '2025-03-01',
      transactionType: 'expense',
      paymentReceived: false,
      paymentReceivedAt: null,
      isSplit: true,
      splitDetails: [
        { person: 'Self', amount: 5, paymentReceived: false, paymentReceivedAt: null },
        { person: 'A', amount: 5, paymentReceived: true, paymentReceivedAt: created.toISOString() },
      ],
      category: null,
    };
    expect(expenseValues(input).amount).toBe('10.00');
    expect(splitValues('e1', input).map((s) => [s.position, s.amount, s.paymentReceivedAt])).toEqual([
      [0, '5.00', null],
      [1, '5.00', created],
    ]);
  });

  it('maps budget rows', () => {
    expect(
      budgetRowToDTO({
        id: 'b',
        month: '2025-04-01',
        amount: '5000.00',
        legacyFirestoreId: null,
        createdAt: created,
        updatedAt: created,
      }),
    ).toEqual({
      id: 'b',
      month: '2025-04-01',
      amount: 5000,
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    });
  });
});
