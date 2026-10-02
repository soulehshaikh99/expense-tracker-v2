import { describe, expect, it } from 'vitest';
import { categorySuggestions, forWhomOptions, personSuggestions } from '@/lib/suggestions';
import { makeExpense as e } from './helpers';

describe('suggestions', () => {
  const rows = [
    e({ forWhom: 'Self', category: 'Food' }),
    e({ forWhom: 'rahul', category: ' Bills ' }),
    e({ forWhom: 'Asha', category: '' }),
    e({ forWhom: 'Split', isSplit: true, category: 'food' }),
    e({ forWhom: 'Asha' }),
  ];

  it('persons: unique, sorted, Self first, no Split', () => {
    expect(personSuggestions(rows)).toEqual(['Self', 'Asha', 'rahul']);
    expect(personSuggestions([])).toEqual(['Self']);
  });

  it('filter options include Self only when used', () => {
    expect(forWhomOptions(rows)).toEqual(['Self', 'Asha', 'rahul']);
    expect(forWhomOptions([e({ forWhom: 'Asha' })])).toEqual(['Asha']);
  });

  it('categories: unique, trimmed, non-empty, sorted', () => {
    expect(categorySuggestions(rows)).toEqual(['Bills', 'Food', 'food']);
  });
});
