import type { Expense } from '@/types/expense';
import { isSelf, SELF, SPLIT } from './person';

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Unique sorted forWhom values (and split share names), excluding 'Split', with Self first. */
export function personSuggestions(expenses: Expense[]): string[] {
  const names = new Set<string>();
  for (const e of expenses) {
    if (e.forWhom && e.forWhom !== SPLIT && !isSelf(e.forWhom)) names.add(e.forWhom);
  }
  return [SELF, ...[...names].sort(byName)];
}

/** Names that appear as forWhom on loaded records (for the person filter). */
export function forWhomOptions(expenses: Expense[]): string[] {
  const names = new Set<string>();
  for (const e of expenses) if (e.forWhom && e.forWhom !== SPLIT) names.add(e.forWhom);
  const rest = [...names].filter((n) => !isSelf(n)).sort(byName);
  return names.has(SELF) ? [SELF, ...rest] : rest;
}

export function categorySuggestions(expenses: Expense[]): string[] {
  const set = new Set<string>();
  for (const e of expenses) if (e.category?.trim()) set.add(e.category.trim());
  return [...set].sort(byName);
}
