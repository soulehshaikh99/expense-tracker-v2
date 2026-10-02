import { describe, expect, it } from 'vitest';
import {
  budgetMonth,
  checksums,
  expenseCalendarDate,
  paiseToFixed,
  transformBudgets,
  transformExpense,
  type RawDoc,
} from '@/scripts/import-firestore/transform';

const ts = (iso: string) => ({ toDate: () => new Date(iso) });
const TZ = 'Asia/Kolkata';

const doc = (data: Record<string, unknown>, id = 'doc1'): RawDoc => ({
  id,
  data: { title: 'Lunch', amount: 250, paymentMode: 'UPI', forWhom: 'Self', date: ts('2025-03-31T00:00:00.000Z'), ...data },
});

describe('dates', () => {
  it('uses the UTC date for exact UTC midnight', () => {
    expect(expenseCalendarDate(new Date('2025-03-31T00:00:00.000Z'), TZ)).toEqual({ date: '2025-03-31', rule: 'utc-midnight' });
    expect(expenseCalendarDate(new Date('2025-04-01T00:00:00.000Z'), 'America/Los_Angeles').date).toBe('2025-04-01');
  });

  it('uses the --tz calendar date for arbitrary times', () => {
    // 20:00 UTC on Mar 31 is 01:30 on Apr 1 in Kolkata
    expect(expenseCalendarDate(new Date('2025-03-31T20:00:00.000Z'), TZ)).toEqual({ date: '2025-04-01', rule: 'tz' });
    expect(expenseCalendarDate(new Date('2025-03-31T10:00:00.000Z'), TZ).date).toBe('2025-03-31');
  });

  it('budget month near the IST/UTC boundary', () => {
    // Local midnight of 1 Apr in IST = 2025-03-31T18:30:00Z
    expect(budgetMonth(new Date('2025-03-31T18:30:00.000Z'), TZ)).toBe('2025-04-01');
    expect(budgetMonth(new Date('2025-04-15T10:00:00.000Z'), TZ)).toBe('2025-04-01');
  });
});

describe('transformExpense', () => {
  it('maps a full regular document', () => {
    const r = transformExpense(
      doc({
        title: '  Dinner ',
        amount: '1234.5',
        forWhom: ' Rahul ',
        transactionType: 'lent',
        paymentReceived: true,
        paymentReceivedDate: ts('2025-04-02T05:00:00.000Z'),
        category: '  Food ',
      }),
      TZ,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row).toMatchObject({
      legacyFirestoreId: 'doc1',
      title: 'Dinner',
      amount: '1234.50',
      forWhom: 'Rahul',
      date: '2025-03-31',
      transactionType: 'lent',
      paymentReceived: true,
      isSplit: false,
      category: 'Food',
    });
    expect(r.row.paymentReceivedAt?.toISOString()).toBe('2025-04-02T05:00:00.000Z');
    expect(r.warnings).toEqual([]);
  });

  it('applies defaults for missing fields', () => {
    const r = transformExpense(doc({ transactionType: undefined, paymentReceived: undefined, category: '' }), TZ);
    expect(r.ok && r.row).toMatchObject({
      transactionType: 'expense',
      paymentReceived: false,
      paymentReceivedAt: null,
      isSplit: false,
      category: null,
    });
  });

  it('normalizes lowercase self and warns', () => {
    const r = transformExpense(doc({ forWhom: 'self' }), TZ);
    expect(r.ok && r.row.forWhom).toBe('Self');
    expect(r.ok && r.warnings[0]).toContain('normalized to "Self"');
  });

  it('empty title → (untitled) with a warning', () => {
    const r = transformExpense(doc({ title: '   ' }), TZ);
    expect(r.ok && r.row.title).toBe('(untitled)');
    expect(r.ok && r.warnings).toContain('empty title → "(untitled)"');
  });

  it('skips invalid amount, payment mode, type and date', () => {
    for (const amount of [0, -5, 'abc', null, 0.004]) {
      expect(transformExpense(doc({ amount }), TZ).ok).toBe(false);
    }
    expect(transformExpense(doc({ paymentMode: 'Cheque' }), TZ)).toMatchObject({ ok: false });
    expect(transformExpense(doc({ transactionType: 'gift' }), TZ)).toMatchObject({ ok: false });
    expect(transformExpense(doc({ date: null }), TZ)).toMatchObject({ ok: false });
  });

  it('maps splits with positions, normalized names and warnings', () => {
    const r = transformExpense(
      doc({
        amount: 300,
        forWhom: 'Split',
        isSplit: true,
        splitDetails: [
          { person: 'self', amount: 100 },
          { person: 'Asha', amount: 100.004, paymentReceived: true, paymentReceivedDate: ts('2025-04-01T00:00:00Z') },
          { person: 'asha', amount: 50 },
        ],
      }),
      TZ,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.forWhom).toBe('Split');
    expect(r.splits.map((s) => [s.position, s.person, s.amount, s.paymentReceived])).toEqual([
      [0, 'Self', '100.00', false],
      [1, 'Asha', '100.00', true],
      [2, 'asha', '50.00', false],
    ]);
    expect(r.warnings.some((w) => w.includes('split sum'))).toBe(true);
    expect(r.warnings).toContain('split has duplicate person names');
  });

  it('warns when a split has no Self share', () => {
    const r = transformExpense(
      doc({ amount: 20, isSplit: true, forWhom: 'Split', splitDetails: [{ person: 'A', amount: 10 }, { person: 'B', amount: 10 }] }),
      TZ,
    );
    expect(r.ok && r.warnings).toContain('split has no "Self" share');
  });

  it('isSplit with empty splitDetails → not split, forWhom Split → Self, with warnings', () => {
    const r = transformExpense(doc({ isSplit: true, forWhom: 'Split', splitDetails: [] }), TZ);
    expect(r.ok && r.row).toMatchObject({ isSplit: false, forWhom: 'Self' });
    expect(r.ok && r.warnings.length).toBe(2);
  });
});

describe('transformBudgets', () => {
  it('maps months, skips bad amounts, and keeps the latest duplicate', () => {
    const { rows, errors, warnings } = transformBudgets(
      [
        { id: 'b1', data: { month: ts('2025-03-31T18:30:00Z'), amount: 5000, createdAt: ts('2025-04-01T00:00:00Z'), updatedAt: ts('2025-04-01T00:00:00Z') } },
        { id: 'b2', data: { month: ts('2025-03-31T18:30:00Z'), amount: 6000, createdAt: ts('2025-04-01T00:00:00Z'), updatedAt: ts('2025-04-05T00:00:00Z') } },
        { id: 'b3', data: { month: ts('2025-04-30T18:30:00Z'), amount: 0 } },
        { id: 'b4', data: { month: ts('2025-05-31T18:30:00Z'), amount: 7000 } },
      ],
      TZ,
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(rows.map((r) => [r.legacyFirestoreId, r.month, r.amount])).toEqual([
      ['b2', '2025-04-01', '6000.00'],
      ['b4', '2025-06-01', '7000.00'],
    ]);
    expect(errors.map((e) => e.id)).toEqual(['b3']);
    expect(warnings.map((w) => w.id).sort()).toEqual(['b1', 'b4', 'b4']);
  });
});

describe('checksums', () => {
  it('sums per month and type in paise', () => {
    const c = checksums([
      { date: '2025-03-01', transactionType: 'expense', amount: '0.10' },
      { date: '2025-03-31', transactionType: 'expense', amount: '0.20' },
      { date: '2025-04-01', transactionType: 'income', amount: '100.00' },
    ]);
    expect(c.get('2025-03')?.get('expense')).toEqual({ count: 2, paise: 30 });
    expect(paiseToFixed(30)).toBe('0.30');
    expect(c.get('2025-04')?.get('income')).toEqual({ count: 1, paise: 10000 });
  });
});
