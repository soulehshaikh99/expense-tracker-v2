import {
  COLUMN_IDS,
  COLUMN_VISIBILITY_STORAGE_KEY,
  COLUMN_WIDTHS_STORAGE_KEY,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_COLUMN_WIDTHS,
  type ColumnVisibility,
  type ColumnWidths,
} from '@/types/table';

const MIN_WIDTH = 60;
const MAX_WIDTH = 800;

function read(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
}

/** Stored values merged over defaults; unknown keys and wrong types are ignored. */
export function mergeVisibility(stored: unknown): ColumnVisibility {
  const result = { ...DEFAULT_COLUMN_VISIBILITY };
  if (stored && typeof stored === 'object') {
    for (const id of COLUMN_IDS) {
      const v = (stored as Record<string, unknown>)[id];
      if (typeof v === 'boolean') result[id] = v;
    }
  }
  return result;
}

export function mergeWidths(stored: unknown): ColumnWidths {
  const result = { ...DEFAULT_COLUMN_WIDTHS };
  if (stored && typeof stored === 'object') {
    for (const id of COLUMN_IDS) {
      const v = (stored as Record<string, unknown>)[id];
      if (typeof v === 'number' && Number.isFinite(v)) {
        result[id] = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(v)));
      }
    }
  }
  return result;
}

export const loadColumnVisibility = () => mergeVisibility(read(COLUMN_VISIBILITY_STORAGE_KEY));
export const saveColumnVisibility = (v: ColumnVisibility) => write(COLUMN_VISIBILITY_STORAGE_KEY, v);
export const loadColumnWidths = () => mergeWidths(read(COLUMN_WIDTHS_STORAGE_KEY));
export const saveColumnWidths = (w: ColumnWidths) => write(COLUMN_WIDTHS_STORAGE_KEY, w);
export const COLUMN_MIN_WIDTH = MIN_WIDTH;
export const COLUMN_MAX_WIDTH = MAX_WIDTH;
