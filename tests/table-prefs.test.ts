import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadColumnVisibility,
  loadColumnWidths,
  mergeVisibility,
  mergeWidths,
  saveColumnWidths,
} from '@/lib/table-prefs';
import { DEFAULT_COLUMN_VISIBILITY, DEFAULT_COLUMN_WIDTHS } from '@/types/table';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('table prefs', () => {
  it('merges stored values over defaults and ignores junk', () => {
    expect(mergeVisibility({ category: false, bogus: false, title: 'no' })).toEqual({
      ...DEFAULT_COLUMN_VISIBILITY,
      category: false,
    });
    expect(mergeWidths({ title: 333.4, amount: 5, date: 'wide' })).toEqual({
      ...DEFAULT_COLUMN_WIDTHS,
      title: 333,
      amount: 60,
    });
    expect(mergeWidths(null)).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('returns defaults on the server (no window)', () => {
    expect(loadColumnVisibility()).toEqual(DEFAULT_COLUMN_VISIBILITY);
    expect(loadColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('survives broken storage', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '{not json',
        setItem: () => {
          throw new Error('quota');
        },
      },
    });
    expect(loadColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(() => saveColumnWidths(DEFAULT_COLUMN_WIDTHS)).not.toThrow();
    errors.mockRestore();
  });

  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    });
    saveColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, title: 250 });
    expect(loadColumnWidths().title).toBe(250);
    expect(store.has('expense-tracker-column-widths')).toBe(true);
  });
});
