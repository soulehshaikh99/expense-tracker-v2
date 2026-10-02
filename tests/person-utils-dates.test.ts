import { describe, expect, it } from 'vitest';
import { canHavePaymentStatus, isSelf, normalizePerson, typeOf } from '@/lib/person';
import { formatMoney, formatNumber, round2 } from '@/lib/utils';
import {
  formatLocalDate,
  formatMonthKey,
  isDateString,
  isInMonth,
  isSameMonthAs,
  parseLocalDate,
} from '@/lib/dates';
import { d, TIMEZONES, withTZ } from './helpers';

describe('person', () => {
  it('normalizes self in any case and trims', () => {
    expect(normalizePerson('self')).toBe('Self');
    expect(normalizePerson('  SELF ')).toBe('Self');
    expect(normalizePerson(' Rahul ')).toBe('Rahul');
    expect(normalizePerson('Selfish')).toBe('Selfish');
  });

  it('isSelf handles legacy lowercase and empty values', () => {
    expect(isSelf('self')).toBe(true);
    expect(isSelf('Self')).toBe(true);
    expect(isSelf('Rahul')).toBe(false);
    expect(isSelf(undefined)).toBe(false);
  });

  it('typeOf defaults to expense', () => {
    expect(typeOf({})).toBe('expense');
    expect(typeOf({ transactionType: 'income' })).toBe('income');
  });

  it('canHavePaymentStatus', () => {
    expect(canHavePaymentStatus({ forWhom: 'Rahul' })).toBe(true);
    expect(canHavePaymentStatus({ forWhom: 'Rahul', transactionType: 'donation' })).toBe(true);
    expect(canHavePaymentStatus({ forWhom: 'Rahul', transactionType: 'lent' })).toBe(true);
    expect(canHavePaymentStatus({ forWhom: 'Rahul', transactionType: 'income' })).toBe(false);
    expect(canHavePaymentStatus({ forWhom: 'self' })).toBe(false);
    expect(canHavePaymentStatus({ forWhom: 'Split', isSplit: true })).toBe(false);
  });
});

describe('formatNumber', () => {
  it('groups with commas and strips .00', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1234.5)).toBe('1,234.50');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999.999)).toBe('1,000');
    expect(formatNumber(-2500.25)).toBe('-2,500.25');
    expect(formatMoney(1500)).toBe('₹1,500');
    expect(formatMoney(-1158.5)).toBe('-₹1,158.50');
    expect(formatMoney(-0.001)).toBe('₹0');
  });

  it('round2 tidies float sums', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });
});

describe('dates', () => {
  it('withTZ really switches the process timezone', () => {
    expect(withTZ('America/Los_Angeles', () => new Date(2025, 0, 1).getTimezoneOffset())).toBe(480);
    expect(withTZ('Asia/Kolkata', () => new Date(2025, 0, 1).getTimezoneOffset())).toBe(-330);
  });

  for (const tz of TIMEZONES) {
    it(`round-trips yyyy-MM-dd as local midnight in ${tz}`, () => {
      withTZ(tz, () => {
        for (const s of ['2025-01-01', '2025-03-31', '2024-02-29', '2025-12-31']) {
          const date = parseLocalDate(s);
          expect(date.getHours()).toBe(0);
          expect(formatLocalDate(date)).toBe(s);
        }
        expect(formatMonthKey(parseLocalDate('2025-04-30'))).toBe('2025-04-01');
      });
    });

    it(`first and last day stay in their month in ${tz}`, () => {
      withTZ(tz, () => {
        const march = parseLocalDate('2025-03-01');
        expect(isInMonth(parseLocalDate('2025-03-01'), march)).toBe(true);
        expect(isInMonth(parseLocalDate('2025-03-31'), march)).toBe(true);
        expect(isInMonth(parseLocalDate('2025-02-28'), march)).toBe(false);
        expect(isInMonth(parseLocalDate('2025-04-01'), march)).toBe(false);
      });
    });
  }

  it('rejects invalid date strings', () => {
    expect(isDateString('2025-02-30')).toBe(false);
    expect(isDateString('2025-2-3')).toBe(false);
    expect(isDateString('2025-02-03')).toBe(true);
    expect(() => parseLocalDate('nope')).toThrow();
  });

  it('isSameMonthAs', () => {
    expect(isSameMonthAs(d(2025, 3, 1), d(2025, 3, 31))).toBe(true);
    expect(isSameMonthAs(d(2025, 3, 31), d(2025, 4, 1))).toBe(false);
  });
});
