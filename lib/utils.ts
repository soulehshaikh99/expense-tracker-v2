export { cn } from 'cn';

/** Comma grouping, two decimals, trailing `.00` removed. */
export function formatNumber(value: number, decimals: number = 2): string {
  const formatted = value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formatted.replace(/\.00$/, '');
}

export function formatMoney(value: number): string {
  return `₹${formatNumber(value)}`;
}

/** Round to 2 decimals to keep float sums tidy. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
