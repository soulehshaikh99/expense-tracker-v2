import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
  hasActiveFilters,
  splitStatus,
  type ExpenseFilters,
} from '@/lib/filters';
import { d, makeExpense as e } from './helpers';

const MARCH = d(2025, 3, 1);
const f = (p: Partial<ExpenseFilters>): ExpenseFilters => ({ ...DEFAULT_FILTERS, ...p });

const split = (received: boolean[]) =>
  e({
    amount: 30 * (received.length + 1),
    forWhom: 'Split',
    isSplit: true,
    splitDetails: [
      { person: 'Self', amount: 30 },
      ...received.map((r, i) => ({ person: `P${i}`, amount: 30, paymentReceived: r })),
    ],
  });

describe('applyFilters', () => {
  const selfExp = e({ forWhom: 'Self', paymentMode: 'Cash', category: 'Food' });
  const otherPending = e({ forWhom: 'Rahul', paymentMode: 'UPI', category: 'Bills' });
  const otherReceived = e({ forWhom: 'Rahul', paymentReceived: true });
  const income = e({ transactionType: 'income', forWhom: 'Boss' });
  const donationPending = e({ transactionType: 'donation', forWhom: 'NGO' });
  const donationSelf = e({ transactionType: 'donation', forWhom: 'Self' });
  const lentReceived = e({ transactionType: 'lent', forWhom: 'Asha', paymentReceived: true });
  const splitAll = split([true, true]);
  const splitPartial = split([true, false]);
  const april = e({ date: d(2025, 4, 1) });
  const all = [
    selfExp,
    otherPending,
    otherReceived,
    income,
    donationPending,
    donationSelf,
    lentReceived,
    splitAll,
    splitPartial,
    april,
  ];

  it('filters by month only by default', () => {
    expect(applyFilters(all, MARCH, DEFAULT_FILTERS)).not.toContain(april);
    expect(applyFilters(all, MARCH, DEFAULT_FILTERS)).toHaveLength(all.length - 1);
  });

  it('filters by type, treating missing type as expense', () => {
    const r = applyFilters(all, MARCH, f({ types: ['income', 'lent'] }));
    expect(r).toEqual([income, lentReceived]);
  });

  it('filters by payment mode, person and category', () => {
    expect(applyFilters(all, MARCH, f({ paymentModes: ['Cash'] }))).toEqual([selfExp]);
    expect(applyFilters(all, MARCH, f({ persons: ['Rahul'] }))).toEqual([otherPending, otherReceived]);
    expect(applyFilters(all, MARCH, f({ categories: ['Food', 'Bills'] }))).toEqual([selfExp, otherPending]);
  });

  it('payment status Received includes donations, lent and fully received splits', () => {
    expect(applyFilters(all, MARCH, f({ paymentStatus: 'Received' }))).toEqual([
      otherReceived,
      lentReceived,
      splitAll,
    ]);
  });

  it('payment status Pending includes pending donations and partial splits', () => {
    expect(applyFilters(all, MARCH, f({ paymentStatus: 'Pending' }))).toEqual([
      otherPending,
      donationPending,
      splitPartial,
    ]);
  });

  it('combines filters', () => {
    const r = applyFilters(all, MARCH, f({ persons: ['Rahul'], paymentStatus: 'Pending' }));
    expect(r).toEqual([otherPending]);
  });
});

describe('splitStatus', () => {
  it('derives status from non-self shares', () => {
    expect(splitStatus(split([true, true]))).toBe('received');
    expect(splitStatus(split([true, false]))).toBe('partial');
    expect(splitStatus(split([false, false]))).toBe('pending');
  });
});

describe('active filters', () => {
  it('counts non-All filters', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters(f({ types: ['expense'], paymentStatus: 'Pending' }))).toBe(2);
  });

  it('treats a non-current month as active', () => {
    const now = d(2025, 3, 15);
    expect(hasActiveFilters(DEFAULT_FILTERS, d(2025, 3, 1), now)).toBe(false);
    expect(hasActiveFilters(DEFAULT_FILTERS, d(2025, 2, 1), now)).toBe(true);
    expect(hasActiveFilters(f({ persons: ['A'] }), d(2025, 3, 1), now)).toBe(true);
  });
});
