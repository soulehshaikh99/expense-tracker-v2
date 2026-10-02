import type { Expense } from '@/types/expense';

let seq = 0;

/** Local-date helper: d(2025, 3, 15) → 15 Mar 2025 local midnight. */
export function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

export function makeExpense(partial: Partial<Expense> = {}): Expense {
  seq += 1;
  return {
    id: `e${seq}`,
    title: `Item ${seq}`,
    amount: 100,
    paymentMode: 'UPI',
    forWhom: 'Self',
    date: d(2025, 3, 15),
    ...partial,
  };
}

/** Run fn with process TZ set to tz, then restore. Vitest uses forked processes. */
export function withTZ<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

export const TIMEZONES = ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati'];
