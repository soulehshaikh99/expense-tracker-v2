import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/shared/Money';
import { cn } from '@/lib/utils';

export type SummaryTone = 'expense' | 'others' | 'income' | 'donation' | 'lent' | 'net';

// Tinted backgrounds per plan 2.3: me blue, others purple, received yellow, donations pink,
// lent orange, net green.
const TONES: Record<SummaryTone, string> = {
  expense: 'bg-expense/10 border-expense/20',
  others: 'bg-summary-others/10 border-summary-others/20',
  income: 'bg-pending/10 border-pending/25',
  donation: 'bg-donation/10 border-donation/20',
  lent: 'bg-lent/10 border-lent/20',
  net: 'bg-income/10 border-income/20',
};

interface SummaryCardProps {
  title: string;
  value: number;
  tone: SummaryTone;
  lines?: { label: string; value: number }[];
}

export function SummaryCard({ title, value, tone, lines }: SummaryCardProps) {
  return (
    <Card className={cn('gap-1 py-3 shadow-none sm:py-4', TONES[tone])}>
      <CardHeader className="px-3 sm:px-4">
        <CardTitle className="text-xs font-normal text-muted-foreground sm:text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-4">
        <Money value={value} className="text-xl font-bold sm:text-2xl" />
        {lines && (
          <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {lines.map((l) => (
              <div key={l.label} className="flex gap-1">
                <dt>{l.label}:</dt>
                <dd>
                  <Money value={l.value} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
