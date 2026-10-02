/**
 * Pure Firestore → Postgres transforms for the one-off import (docs/MIGRATION.md §9.3).
 * No firebase or database imports here so the rules can be unit-tested.
 */
import { normalizePerson, isSelf } from '../../lib/person';

export const PAYMENT_MODES = ['Credit Card', 'Debit Card', 'UPI', 'Cash'] as const;
export const TRANSACTION_TYPES = ['expense', 'income', 'donation', 'lent'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Anything Firestore may hand back for a date-ish field. */
export type TimestampLike = { toDate(): Date } | Date | string | number | null | undefined;

export interface RawDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface Issue {
  id: string;
  collection: 'expenses' | 'budgets';
  reason: string;
}

export interface ExpenseRowOut {
  legacyFirestoreId: string;
  title: string;
  amount: string; // toFixed(2)
  paymentMode: PaymentMode;
  forWhom: string;
  date: string; // yyyy-MM-dd
  transactionType: TransactionType;
  paymentReceived: boolean;
  paymentReceivedAt: Date | null;
  isSplit: boolean;
  category: string | null;
  /** How the calendar date was derived, for the boundary spot check. */
  dateSource: { raw: string; rule: 'utc-midnight' | 'tz' };
}

export interface SplitRowOut {
  position: number;
  person: string;
  amount: string;
  paymentReceived: boolean;
  paymentReceivedAt: Date | null;
}

export type ExpenseResult =
  | { ok: true; row: ExpenseRowOut; splits: SplitRowOut[]; warnings: string[] }
  | { ok: false; error: string };

export interface BudgetRowOut {
  legacyFirestoreId: string;
  month: string; // yyyy-MM-01
  amount: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------- dates ----------

export function toDate(value: TimestampLike): Date | null {
  if (value == null) return null;
  let d: Date;
  if (value instanceof Date) d = value;
  else if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    d = (value as { toDate(): Date }).toDate();
  } else if (typeof value === 'string' || typeof value === 'number') d = new Date(value);
  else return null;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar date of an instant in an IANA timezone, as yyyy-MM-dd. */
export function calendarDateInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isUtcMidnight(d: Date): boolean {
  return (
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  );
}

/**
 * Expense date rule: the old form saved new Date('yyyy-MM-dd') = UTC midnight → use the UTC date.
 * Anything else (seed data, new Date()) → the calendar date in the old app's timezone.
 */
export function expenseCalendarDate(d: Date, tz: string): { date: string; rule: 'utc-midnight' | 'tz' } {
  if (isUtcMidnight(d)) return { date: d.toISOString().slice(0, 10), rule: 'utc-midnight' };
  return { date: calendarDateInTz(d, tz), rule: 'tz' };
}

/** Budget month: local midnight of the 1st in the browser tz → calendar date in tz, day forced to 01. */
export function budgetMonth(d: Date, tz: string): string {
  return `${calendarDateInTz(d, tz).slice(0, 7)}-01`;
}

// ---------- money ----------

/** Integer paise from a finite number, rounding to 2 decimals. */
export function toPaise(n: number): number {
  return Math.round(n * 100);
}

export function paiseToFixed(p: number): string {
  const sign = p < 0 ? '-' : '';
  const abs = Math.abs(p);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

// ---------- expenses ----------

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function transformExpense(doc: RawDoc, tz: string): ExpenseResult {
  const x = doc.data;
  const warnings: string[] = [];

  const amountNum = Number(x.amount);
  if (x.amount == null || !Number.isFinite(amountNum) || toPaise(amountNum) <= 0) {
    return { ok: false, error: `invalid amount: ${JSON.stringify(x.amount)}` };
  }

  const paymentMode = str(x.paymentMode) as PaymentMode;
  if (!PAYMENT_MODES.includes(paymentMode)) {
    return { ok: false, error: `invalid paymentMode: ${JSON.stringify(x.paymentMode)}` };
  }

  const rawType = x.transactionType;
  const transactionType = (rawType == null || rawType === '' ? 'expense' : str(rawType)) as TransactionType;
  if (!TRANSACTION_TYPES.includes(transactionType)) {
    return { ok: false, error: `unknown transactionType: ${JSON.stringify(rawType)}` };
  }

  const dateValue = toDate(x.date as TimestampLike);
  if (!dateValue) return { ok: false, error: `missing or invalid date: ${JSON.stringify(x.date)}` };
  const { date, rule } = expenseCalendarDate(dateValue, tz);

  let title = str(x.title).trim();
  if (!title) {
    title = '(untitled)';
    warnings.push('empty title → "(untitled)"');
  }

  // Splits
  const rawSplits = Array.isArray(x.splitDetails) ? (x.splitDetails as Record<string, unknown>[]) : [];
  let isSplit = x.isSplit === true;
  if (isSplit && rawSplits.length === 0) {
    isSplit = false;
    warnings.push('isSplit true but splitDetails empty → imported as not split');
  }

  const splits: SplitRowOut[] = [];
  if (isSplit) {
    for (const [i, s] of rawSplits.entries()) {
      const amt = Number(s?.amount);
      if (!Number.isFinite(amt) || toPaise(amt) < 0) {
        return { ok: false, error: `split ${i}: invalid amount ${JSON.stringify(s?.amount)}` };
      }
      const received = s?.paymentReceived === true;
      splits.push({
        position: i,
        person: normalizePerson(str(s?.person)),
        amount: paiseToFixed(toPaise(amt)),
        paymentReceived: received,
        paymentReceivedAt: toDate(s?.paymentReceivedDate as TimestampLike),
      });
    }
    const total = splits.reduce((sum, s) => sum + toPaise(Number(s.amount)), 0);
    if (Math.abs(total - toPaise(amountNum)) > 1) {
      warnings.push(`split sum ₹${paiseToFixed(total)} ≠ amount ₹${paiseToFixed(toPaise(amountNum))}`);
    }
    if (!splits.some((s) => isSelf(s.person))) warnings.push('split has no "Self" share');
    const names = splits.map((s) => s.person.toLowerCase());
    if (new Set(names).size !== names.length) warnings.push('split has duplicate person names');
    if (splits.some((s) => !s.person)) warnings.push('split has an empty person name');
  }

  let forWhom: string;
  if (isSplit) {
    forWhom = 'Split';
  } else {
    const original = str(x.forWhom);
    forWhom = normalizePerson(original);
    if (!forWhom) {
      forWhom = 'Self';
      warnings.push('empty forWhom → "Self"');
    } else if (forWhom === 'Split') {
      forWhom = 'Self';
      warnings.push('forWhom "Split" on a non-split record → "Self"');
    }
    if (original.trim() && original.trim() !== forWhom && original.trim().toLowerCase() === 'self') {
      // Legacy lowercase self — informational (counts as Self in v2; the old app treated it as a person).
      warnings.push(`forWhom "${original}" normalized to "Self"`);
    }
  }

  const category = str(x.category).trim() || null;

  return {
    ok: true,
    row: {
      legacyFirestoreId: doc.id,
      title,
      amount: paiseToFixed(toPaise(amountNum)),
      paymentMode,
      forWhom,
      date,
      transactionType,
      paymentReceived: x.paymentReceived === true,
      paymentReceivedAt: toDate(x.paymentReceivedDate as TimestampLike),
      isSplit,
      category,
      dateSource: { raw: dateValue.toISOString(), rule },
    },
    splits,
    warnings,
  };
}

// ---------- budgets ----------

export function transformBudgets(
  docs: RawDoc[],
  tz: string,
  now: Date = new Date(),
): { rows: BudgetRowOut[]; errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const candidates: BudgetRowOut[] = [];

  for (const doc of docs) {
    const monthDate = toDate(doc.data.month as TimestampLike);
    if (!monthDate) {
      errors.push({ id: doc.id, collection: 'budgets', reason: `missing or invalid month: ${JSON.stringify(doc.data.month)}` });
      continue;
    }
    const amount = Number(doc.data.amount);
    if (!Number.isFinite(amount) || toPaise(amount) <= 0) {
      errors.push({ id: doc.id, collection: 'budgets', reason: `invalid amount: ${JSON.stringify(doc.data.amount)}` });
      continue;
    }
    const createdAt = toDate(doc.data.createdAt as TimestampLike);
    const updatedAt = toDate(doc.data.updatedAt as TimestampLike);
    if (!createdAt) warnings.push({ id: doc.id, collection: 'budgets', reason: 'missing createdAt → now' });
    if (!updatedAt) warnings.push({ id: doc.id, collection: 'budgets', reason: 'missing updatedAt → now' });
    candidates.push({
      legacyFirestoreId: doc.id,
      month: budgetMonth(monthDate, tz),
      amount: paiseToFixed(toPaise(amount)),
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? now,
    });
  }

  // Duplicate months: keep the latest updatedAt.
  const byMonth = new Map<string, BudgetRowOut[]>();
  for (const c of candidates) byMonth.set(c.month, [...(byMonth.get(c.month) ?? []), c]);
  const rows: BudgetRowOut[] = [];
  for (const [month, list] of byMonth) {
    const sorted = [...list].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    rows.push(sorted[0]);
    for (const dropped of sorted.slice(1)) {
      warnings.push({
        id: dropped.legacyFirestoreId,
        collection: 'budgets',
        reason: `duplicate month ${month}: kept ${sorted[0].legacyFirestoreId} (newer updatedAt), skipped this one (₹${dropped.amount})`,
      });
    }
  }
  rows.sort((a, b) => a.month.localeCompare(b.month));
  return { rows, errors, warnings };
}

// ---------- checksums ----------

export type Checksums = Map<string, Map<TransactionType, { count: number; paise: number }>>;

export function checksums(rows: { date: string; transactionType: TransactionType; amount: string }[]): Checksums {
  const out: Checksums = new Map();
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    const m = out.get(month) ?? new Map();
    const cur = m.get(r.transactionType) ?? { count: 0, paise: 0 };
    m.set(r.transactionType, { count: cur.count + 1, paise: cur.paise + toPaise(Number(r.amount)) });
    out.set(month, m);
  }
  return out;
}
