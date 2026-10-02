import { cn, formatMoney } from '@/lib/utils';

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatMoney(value)}</span>;
}
