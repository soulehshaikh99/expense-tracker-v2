import { endOfMonth, format, isValid, isWithinInterval, parse, startOfDay, startOfMonth } from 'date-fns';

export const DATE_FORMAT = 'yyyy-MM-dd';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-\d{2}-01$/;

export function isDateString(value: string): boolean {
  return DATE_RE.test(value) && isValid(parse(value, DATE_FORMAT, new Date()));
}

/** Parse 'yyyy-MM-dd' as local midnight. Throws on invalid input. */
export function parseLocalDate(value: string): Date {
  if (!DATE_RE.test(value)) throw new Error(`Invalid date string: ${value}`);
  const d = parse(value, DATE_FORMAT, new Date());
  if (!isValid(d)) throw new Error(`Invalid date string: ${value}`);
  return d;
}

/** Format a Date as its local calendar date 'yyyy-MM-dd'. */
export function formatLocalDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

/** First day of the date's month as 'yyyy-MM-01'. */
export function formatMonthKey(date: Date): string {
  return format(startOfMonth(date), DATE_FORMAT);
}

export function today(): Date {
  return startOfDay(new Date());
}

export function isInMonth(date: Date, month: Date): boolean {
  return isWithinInterval(date, { start: startOfMonth(month), end: endOfMonth(month) });
}

export function isSameMonthAs(a: Date, b: Date): boolean {
  return startOfMonth(a).getTime() === startOfMonth(b).getTime();
}
